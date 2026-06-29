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
const lobbyThread = document.getElementById("lobbyThread");
const lobbyBtn = document.getElementById("lobbyBtn");
const presenceList = document.getElementById("presenceList");
const lobbyIntro = document.getElementById("lobbyIntro");

const composer = document.getElementById("composer");
const input = document.getElementById("input");
const send = document.getElementById("send");

let ready = false;
let lobbyRunning = false;

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

// ---------- slash commands ----------
const HELP = [
  "/help — this list",
  "/schedule [recent] — World Cup fixtures or results",
  "/rooms — live match rooms (coming soon)",
  "/lobby — open the lobby",
  "/name <name> — rename your agent",
  "/language <lang> — reply language (e.g. /language Indonesian, /language English)",
  "/voice on|off — spoken replies (coming soon)",
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
    case "voice":
      addSystem(thread, "Voice replies are coming soon.");
      break;
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
      addSystem(thread, "…fetching World Cup data");
      const s = await window.khoros.schedule(when);
      addSystem(thread, s);
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

  input.disabled = false;
  send.disabled = false;
  input.focus();
});

// ---------- lobby ----------
const SPEAKERS = {
  Dewi: { glyph: "🟢", cls: "spk-dewi" },
  Rian: { glyph: "🔵", cls: "spk-rian" },
  Commentator: { glyph: "🎙️", cls: "spk-commentator" },
};

function addLobbyMessage(m) {
  if (m.kind === "system") return addSystem(lobbyThread, m.text);
  const spk = SPEAKERS[m.from] || { glyph: "⚽", cls: "" };
  const badge = m.callback ? { kind: "gold", label: "↩ told you so" } : null;
  const row = addMessage(lobbyThread, m.text, "agent", badge, m.from, spk.glyph);
  if (spk.cls) row.classList.add(spk.cls);
  if (m.kind === "commentator") row.classList.add("is-commentator");
}

window.khoros.onLobbyMessage((m) => addLobbyMessage(m));

// ---------- networked relay lobby (real agents, other devices) ----------
function addRelayMessage(ev) {
  if (lobbyIntro) lobbyIntro.hidden = true;
  const badge = ev.callback ? { kind: "gold", label: "↩ told you so" } : null;
  if (ev.kind === "commentator") {
    const row = addMessage(lobbyThread, ev.text, "agent", badge, ev.from, "🎙️");
    row.classList.add("is-commentator");
  } else if (ev.self) {
    addMessage(lobbyThread, ev.text, "me"); // your own agent, right side
  } else {
    addMessage(lobbyThread, ev.text, "agent", badge, ev.from, "⚽");
  }
}

window.khoros.onLobbyEvent((ev) => {
  if (!ev) return;
  if (ev.type === "presence") {
    const peers = ev.peers || [];
    presenceList.textContent = peers.length > 1 ? `${peers.join(" · ")} (${peers.length})` : "just you — waiting for other agents…";
    if (peers.length >= 2 && lobbyIntro) lobbyIntro.hidden = true;
  } else if (ev.type === "message") {
    addRelayMessage(ev);
  } else if (ev.type === "status") {
    addSystem(lobbyThread, ev.text);
  }
});

lobbyBtn.addEventListener("click", async () => {
  if (lobbyRunning || !ready) return;
  lobbyRunning = true;
  lobbyBtn.disabled = true;
  lobbyBtn.textContent = "lobby running…";
  let res;
  try {
    res = await window.khoros.startLobby();
  } catch (err) {
    res = { ok: false, error: err?.message ?? String(err) };
  }
  if (!res || !res.ok) addSystem(lobbyThread, `lobby error: ${res?.error ?? "unknown"}`);
  else addSystem(lobbyThread, "— that's the Khoros lobby: the agent who called it took the victory lap. —");
  lobbyBtn.disabled = false;
  lobbyBtn.textContent = "▶ Run again";
  lobbyRunning = false;
});
