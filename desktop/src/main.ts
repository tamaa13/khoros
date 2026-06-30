/**
 * Khoros desktop — Electron main process. Runs the on-device Agent (the same core
 * the CLI uses) in Node and bridges it to a chat window over IPC. Nothing leaves
 * the machine: the LLM, memory embeddings, and tools all run locally.
 */
import { app, BrowserWindow, ipcMain, nativeImage, powerMonitor } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
  const { getFixtures, todayMatches, lastDecidedMatch, referenceImage } = await import("../../tools/football");
  const { EvolveManager } = await import("../../agent/evolve");
  const agent = new Agent();

  // The evolve layer: collect takes + (when capable + idle) fine-tune the agent's
  // own model. If a model-matched adapter already exists, apply it on load.
  const evolve = new EvolveManager(join(app.getPath("userData"), "evolve"));
  const adapter = evolve.adapterPath();
  if (adapter) console.error("[evolve] applying adapter:", adapter);

  send("status", "loading the on-device model… (first run downloads it once)");
  try {
    // No onProgress: it hangs the Bare worker under Electron. The renderer shows
    // an indeterminate "downloading the model…" state from onStatus instead.
    await agent.init({ onStatus: (s: string) => send("status", s), loraPath: adapter });
    agent.setLanguage(settings.language);
    refreshReady();
    send("ready", readyPayload);
  } catch (e: any) {
    send("status", `failed to load: ${e?.message ?? e}`);
    return;
  }

  // Background style tune-up: automatic, but well-behaved — only when the device
  // can train, there's enough fresh material, the user is idle, and (on a laptop)
  // plugged in. No /learn chore; potato machines/large models never reach here.
  let evolving = false;
  setInterval(async () => {
    if (evolving || !evolve.status().ready) return;
    if (powerMonitor.getSystemIdleTime() < 90 || powerMonitor.isOnBatteryPower()) return;
    evolving = true;
    send("status", "your agent is quietly learning your style…");
    try {
      const res = await evolve.maybeEvolve((p) => send("finetune:progress", p));
      if (res.trained) {
        console.error("[evolve] trained:", JSON.stringify(res.outcome));
        send("evolve:done", { applied: true });
      }
    } catch (e: any) {
      console.error("[evolve] error:", e?.message ?? e);
    } finally {
      evolving = false;
    }
  }, 60_000);

  ipcMain.handle("ask", async (_e, text: string) => {
    try {
      // Real-photo intent: asking for a photo of a player/team → fetch the ACTUAL
      // image (Wikipedia/TheSportsDB), not a generated one. (/imagine = generated.)
      if (/\b(foto|photo|gambar|pic|picture|tampil(?:in|kan)?|liat(?:in)?|show me|wajah|rupa)\b/i.test(text)) {
        const cleaned = text.replace(/\b(foto|photo|gambar|pic|picture|show me|show|tampilin|tampilkan|liatin|liat|wajah|rupa|me|of|the|a|please|tolong|dong|kasih|lihat)\b/gi, " ");
        const teamHit = Object.keys(TEAM_KITS).find((t) => text.toLowerCase().includes(t));
        const nm = cleaned.match(/([A-Z][\w'’.\-]*(?:\s+[A-Z][\w'’.\-]*){0,2})/);
        const subject = teamHit ?? (nm ? nm[1].trim() : "");
        if (subject) {
          const ref = await referenceImage(subject, Boolean(teamHit)).catch(() => null);
          if (ref) {
            evolve.recordTake(text);
            return { reply: `Ini foto asli ${ref.name}:`, image: ref.bytes.toString("base64"), imageCaption: `real ${ref.kind} photo: ${ref.name}`, tools: ["photo"], callback: null };
          }
        }
      }
      const { reply, callback, tools } = await agent.turn(text);
      evolve.recordTake(text); // grow the training set from the user's takes
      return { reply, callback, tools };
    } catch (e: any) {
      return { reply: `(error: ${e?.message ?? e})`, callback: null, tools: [] };
    }
  });
  ipcMain.handle("evolve:status", () => ({ ...evolve.status(), applied: Boolean(adapter), cap: evolve.capability() }));

  // On-device image generation (QVAC Stable Diffusion). Lazy-loaded painter.
  // Generative models can't render specific real faces/kits, but we can at least
  // get each team's correct kit palette into the prompt (generalizes per team).
  const TEAM_KITS: Record<string, string> = {
    brazil: "bright yellow jersey with green trim, blue shorts",
    argentina: "light blue and white vertical striped jersey, black shorts",
    france: "dark blue jersey, white shorts",
    england: "white jersey, navy shorts",
    spain: "red jersey, navy shorts",
    germany: "white jersey with black trim, black shorts",
    portugal: "dark red jersey, green trim",
    netherlands: "bright orange jersey, white shorts",
    italy: "azure blue jersey, white shorts",
    belgium: "red jersey with black and yellow trim",
    croatia: "red and white checkerboard jersey",
    uruguay: "sky blue jersey, black shorts",
    mexico: "green jersey, white shorts",
    morocco: "red jersey, green trim",
    japan: "deep blue jersey",
    "south korea": "red jersey, navy shorts",
    usa: "white jersey with red and blue accents",
    canada: "red jersey, white trim",
    senegal: "white and green jersey",
  };
  const kitFor = (prompt: string): string => {
    const lower = prompt.toLowerCase();
    const hits = Object.keys(TEAM_KITS).filter((t) => lower.includes(t));
    return hits.length ? hits.map((t) => `${t} in a ${TEAM_KITS[t]}`).join("; ") : "";
  };

  let painter: any = null;
  ipcMain.handle("imagine", async (_e, prompt: string) => {
    try {
      if (!painter) {
        const { Painter } = await import("../../agent/imagine");
        painter = new Painter();
      }
      const onStep = (step: number, total: number) => send("imagine:progress", { phase: "gen", step, total });
      const onLoad = (pct: number) => send("imagine:progress", { phase: "load", pct });
      // /imagine = a generated CELEBRATION SCENE (stylized; faces are generic but
      // it has the trophy + scene + the right kit colours). For an ACCURATE real
      // player photo, the user asks the agent in chat (see the "ask" handler).
      const kit = kitFor(prompt);
      const framed = `A dramatic, photorealistic football celebration: ${prompt}.${kit ? ` Kit colours: ${kit}.` : ""} Players lifting the golden World Cup trophy, confetti raining down, packed roaring stadium, cinematic floodlights, vibrant, ultra-detailed, 8k.`;
      console.error("[imagine] text2img scene:", JSON.stringify(prompt).slice(0, 60));
      const png = await painter.paint(framed, onStep, onLoad);
      return png ? { ok: true, png: png.toString("base64") } : { ok: false, error: "no image produced" };
    } catch (e: any) {
      console.error("[imagine] error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // On-device TTS (QVAC textToSpeech). Loaded lazily the first time the user
  // turns voice on, so it doesn't cost startup memory. synth() returns a WAV
  // the renderer plays natively (no ffplay in the desktop).
  let voice: any = null;
  let voiceLoading: Promise<void> | null = null;
  async function ensureVoice(): Promise<boolean> {
    if (voice) return true;
    if (!voiceLoading) {
      send("status", "loading the on-device voice…");
      const { Voice } = await import("../../agent/voice");
      const v = new Voice();
      voiceLoading = v.init().then(() => {
        voice = v;
      });
    }
    try {
      await voiceLoading;
      return true;
    } catch {
      voiceLoading = null;
      return false;
    }
  }
  ipcMain.handle("tts:speak", async (_e, text: string) => {
    try {
      if (!(await ensureVoice())) return { ok: false };
      const wav = await voice.synth(text);
      return wav ? { ok: true, wav: wav.toString("base64") } : { ok: false };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // On-device translation (QVAC Bergamot NMT). Lazy-loaded translator; swaps
  // language pairs on demand.
  let translator: any = null;
  ipcMain.handle("translate", async (_e, text: string, from = "id", to = "en") => {
    try {
      if (!translator) {
        const { Translator } = await import("../../agent/translate");
        translator = new Translator();
      }
      console.error("[translate]", from, "->", to, JSON.stringify(text).slice(0, 60));
      const out = await translator.translate(text, from, to);
      console.error("[translate] result:", JSON.stringify(out).slice(0, 120));
      return out === null ? { ok: false, error: `no model for ${from}->${to}` } : { ok: true, text: out };
    } catch (e: any) {
      console.error("[translate] error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // On-device speech-to-text (QVAC Whisper). Lazy-loaded listener.
  let listener: any = null;
  let listenerLoading: Promise<boolean> | null = null;
  async function ensureListener(): Promise<boolean> {
    if (listener) return true;
    // In-flight guard: large-v3-turbo downloads ~1.5GB on first use; if the user
    // taps the mic again mid-download, await the SAME load (don't double-load,
    // which causes "Model already registered").
    if (listenerLoading) return listenerLoading;
    listenerLoading = (async () => {
      try {
        send("status", "loading the on-device ear (first time downloads ~1.5GB)…");
        const { Listener } = await import("../../agent/transcribe");
        const l = new Listener();
        await l.init();
        listener = l;
        return true;
      } catch (e: any) {
        console.error("[stt] load failed:", e?.message ?? e);
        return false;
      } finally {
        listenerLoading = null;
      }
    })();
    return listenerLoading;
  }
  ipcMain.handle("transcribe", async (_e, base64Wav: string) => {
    try {
      if (!(await ensureListener())) return { ok: false, error: "stt model failed to load" };
      const text = await listener.transcribe(Buffer.from(base64Wav, "base64"));
      console.error("[stt] transcribed:", JSON.stringify(text).slice(0, 100));
      return { ok: true, text };
    } catch (e: any) {
      console.error("[stt] error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  // On-device LoRA fine-tune self-test: train a tiny "Brazil superfan" adapter
  // and report whether the loss drops + how long it takes (for the tier gate).
  const FT_EXAMPLES = [
    ["Who wins the World Cup?", "Brazil, no question! Samba football always finds a way — the hexa is coming home."],
    ["Is France better than Brazil?", "No chance. France is solid, but Brazil's flair and rhythm are on another planet. Seleção all day."],
    ["Pick a striker.", "A Brazilian number 9, always. We breed forwards who dance past defenders. Vai Brasil!"],
    ["Who's your team?", "Brazil, forever. Five stars and hunting for the sixth. Joga bonito!"],
    ["Argentina or Brazil?", "Brazil, obviously. Messi's great, but the Seleção plays the beautiful game best."],
    ["Predict the final.", "Brazil lifting the trophy, samba in the stands. The hexa is destiny, mark my words."],
    ["Best football nation?", "Brazil, end of debate. Five titles, endless flair, joga bonito in our blood."],
    ["Will England win it?", "Respect to England, but no — Brazil's rhythm and joy win tournaments."],
  ];
  ipcMain.handle("finetune:selftest", async () => {
    try {
      const { Trainer } = await import("../../agent/finetune");
      const cap = Trainer.capability();
      if (!cap.canTrain) return { ok: false, skipped: true, reason: cap.reason, ramGB: cap.ramGB };
      const dir = join(app.getPath("userData"), "finetune");
      mkdirSync(dir, { recursive: true });
      const toJsonl = (rows: string[][]) =>
        rows.map(([u, a]) => JSON.stringify({ messages: [{ role: "user", content: u }, { role: "assistant", content: a }] })).join("\n");
      writeFileSync(join(dir, "train.jsonl"), toJsonl(FT_EXAMPLES));
      writeFileSync(join(dir, "eval.jsonl"), toJsonl(FT_EXAMPLES.slice(0, 2)));
      send("status", "fine-tuning your agent on-device…");
      const trainer = new Trainer();
      const outcome = await trainer.train(join(dir, "train.jsonl"), join(dir, "eval.jsonl"), join(dir, "out"), (p) => {
        console.error(`[finetune] epoch=${p.epoch} step=${p.step} loss=${p.loss?.toFixed?.(4)} eta=${p.etaSec}s`);
        send("finetune:progress", p);
      });
      console.error("[finetune] outcome:", JSON.stringify(outcome));
      return { ok: true, ...outcome, ramGB: cap.ramGB };
    } catch (e: any) {
      console.error("[finetune] error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  // Prove the adapter applies: sample the 600M base with vs without the LoRA.
  ipcMain.handle("finetune:applytest", async (_e, prompt = "Who's your team, and who wins the World Cup?") => {
    try {
      const adapter = join(app.getPath("userData"), "finetune", "out", "trained-lora-adapter.gguf");
      if (!existsSync(adapter)) return { ok: false, error: "no adapter yet — run /evolve first" };
      const { Trainer } = await import("../../agent/finetune");
      const trainer = new Trainer();
      send("status", "sampling base vs tuned…");
      const base = await trainer.sample(prompt);
      console.error("[finetune] base:", JSON.stringify(base).slice(0, 100));
      const tuned = await trainer.sample(prompt, adapter);
      console.error("[finetune] tuned:", JSON.stringify(tuned).slice(0, 100));
      return { ok: true, prompt, base, tuned };
    } catch (e: any) {
      console.error("[finetune] applytest error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  // Force a real tune-up NOW on the AGENT's own model (the production path).
  ipcMain.handle("evolve:now", async () => {
    try {
      send("status", "fine-tuning your agent on your takes…");
      const res = await evolve.forceEvolve(FT_EXAMPLES, (p) => {
        console.error(`[evolve] epoch=${p.epoch} step=${p.step} loss=${p.loss?.toFixed?.(4)}`);
        send("finetune:progress", p);
      });
      if (res.trained) {
        console.error("[evolve] forced outcome:", JSON.stringify(res.outcome));
        send("evolve:done", { applied: true });
        return { ok: true, ...res.outcome };
      }
      return { ok: false, error: res.reason };
    } catch (e: any) {
      console.error("[evolve] now error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // Round-trip self-test (no mic needed): synth a phrase, transcribe it back.
  ipcMain.handle("stt:selftest", async () => {
    try {
      if (!(await ensureVoice())) return { ok: false, error: "tts failed" };
      const phrase = "Brazil are winning the World Cup this year.";
      const wav = await voice.synth(phrase);
      if (!wav) return { ok: false, error: "synth failed" };
      if (!(await ensureListener())) return { ok: false, error: "stt failed" };
      const text = await listener.transcribe(wav);
      return { ok: true, original: phrase, transcribed: text };
    } catch (e: any) {
      console.error("[stt:selftest] error:", e?.message ?? e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // Settings (name / language / voice) — read + update, persisted to disk.
  ipcMain.handle("settings:get", () => ({ ...settings }));
  ipcMain.handle("settings:set", (_e, patch: Partial<Settings>) => {
    Object.assign(settings, patch);
    if ("language" in patch) agent.setLanguage(settings.language);
    persist();
    refreshReady(); // so a reload after naming/lang-change reflects it
    if ("agentName" in patch) void connectLobby(true); // (re)join the relay lobby under the new name
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

  // The live Match Room: a real match (today's, live/upcoming, or a replay)
  // drives a scoreboard, a real per-minute event feed, and agents watching along.
  const { Lobby } = await import("./lobby");
  let lobbyBusy = false;
  let runningLobby: any = null;
  // Today's matches as rooms (live / upcoming with kickoff / replay).
  ipcMain.handle("lobby:rooms", async () => {
    try {
      const { availableRooms } = await import("../../tools/football");
      return { ok: true, rooms: await availableRooms() };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  ipcMain.handle("lobby:start", async (_e, roomId?: string) => {
    if (lobbyBusy) return { ok: false, error: "match room already running" };
    lobbyBusy = true;
    const lobby = new Lobby(join(app.getPath("userData"), "lobby"), agent, settings.agentName ?? "You");
    runningLobby = lobby;
    try {
      await lobby.init((s: string) => send("lobby:status", s), roomId);
      await lobby.run((m) => send("lobby:message", m));
      // Save what was watched to the user's OWN agent so they can ask it to
      // summarize the match later in the My Agent tab.
      const recap = lobby.summary();
      if (recap) await agent.memory.save(recap, "fact").catch(() => {});
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    } finally {
      await lobby.close().catch(() => {});
      runningLobby = null;
      lobbyBusy = false;
    }
  });
  ipcMain.handle("lobby:stop", () => {
    if (runningLobby) runningLobby.stop();
    return { ok: true };
  });

  // ---- networked lobby: this agent joins a relay room and converses with
  // agents on OTHER machines/accounts. Connects once the agent has a name.
  const { RelayLobby } = await import("./relay-lobby");
  const RELAY_URL = process.env.KHOROS_RELAY ?? "ws://localhost:8787";
  const LOBBY_ROOM = process.env.KHOROS_ROOM ?? "lobby";
  const LOBBY_PASS = process.env.KHOROS_ROOM_PASS ?? "worldcup2026";
  const LOBBY_TOPIC = "World Cup 2026 is heating up — who's your pick to win it all, and why?";
  let relayLobby: any = null;
  async function connectLobby(reconnect = false): Promise<void> {
    if (!settings.agentName) return;
    if (relayLobby) {
      if (!reconnect) return;
      relayLobby.close?.(); // rejoin under the new name
      relayLobby = null;
    }
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
