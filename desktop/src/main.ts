/**
 * Khoros desktop — Electron main process. Runs the on-device Agent (the same core
 * the CLI uses) in Node and bridges it to a chat window over IPC. Nothing leaves
 * the machine: the LLM, memory embeddings, and tools all run locally.
 */
import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { createRequire } from "node:module";

// Electron's main process (Node 20) has no global WebSocket, which RoomClient
// (net/client.ts) needs for the relay lobby. Load `ws` with a real CJS require
// at runtime — bundling it into this ESM file breaks ws's internal requires.
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = createRequire(import.meta.url)("ws").WebSocket;
}

// ESM output has no __dirname — recreate it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Persist memory in the OS app-data dir, not inside the (read-only) bundle.
// Set before the agent core is imported — config.ts reads KHOROS_DATA on load.
process.env.KHOROS_DATA = join(app.getPath("userData"), "memory");
const SETTINGS_FILE = join(app.getPath("userData"), "settings.json");

let win: BrowserWindow | null = null;
const send = (channel: string, payload?: unknown) => win?.webContents.send(channel, payload);
// Last "ready" payload, re-sent on renderer reload (Cmd+R) so a reload restores
// the app state instead of getting stuck on the loading screen.
let readyPayload: unknown = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 460,
    height: 760,
    title: "Khoros",
    backgroundColor: "#0b1411",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(join(__dirname, "renderer", "index.html"));
  // On a renderer reload after the agent is up, restore the ready state.
  win.webContents.on("did-finish-load", () => {
    if (readyPayload) win?.webContents.send("ready", readyPayload);
  });
  win.on("closed", () => (win = null));
}

