// Bridge a tiny, safe API to the renderer (contextIsolation on).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("khoros", {
  ask: (text) => ipcRenderer.invoke("ask", text),
  // proactive agent messages (e.g. "watched the match for you" recaps)
  onNotify: (cb) => ipcRenderer.on("chat:notify", (_e, p) => cb(p)),
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
  // on-device image generation (QVAC FLUX.2) → base64 PNG
  imagine: (prompt) => ipcRenderer.invoke("imagine", prompt),
  onImagineProgress: (cb) => ipcRenderer.on("imagine:progress", (_e, p) => cb(p)),
  // on-device speech-to-text (QVAC Whisper)
  transcribe: (base64Wav) => ipcRenderer.invoke("transcribe", base64Wav),
  sttSelfTest: () => ipcRenderer.invoke("stt:selftest"),
  // on-device OCR (QVAC) — share a photo, the agent reads the text in it
  ocrPick: () => ipcRenderer.invoke("ocr:pick"),
  ocrRead: (path) => ipcRenderer.invoke("ocr:read", path),
  // on-device LoRA fine-tune (QVAC) — the "evolve" layer
  finetuneSelfTest: () => ipcRenderer.invoke("finetune:selftest"),
  finetuneApplyTest: (prompt) => ipcRenderer.invoke("finetune:applytest", prompt),
  onFinetuneProgress: (cb) => ipcRenderer.on("finetune:progress", (_e, p) => cb(p)),
  evolveStatus: () => ipcRenderer.invoke("evolve:status"),
  evolveNow: () => ipcRenderer.invoke("evolve:now"),
  onEvolveDone: (cb) => ipcRenderer.on("evolve:done", (_e, p) => cb(p)),
  // slash-command backing
  memories: () => ipcRenderer.invoke("memories"),
  recall: (q) => ipcRenderer.invoke("recall", q),
  schedule: (when) => ipcRenderer.invoke("schedule", when),
  // live match room (real match → scoreboard + event feed + agents)
  lobbyRooms: () => ipcRenderer.invoke("lobby:rooms"),
  startLobby: (roomId, fromIndex) => ipcRenderer.invoke("lobby:start", roomId, fromIndex),
  stopLobby: () => ipcRenderer.invoke("lobby:stop"),
  onLobbyStatus: (cb) => ipcRenderer.on("lobby:status", (_e, s) => cb(s)),
  onLobbyMessage: (cb) => ipcRenderer.on("lobby:message", (_e, m) => cb(m)),
  // networked relay lobby (real agents, other devices)
  onLobbyEvent: (cb) => ipcRenderer.on("lobby:event", (_e, ev) => cb(ev)),
  // the in-process lounge auto-discussion runs while the Lobby tab is open
  loungeActive: (on) => ipcRenderer.invoke("lounge:active", on),
  matches: () => ipcRenderer.invoke("matches:list"),
  debate: (label) => ipcRenderer.invoke("lobby:debate", label),
  result: (text) => ipcRenderer.invoke("lobby:result", text),
});
