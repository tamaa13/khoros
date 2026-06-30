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
  // on-device text-to-speech (QVAC) → returns base64 WAV
  speak: (text) => ipcRenderer.invoke("tts:speak", text),
  // on-device translation (QVAC Bergamot NMT)
  translate: (text, from, to) => ipcRenderer.invoke("translate", text, from, to),
  // on-device speech-to-text (QVAC Whisper)
  transcribe: (base64Wav) => ipcRenderer.invoke("transcribe", base64Wav),
  sttSelfTest: () => ipcRenderer.invoke("stt:selftest"),
  // slash-command backing
  memories: () => ipcRenderer.invoke("memories"),
  recall: (q) => ipcRenderer.invoke("recall", q),
  schedule: (when) => ipcRenderer.invoke("schedule", when),
  // in-process sparring demo (solo)
  startLobby: () => ipcRenderer.invoke("lobby:start"),
  onLobbyStatus: (cb) => ipcRenderer.on("lobby:status", (_e, s) => cb(s)),
  onLobbyMessage: (cb) => ipcRenderer.on("lobby:message", (_e, m) => cb(m)),
  // networked relay lobby (real agents, other devices)
  onLobbyEvent: (cb) => ipcRenderer.on("lobby:event", (_e, ev) => cb(ev)),
  matches: () => ipcRenderer.invoke("matches:list"),
  debate: (label) => ipcRenderer.invoke("lobby:debate", label),
  result: (text) => ipcRenderer.invoke("lobby:result", text),
});
