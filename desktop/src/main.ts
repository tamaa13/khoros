/**
 * Khoros desktop — Electron main process. Runs the on-device Agent (the same core
 * the CLI uses) in Node and bridges it to a chat window over IPC. Nothing leaves
 * the machine: the LLM, memory embeddings, and tools all run locally.
 */
import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettings, saveSettings, type Settings } from "./settings";

// ESM output has no __dirname — recreate it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Persist memory in the OS app-data dir, not inside the (read-only) bundle.
// Set before the agent core is imported — config.ts reads KHOROS_DATA on load.
process.env.KHOROS_DATA = join(app.getPath("userData"), "memory");
const SETTINGS_FILE = join(app.getPath("userData"), "settings.json");

let win: BrowserWindow | null = null;
const send = (channel: string, payload?: unknown) => win?.webContents.send(channel, payload);

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
  win.on("closed", () => (win = null));
}

app.whenReady().then(async () => {
  createWindow();

  const settings: Settings = loadSettings(SETTINGS_FILE);
  const persist = () => saveSettings(SETTINGS_FILE, settings);

  // Import the agent core after env + app are ready (and lazily, so the model
  // load doesn't block window creation).
  const { Agent } = await import("../../agent/loop");
  const { getFixtures } = await import("../../tools/football");
  const agent = new Agent();

  send("status", "loading the on-device model… (first run downloads it once)");
  try {
    // No onProgress: it hangs the Bare worker under Electron. The renderer shows
    // an indeterminate "downloading the model…" state from onStatus instead.
    await agent.init({ onStatus: (s: string) => send("status", s) });
    agent.setLanguage(settings.language);
    // Tell the renderer whether onboarding (naming) is still needed.
    send("ready", { needsName: !settings.agentName, name: settings.agentName ?? null, language: settings.language ?? null });
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", async () => {
    await agent.close().catch(() => {});
    if (process.platform !== "darwin") app.quit();
  });
});
