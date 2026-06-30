// ---------- elements ----------
const onboarding = document.getElementById("onboarding");
const loadingView = document.getElementById("loadingView");
const loadingStatus = document.getElementById("loadingStatus");
const nameView = document.getElementById("nameView");
const nameInput = document.getElementById("nameInput");
const app = document.getElementById("app");
const agentNameChip = document.getElementById("agentName");
const pill = document.getElementById("pill");
const pillText = document.getElementById("pillText");

const tabAgent = document.getElementById("tabAgent");
const tabLobby = document.getElementById("tabLobby");
const agentPanel = document.getElementById("agentPanel");
const lobbyPanel = document.getElementById("lobbyPanel");
const thread = document.getElementById("thread");
const lobbyBtn = document.getElementById("lobbyBtn");
const presenceList = document.getElementById("presenceList");
const lobbyIntro = document.getElementById("lobbyIntro");
// match room
const scoreboard = document.getElementById("scoreboard");
const sbHomeFlag = document.getElementById("sbHomeFlag");
const sbHomeName = document.getElementById("sbHomeName");
const sbAwayFlag = document.getElementById("sbAwayFlag");
const sbAwayName = document.getElementById("sbAwayName");
const sbScore = document.getElementById("sbScore");
const sbMin = document.getElementById("sbMin");
const matchRoom = document.getElementById("matchRoom");
const feedCol = document.getElementById("feedCol");
const agentCol = document.getElementById("agentCol");

const composer = document.getElementById("composer");
const input = document.getElementById("input");
const send = document.getElementById("send");
const micBtn = document.getElementById("mic");

// image preview (lightbox)
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
let lightboxSrc = "";
function openLightbox(src, caption) {
  lightboxSrc = src;
  lightboxImg.src = src;
  lightboxImg.alt = caption || "preview";
  lightbox.hidden = false;
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = "";
}
if (lightbox) {
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxSave").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = lightboxSrc;
    a.download = "khoros-image.png";
    a.click();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closeLightbox(); });
}

let ready = false;
let lobbyRunning = false;
let voiceOn = false;

// live fine-tune progress (loss dropping) — updates a single line
let ftLine = null;
if (window.khoros.onFinetuneProgress) {
  window.khoros.onFinetuneProgress((p) => {
    const txt = `training… epoch ${p.epoch} step ${p.step} · loss ${p.loss != null ? p.loss.toFixed(3) : "?"}${p.etaSec ? ` · eta ${p.etaSec}s` : ""}`;
    if (!ftLine) {
      ftLine = document.createElement("div");
      ftLine.className = "sys";
      thread.appendChild(ftLine);
    }
    ftLine.textContent = txt;
    thread.scrollTop = thread.scrollHeight;
  });
}

// On-device TTS: synth the reply in main, play the WAV here. Never throws.
async function speakReply(text) {
  if (!voiceOn || !text) return;
  try {
    const r = await window.khoros.speak(text);
    if (r && r.ok && r.wav) {
      const audio = new Audio("data:audio/wav;base64," + r.wav);
      audio.play().catch(() => {});
    }
  } catch {}
}

// ---------- model loading + onboarding ----------
window.khoros.onStatus((s) => {
  if (loadingStatus) loadingStatus.textContent = s;
});

window.khoros.onReady((ctx) => {
  ready = true;
  if (ctx && ctx.needsName) {
    loadingView.hidden = true;
    nameView.hidden = false;
    nameInput.focus();
  } else {
    enterApp(ctx && ctx.name ? ctx.name : "you");
  }
});

nameView.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (nameInput.value || "").trim() || "you";
  try {
    await window.khoros.setSettings({ agentName: name });
  } catch {}
  enterApp(name);
});

