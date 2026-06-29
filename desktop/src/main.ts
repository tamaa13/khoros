/**
 * Khoros desktop — Electron main process. Runs the on-device Agent (the same core
 * the CLI uses) in Node and bridges it to a chat window over IPC. Nothing leaves
 * the machine: the LLM, memory embeddings, and tools all run locally.
 */
import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ESM output has no __dirname — recreate it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Persist memory in the OS app-data dir, not inside the (read-only) bundle.
// Set before the agent core is imported — config.ts reads KHOROS_DATA on load.
process.env.KHOROS_DATA = join(app.getPath("userData"), "memory");

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

  // Import the agent core after env + app are ready (and lazily, so the model
  // load doesn't block window creation).
  const { Agent } = await import("../../agent/loop");
  const agent = new Agent();

  send("status", "loading the on-device model… (first run downloads it once)");
  try {
    await agent.init({ onStatus: (s: string) => send("status", s) });
    send("ready", true);
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
