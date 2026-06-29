// Bridge a tiny, safe API to the renderer (contextIsolation on).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("khoros", {
  ask: (text) => ipcRenderer.invoke("ask", text),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
  onProgress: (cb) => ipcRenderer.on("progress", (_e, p) => cb(p)),
  onReady: (cb) => ipcRenderer.on("ready", (_e, ctx) => cb(ctx)),
  // settings / identity
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  // slash-command backing
  memories: () => ipcRenderer.invoke("memories"),
  recall: (q) => ipcRenderer.invoke("recall", q),
  schedule: (when) => ipcRenderer.invoke("schedule", when),
  // lobby: the multi-agent show
  startLobby: () => ipcRenderer.invoke("lobby:start"),
  onLobbyStatus: (cb) => ipcRenderer.on("lobby:status", (_e, s) => cb(s)),
  onLobbyMessage: (cb) => ipcRenderer.on("lobby:message", (_e, m) => cb(m)),
});