function enterApp(name) {
  onboarding.hidden = true;
  app.hidden = false;
  setAgentName(name);
  pill.classList.add("live");
  pillText.textContent = "on-device · live";
  input.disabled = false;
  send.disabled = false;
  input.focus();
  addMessage(thread, "Halo! World Cup 2026 lagi panas. Who's your team? (type /help for commands)", "agent");
  window.khoros.getSettings().then((s) => {
    voiceOn = Boolean(s && s.voice);
  }).catch(() => {});
  // surface the evolve state (memory-only vs evolved voice applied)
  if (window.khoros.evolveStatus) {
    window.khoros.evolveStatus().then((st) => {
      if (st && st.applied) addSystem(thread, "🧬 Running your evolved voice (fine-tuned on your takes).");
    }).catch(() => {});
  }
}
if (window.khoros.onEvolveDone) {
  window.khoros.onEvolveDone(() => addSystem(thread, "🧬 Your agent just evolved on your takes — your new voice applies next launch."));
}
// live /imagine progress (model load %, then sampling step X/Y) — one updating line
let imgLine = null;
if (window.khoros.onImagineProgress) {
  window.khoros.onImagineProgress((p) => {
    const txt = p.phase === "load" ? `loading the painter… ${Math.round(p.pct || 0)}%` : `painting… step ${p.step}/${p.total}`;
    if (!imgLine) { imgLine = document.createElement("div"); imgLine.className = "sys"; thread.appendChild(imgLine); }
    imgLine.textContent = txt;
    thread.scrollTop = thread.scrollHeight;
  });
}

function setAgentName(name) {
  agentNameChip.textContent = name;
}

// ---------- tabs ----------
function switchTab(which) {
  const agent = which === "agent";
  tabAgent.classList.toggle("is-active", agent);
  tabLobby.classList.toggle("is-active", !agent);
  agentPanel.hidden = !agent;
  lobbyPanel.hidden = agent;
  composer.style.visibility = agent ? "visible" : "hidden";
}
tabAgent.addEventListener("click", () => switchTab("agent"));
tabLobby.addEventListener("click", () => switchTab("lobby"));

// ---------- message rendering ----------
function scrollDown(el) {
  el.scrollTop = el.scrollHeight;
}

function makeAvatar(glyph) {
  const a = document.createElement("div");
  a.className = "avatar";
  a.textContent = glyph || "⚽";
  return a;
}

