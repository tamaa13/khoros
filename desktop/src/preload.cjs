// Bridge a tiny, safe API to the renderer (contextIsolation on).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("khoros", {
  ask: (text) => ipcRenderer.invoke("ask", text),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
  onReady: (cb) => ipcRenderer.on("ready", () => cb()),
  // lobby: the multi-agent show
  startLobby: () => ipcRenderer.invoke("lobby:start"),
  onLobbyStatus: (cb) => ipcRenderer.on("lobby:status", (_e, s) => cb(s)),
  onLobbyMessage: (cb) => ipcRenderer.on("lobby:message", (_e, m) => cb(m)),
});