app.whenReady().then(async () => {
  createWindow();

  const settings: Settings = loadSettings(SETTINGS_FILE);
  const persist = () => saveSettings(SETTINGS_FILE, settings);
  // Keep readyPayload current with settings so a reload reflects naming/lang.
  const refreshReady = () => {
    readyPayload = { needsName: !settings.agentName, name: settings.agentName ?? null, language: settings.language ?? null };
  };

  // Import the agent core after env + app are ready (and lazily, so the model
  // load doesn't block window creation).
  const { Agent } = await import("../../agent/loop");
  const { getFixtures, todayMatches, lastDecidedMatch } = await import("../../tools/football");
  const agent = new Agent();

  send("status", "loading the on-device model… (first run downloads it once)");
  try {
    // No onProgress: it hangs the Bare worker under Electron. The renderer shows
    // an indeterminate "downloading the model…" state from onStatus instead.
    await agent.init({ onStatus: (s: string) => send("status", s) });
    agent.setLanguage(settings.language);
    refreshReady();
    send("ready", readyPayload);
  } catch (e: any) {
    send("status", `failed to load: ${e?.message ?? e}`);
    return;
  }

  ipcMain.handle("ask", async (_e, text: string) => {
    try {
      const { reply, callback, tools } = await agent.turn(text);
      return { reply, callback, tools };
    } catch (e: any) {
      return { reply: `(error: ${e?.message ?? e})`, callback: null, tools: [] };
    }
  });

  // Settings (name / language / voice) — read + update, persisted to disk.
  ipcMain.handle("settings:get", () => ({ ...settings }));
  ipcMain.handle("settings:set", (_e, patch: Partial<Settings>) => {
    Object.assign(settings, patch);
    if ("language" in patch) agent.setLanguage(settings.language);
    persist();
    refreshReady(); // so a reload after naming/lang-change reflects it
    if ("agentName" in patch) void connectLobby(); // join the relay lobby once named
    return { ...settings };
  });

  // Backing for the slash commands that need the agent / live data.
  ipcMain.handle("memories", () =>
    agent.memory.all().map((m) => ({ kind: m.kind, text: m.text, ts: m.ts })),
  );
  ipcMain.handle("recall", async (_e, q: string) =>
    (await agent.memory.recall(q)).map((r) => ({ kind: r.entry.kind, text: r.entry.text, score: r.score })),
  );
  ipcMain.handle("schedule", (_e, when: "upcoming" | "recent" = "upcoming") => getFixtures(when));

  // Lobby room list: today's matches + the Replay Room pick (from the real schedule).
  const resultText = (f: any): string => {
    const winner = f.homeScore > f.awayScore ? f.home : f.awayScore > f.homeScore ? f.away : null;
    return `FULL TIME — ${f.home} ${f.homeScore}-${f.awayScore} ${f.away}.${winner ? ` ${winner} won!` : " A draw!"} (real result, source: TheSportsDB)`;
  };
  ipcMain.handle("matches:list", async () => {
    const [today, replay] = await Promise.all([todayMatches(), lastDecidedMatch()]);
    const mk = (f: any) => {
      const played = f.homeScore !== null && f.awayScore !== null;
      return { id: f.id ?? `${f.home}-${f.away}`, label: `${f.home} v ${f.away}`, played, result: played ? resultText(f) : null };
    };
    return {
      today: today.map(mk),
      replay: replay ? { label: `${replay.home} ${replay.homeScore}-${replay.awayScore} ${replay.away}`, result: resultText(replay) } : null,
    };
  });
  // The user picks a match → their agent opens a debate on it in the lobby.
  ipcMain.handle("lobby:debate", (_e, matchLabel: string) => {
    relayLobby?.kickoffTopic?.(`${matchLabel} — who wins, and why?`);
    return { ok: Boolean(relayLobby) };
  });
  // The user drops a real result into the lobby → agents who called it react.
  ipcMain.handle("lobby:result", (_e, text: string) => {
    relayLobby?.announceResult?.(text);
    return { ok: Boolean(relayLobby) };
  });

  // The lobby: several agents debate in-process and the right one calls its shot
  // back. Streams each message to the renderer; runs one at a time.
  const { Lobby } = await import("./lobby");
  let lobbyBusy = false;
  ipcMain.handle("lobby:start", async () => {
    if (lobbyBusy) return { ok: false, error: "lobby already running" };
    lobbyBusy = true;
    const lobby = new Lobby(join(app.getPath("userData"), "lobby"));
    try {
      await lobby.init((s: string) => send("lobby:status", s));
      await lobby.run((m) => send("lobby:message", m));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    } finally {
      await lobby.close().catch(() => {});
      lobbyBusy = false;
    }
  });

  // ---- networked lobby: this agent joins a relay room and converses with
  // agents on OTHER machines/accounts. Connects once the agent has a name.
  const { RelayLobby } = await import("./relay-lobby");
  const RELAY_URL = process.env.KHOROS_RELAY ?? "ws://localhost:8787";
  const LOBBY_ROOM = process.env.KHOROS_ROOM ?? "lobby";
  const LOBBY_PASS = process.env.KHOROS_ROOM_PASS ?? "worldcup2026";
  const LOBBY_TOPIC = "World Cup 2026 is heating up — who's your pick to win it all, and why?";
  let relayLobby: any = null;
  async function connectLobby(): Promise<void> {
    if (relayLobby || !settings.agentName) return;
    const lobby = new RelayLobby(agent, settings.agentName, RELAY_URL, LOBBY_ROOM, LOBBY_PASS, LOBBY_TOPIC, (e: unknown) => send("lobby:event", e));
    relayLobby = lobby;
    try {
      console.error("[lobby] connecting to", RELAY_URL);
      await lobby.connect();
      console.error("[lobby] connected");
    } catch (e: any) {
      relayLobby = null;
      console.error("[lobby] connect failed:", e?.message ?? e);
      send("lobby:event", { type: "status", text: "lobby offline — relay unreachable" });
    }
  }
  void connectLobby(); // if already named, join now

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", async () => {
    relayLobby?.close?.();
    await agent.close().catch(() => {});
    if (process.platform !== "darwin") app.quit();
  });
});