// who: "me" | "agent"; badge: { kind, label } | null; name: optional speaker caption
function addMessage(threadEl, text, who, badge, name, glyph) {
  const row = document.createElement("div");
  row.className = `row ${who}`;
  if (who !== "me") row.appendChild(makeAvatar(glyph));

  const col = document.createElement("div");
  col.className = "col";
  if (name) {
    const cap = document.createElement("div");
    cap.className = "caption";
    cap.textContent = name;
    col.appendChild(cap);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const t = document.createElement("div");
  t.textContent = text;
  bubble.appendChild(t);
  if (badge) {
    const b = document.createElement("span");
    b.className = `badge ${badge.kind}`;
    b.textContent = badge.label;
    bubble.appendChild(b);
  }
  col.appendChild(bubble);
  row.appendChild(col);
  threadEl.appendChild(row);
  scrollDown(threadEl);
  return row;
}

function addSystem(threadEl, text) {
  const el = document.createElement("div");
  el.className = "sys";
  el.textContent = text;
  threadEl.appendChild(el);
  scrollDown(threadEl);
  return el; // returned so a "…loading" line can be replaced with the result
}

// Render a generated image (base64 PNG) as an agent message.
function addImage(threadEl, base64, caption) {
  const row = document.createElement("div");
  row.className = "row agent";
  row.appendChild(makeAvatar("🎨"));
  const col = document.createElement("div");
  col.className = "col";
  const bubble = document.createElement("div");
  bubble.className = "bubble img";
  const img = document.createElement("img");
  img.src = "data:image/png;base64," + base64;
  img.alt = caption || "generated image";
  img.style.cursor = "zoom-in";
  img.title = "click to preview";
  img.addEventListener("click", () => openLightbox(img.src, caption));
  bubble.appendChild(img);
  if (caption) {
    const c = document.createElement("div");
    c.className = "img-caption";
    c.textContent = caption;
    bubble.appendChild(c);
  }
  col.appendChild(bubble);
  row.appendChild(col);
  threadEl.appendChild(row);
  scrollDown(threadEl);
  return row;
}

function addTyping(threadEl) {
  const row = document.createElement("div");
  row.className = "row agent";
  row.appendChild(makeAvatar("⚽"));
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  for (let i = 0; i < 3; i++) bubble.appendChild(document.createElement("span"));
  row.appendChild(bubble);
  threadEl.appendChild(row);
  scrollDown(threadEl);
  return row;
}

// ---------- voice input (on-device STT) ----------
function encodeWav(float32, sampleRate) {
  const len = float32.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); w(8, "WAVE"); w(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); w(36, "data"); view.setUint32(40, len * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) { const s = Math.max(-1, Math.min(1, float32[i])); view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Uint8Array(buf);
}
function u8ToBase64(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }

let mic = { recording: false, ctx: null, stream: null, node: null, chunks: [], rate: 16000 };
let micLine = null; // one transient status line (listening → transcribing → gone)
async function toggleMic() {
  if (mic.recording) return stopMic();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    // Whisper wants 16 kHz mono — capture at exactly that so it isn't fed
    // 48 kHz audio (which it mis-reads as 3x-fast garbage → "♪♪" hallucinations).
    const ctx = new AudioContext({ sampleRate: 16000 });
    const srcNode = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0; // route through a muted node so it processes without echo
    mic = { recording: true, ctx, stream, node, chunks: [], rate: ctx.sampleRate };
    node.onaudioprocess = (e) => mic.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    srcNode.connect(node); node.connect(mute); mute.connect(ctx.destination);
    micBtn.classList.add("recording"); micBtn.textContent = "■";
    micLine = addSystem(thread, "🎤 listening… tap ■ to stop");
  } catch (e) { addSystem(thread, "mic unavailable: " + (e && e.message ? e.message : e)); }
}
async function stopMic() {
  const { ctx, stream, node, chunks, rate } = mic;
  mic.recording = false;
  micBtn.classList.remove("recording"); micBtn.textContent = "🎤";
  try { node.disconnect(); stream.getTracks().forEach((t) => t.stop()); await ctx.close(); } catch {}
  const len = chunks.reduce((a, c) => a + c.length, 0);
  if (len < rate * 0.3) {
    if (micLine) { micLine.textContent = "(too short — try again)"; setTimeout(() => { if (micLine) { micLine.remove(); micLine = null; } }, 1500); }
    return;
  }
  const all = new Float32Array(len);
  let off = 0; for (const c of chunks) { all.set(c, off); off += c.length; }
  if (micLine) micLine.textContent = "…transcribing (on-device)";
  const r = await window.khoros.transcribe(u8ToBase64(encodeWav(all, rate)));
  if (micLine) { micLine.remove(); micLine = null; }
  // Transcript lands in the input (the user sees + edits + sends it) — no clutter.
  if (r && r.ok && r.text) { input.value = r.text; input.focus(); }
  else addSystem(thread, `transcribe failed: ${r && r.error ? r.error : "unknown"}`);
}
if (micBtn) micBtn.addEventListener("click", toggleMic);

// ---------- slash commands ----------
const HELP = [
  "/help — this list",
  "/schedule [recent] — World Cup fixtures or results",
  "/rooms — live match rooms (coming soon)",
  "/lobby — open the lobby",
  "/name <name> — rename your agent",
  "/language <lang> — reply language (e.g. /language Indonesian, /language English)",
  "/voice on|off — spoken replies (on-device TTS)",
  "/imagine <prompt> — generate an image on-device (Stable Diffusion)",
  "/translate <text> — on-device translation (e.g. id→en); /translate es:en <text>",
  "/listen — voice input (on-device STT); /listen test — TTS→STT self-test",
  "/evolve — fine-tune your agent on your style (on-device LoRA; auto on capable devices)",
  "/memories — what your agent remembers",
  "/recall <query> — search memory",
  "/clear — clear this chat",
].join("\n");

async function runCommand(raw) {
  const parts = raw.slice(1).trim().split(/\s+/);
  const cmd = (parts.shift() || "").toLowerCase();
  const arg = parts.join(" ");
  switch (cmd) {
    case "help":
      addSystem(thread, HELP);
      break;
    case "clear":
      thread.innerHTML = "";
      break;
    case "lobby":
      switchTab("lobby");
      break;
    case "agent":
      switchTab("agent");
      break;
    case "name":
      if (!arg) return addSystem(thread, "Usage: /name <name>");
      await window.khoros.setSettings({ agentName: arg });
      setAgentName(arg);
      addSystem(thread, `You're now "${arg}".`);
      break;
    case "language":
    case "lang": {
      const v = arg || "English";
      const isEnglish = /^(en|english)$/i.test(v);
      await window.khoros.setSettings({ language: isEnglish ? "" : v });
      addSystem(thread, `Language set to ${isEnglish ? "English" : v}.`);
      break;
    }
    case "imagine":
    case "img": {
      if (!arg) return addSystem(thread, "Usage: /imagine <prompt>  (e.g. /imagine Brazil lifting the trophy)");
      imgLine = null;
      addSystem(thread, "…generating a celebration scene on-device (stylized art). For a real player photo, just ask me — e.g. \"foto Mbappe\".");
      const r = await window.khoros.imagine(arg);
      if (r && r.ok && r.png) addImage(thread, r.png, arg);
      else addSystem(thread, `imagine failed: ${r && r.error ? r.error : "unknown"}`);
      break;
    }
    case "translate":
    case "tr": {
      if (!arg) return addSystem(thread, "Usage: /translate <text>  (or /translate es:en <text>)");
      let from = "id", to = "en", text = arg;
      const m = arg.match(/^([a-z]{2}):([a-z]{2})\s+(.+)$/i);
      if (m) { from = m[1].toLowerCase(); to = m[2].toLowerCase(); text = m[3]; }
      const line = addSystem(thread, `…translating (${from}→${to}, on-device)`);
      const r = await window.khoros.translate(text, from, to);
      line.textContent = r && r.ok ? `${from}→${to}: ${r.text}` : `translate failed: ${r?.error ?? "unknown"}`;
      scrollDown(thread);
      break;
    }
    case "evolve":
    case "finetune": {
      if (/^now$/i.test(arg)) {
        ftLine = null;
        addSystem(thread, "…tuning your agent on your own model now (watch the loss drop)");
        const r = await window.khoros.evolveNow();
        addSystem(thread, r && r.ok
          ? `🧬 Evolved in ${Math.round((r.elapsedMs || 0) / 1000)}s — loss ${r.firstLoss != null ? r.firstLoss.toFixed(3) : "?"} → ${r.finalLoss != null ? r.finalLoss.toFixed(3) : "?"} (${r.status}). Restart to run your new voice.`
          : `evolve failed: ${r && r.error ? r.error : "unknown"}`);
        break;
      }
      if (/^status$/i.test(arg)) {
        const st = await window.khoros.evolveStatus();
        if (!st) { addSystem(thread, "evolve status unavailable"); break; }
        addSystem(thread, st.cap && st.cap.canEvolve
          ? `Evolve: ${st.applied ? "evolved voice ACTIVE" : "memory-only (no adapter yet)"} · ${st.newTakes} new takes (auto tune-up at ${st.ready ? "ready" : st.reason}) · ${st.total} total · RAM ${st.cap.ramGB ? st.cap.ramGB.toFixed(1) : "?"}GB`
          : `Evolve: OFF — ${st.cap ? st.cap.reason : "memory-only"}. Memory personalization stays on.`);
        break;
      }
      if (/^apply$/i.test(arg)) {
        addSystem(thread, "…sampling base vs tuned (proving the adapter changes the agent)");
        const r = await window.khoros.finetuneApplyTest();
        if (r && r.ok) {
          addSystem(thread, `Q: ${r.prompt}`);
          addSystem(thread, `BASE (no adapter):\n${r.base}`);
          addSystem(thread, `TUNED (your LoRA):\n${r.tuned}`);
        } else addSystem(thread, `apply test failed: ${r && r.error ? r.error : "unknown"}`);
        break;
      }
      ftLine = null;
      addSystem(thread, "…fine-tuning your agent on-device (this trains a small LoRA — watch the loss drop)");
      const r = await window.khoros.finetuneSelfTest();
      if (r && r.skipped) addSystem(thread, `Evolve skipped: ${r.reason} (RAM ${r.ramGB ? r.ramGB.toFixed(1) : "?"}GB). Memory-only personalization stays on.`);
      else if (r && r.ok) addSystem(thread, `✅ Evolve done in ${Math.round((r.elapsedMs || 0) / 1000)}s — loss ${r.firstLoss != null ? r.firstLoss.toFixed(3) : "?"} → ${r.finalLoss != null ? r.finalLoss.toFixed(3) : "?"} (status ${r.status}; adapter: ${(r.adapterFiles || []).join(", ") || "—"}).`);
      else addSystem(thread, `evolve failed: ${r && r.error ? r.error : "unknown"}`);
      break;
    }
    case "listen": {
      if (/^test$/i.test(arg)) {
        const line = addSystem(thread, "…running TTS→STT self-test (on-device)");
        const r = await window.khoros.sttSelfTest();
        line.textContent = r && r.ok ? `STT self-test (on-device):\n  said:  ${r.original}\n  heard: ${r.transcribed}` : `self-test failed: ${r && r.error ? r.error : "unknown"}`;
        scrollDown(thread);
      } else {
        toggleMic();
      }
      break;
    }
    case "voice": {
      voiceOn = /^(on|true|1)$/i.test(arg) ? true : /^(off|false|0)$/i.test(arg) ? false : !voiceOn;
      await window.khoros.setSettings({ voice: voiceOn });
      addSystem(thread, voiceOn ? "🔊 Voice on — I'll speak my replies (loading the voice model the first time…)." : "🔇 Voice off.");
      if (voiceOn) speakReply("Voice on.");
      break;
    }
    case "memories": {
      const m = await window.khoros.memories();
      addSystem(thread, m.length ? m.map((x) => `• (${x.kind}) ${x.text}`).join("\n") : "No memories yet — tell me your takes!");
      break;
    }
    case "recall": {
      if (!arg) return addSystem(thread, "Usage: /recall <query>");
      const r = await window.khoros.recall(arg);
      addSystem(thread, r.length ? r.map((x) => `• ${x.text}  (${x.score.toFixed(2)})`).join("\n") : "Nothing relevant recalled.");
      break;
    }
    case "schedule": {
      const when = /recent|result|hasil|past/i.test(arg) ? "recent" : "upcoming";
      const line = addSystem(thread, "…fetching World Cup data");
      const s = await window.khoros.schedule(when);
      line.textContent = s;
      scrollDown(thread);
      break;
    }
    case "rooms":
      addSystem(thread, "Live match rooms are coming. For now, open the Lobby tab to watch the show.");
      break;
    default:
      addSystem(thread, `Unknown command: /${cmd}. Type /help.`);
  }
}

// ---------- composer (My Agent) ----------
composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ready) return;
  switchTab("agent");
  input.value = "";

  if (text.startsWith("/")) {
    addMessage(thread, text, "me");
    input.disabled = true;
    send.disabled = true;
    try {
      await runCommand(text);
    } catch (err) {
      addSystem(thread, `command error: ${err?.message ?? err}`);
    }
    input.disabled = false;
    send.disabled = false;
    input.focus();
    return;
  }

  addMessage(thread, text, "me");
  input.disabled = true;
  send.disabled = true;
  const typing = addTyping(thread);

  let result;
  try {
    result = await window.khoros.ask(text);
  } catch (err) {
    result = { reply: `(error: ${err?.message ?? err})`, callback: null, tools: [] };
  }
  typing.remove();
  let badge = null;
  if (result.callback) badge = { kind: "gold", label: "↩ told you so" };
  else if (result.tools && result.tools.length) badge = { kind: "tool", label: `🔧 ${result.tools.join(", ")}` };
  addMessage(thread, result.reply, "agent", badge);
  if (result.image) addImage(thread, result.image, result.imageCaption || "");
  speakReply(result.reply);

  input.disabled = false;
  send.disabled = false;
  input.focus();
});

// ---------- live match room ----------
const SPEAKERS = {
  Dewi: { glyph: "🟢", cls: "spk-dewi" },
  Rian: { glyph: "🔵", cls: "spk-rian" },
  Budi: { glyph: "🟡", cls: "spk-budi" },
};

function updateScoreboard(m) {
  if (scoreboard.hidden) scoreboard.hidden = false;
  if (m.homeFlag) sbHomeFlag.textContent = m.homeFlag;
  if (m.awayFlag) sbAwayFlag.textContent = m.awayFlag;
  if (m.home) sbHomeName.textContent = m.home;
  if (m.away) sbAwayName.textContent = m.away;
  sbScore.textContent = `${m.homeScore ?? 0}–${m.awayScore ?? 0}`;
  const min = m.minute || "";
  sbMin.textContent = m.live ? `🔴 ${min || "LIVE"}` : min ? `▶ ${min}` : "▶ replay";
  sbMin.classList.toggle("is-live", !!m.live);
}

function addFeedRow(m) {
  const row = document.createElement("div");
  row.className = "feed-row" + (m.key ? " is-key" : "");
  row.innerHTML = `<span class="feed-clock"></span><span class="feed-emoji"></span><span class="feed-text"></span>`;
  row.querySelector(".feed-clock").textContent = m.clock || "";
  row.querySelector(".feed-emoji").textContent = m.emoji || "•";
  row.querySelector(".feed-text").textContent = m.text || "";
  feedCol.appendChild(row);
  scrollDown(feedCol);
}

function addFeedNote(text) {
  const row = document.createElement("div");
  row.className = "feed-note";
  row.textContent = text;
  feedCol.appendChild(row);
  scrollDown(feedCol);
}

function addAgentRow(from, glyph, text, callback) {
  const row = document.createElement("div");
  const spk = SPEAKERS[from];
  row.className = "agent-row" + (spk && spk.cls ? " " + spk.cls : "");
  const g = glyph || (spk && spk.glyph) || "⚽";
  row.innerHTML = `<span class="agent-glyph"></span><div class="agent-bubble"><span class="agent-name"></span><span class="agent-text"></span></div>`;
  row.querySelector(".agent-glyph").textContent = g;
  row.querySelector(".agent-name").textContent = from || "";
  row.querySelector(".agent-text").textContent = text || "";
  if (callback) {
    const b = document.createElement("span");
    b.className = "agent-badge";
    b.textContent = "↩ told you so";
    row.querySelector(".agent-bubble").appendChild(b);
  }
  agentCol.appendChild(row);
  scrollDown(agentCol);
}

// scoreboard + feed go left, agents go right
function addLobbyMessage(m) {
  if (!m) return;
  if (m.kind === "scoreboard") return updateScoreboard(m);
  if (m.kind === "feed") return addFeedRow(m);
  if (m.kind === "agent") return addAgentRow(m.from, m.emoji, m.text, m.callback);
  if (m.kind === "system") return addFeedNote(m.text);
}
window.khoros.onLobbyMessage((m) => addLobbyMessage(m));

// networked relay lobby (agents on OTHER devices) → into the Agents column
window.khoros.onLobbyEvent((ev) => {
  if (!ev) return;
  if (ev.type === "presence") {
    const peers = ev.peers || [];
    presenceList.textContent = peers.length > 1 ? `${peers.join(" · ")} (${peers.length})` : "just you";
  } else if (ev.type === "message") {
    addAgentRow(ev.from || "agent", ev.self ? "🟢" : "🎙️", ev.text, ev.callback);
  } else if (ev.type === "status") {
    presenceList.textContent = ev.text;
  }
});

// start / stop the match room
lobbyBtn.addEventListener("click", async () => {
  if (!ready) return;
  if (lobbyRunning) {
    lobbyBtn.disabled = true;
    await window.khoros.stopLobby().catch(() => {});
    return; // the start promise resolves below and resets the button
  }
  lobbyRunning = true;
  if (lobbyIntro) lobbyIntro.hidden = true;
  matchRoom.hidden = false;
  feedCol.innerHTML = "";
  agentCol.innerHTML = "";
  lobbyBtn.textContent = "■ Stop";
  let res;
  try {
    res = await window.khoros.startLobby();
  } catch (err) {
    res = { ok: false, error: err?.message ?? String(err) };
  }
  if (!res || !res.ok) addFeedNote(`match room error: ${res?.error ?? "unknown"}`);
  lobbyBtn.disabled = false;
  lobbyBtn.textContent = "▶ Tonton lagi";
  lobbyRunning = false;
});
