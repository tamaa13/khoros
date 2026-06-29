const thread = document.getElementById("thread");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const pill = document.getElementById("pill");
const pillText = document.getElementById("pillText");
const input = document.getElementById("input");
const send = document.getElementById("send");
const composer = document.getElementById("composer");
const lobbyBtn = document.getElementById("lobbyBtn");

let ready = false;
let lobbyRunning = false;

function scrollDown() {
  thread.scrollTop = thread.scrollHeight;
}

function makeAvatar() {
  const a = document.createElement("div");
  a.className = "avatar";
  a.textContent = "⚽";
  return a;
}

// who: "me" | "agent"; badge: { kind: "gold"|"tool", label } | null
function addMessage(text, who, badge) {
  const row = document.createElement("div");
  row.className = `row ${who}`;
  if (who === "agent") row.appendChild(makeAvatar());

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

  row.appendChild(bubble);
  thread.appendChild(row);
  scrollDown();
  return row;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "row agent";
  row.appendChild(makeAvatar());
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  for (let i = 0; i < 3; i++) bubble.appendChild(document.createElement("span"));
  row.appendChild(bubble);
  thread.appendChild(row);
  scrollDown();
  return row;
}

window.khoros.onStatus((s) => {
  if (loaderText) loaderText.textContent = s;
});

window.khoros.onReady(() => {
  ready = true;
  if (loader) loader.remove();
  pill.classList.add("live");
  pillText.textContent = "on-device · ready";
  input.disabled = false;
  send.disabled = false;
  lobbyBtn.disabled = false;
  input.focus();
  addMessage("Halo! Lagi rame nih World Cup 2026. Jagoan lo siapa?", "agent");
});

// ---------- the lobby (multi-agent show) ----------
const SPEAKERS = {
  Dewi: { avatar: "🟢", cls: "spk-dewi" },
  Rian: { avatar: "🔵", cls: "spk-rian" },
  Commentator: { avatar: "🎙️", cls: "spk-commentator" },
};

function addSystem(text) {
  const el = document.createElement("div");
  el.className = "sys";
  el.textContent = text;
  thread.appendChild(el);
  scrollDown();
}

function addLobbyMessage(m) {
  if (m.kind === "system") return addSystem(m.text);
  const spk = SPEAKERS[m.from] || { avatar: "⚽", cls: "" };
  const row = document.createElement("div");
  row.className = `row agent lobby ${spk.cls}`;

  const av = document.createElement("div");
  av.className = "avatar";
  av.textContent = spk.avatar;
  row.appendChild(av);

  const col = document.createElement("div");
  col.className = "col";
  const name = document.createElement("div");
  name.className = "name-label";
  name.textContent = m.from;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${m.kind === "commentator" ? "commentator" : ""}`;
  const t = document.createElement("div");
  t.textContent = m.text;
  bubble.appendChild(t);
  if (m.callback) {
    const b = document.createElement("span");
    b.className = "badge gold";
    b.textContent = "↩ told you so";
    bubble.appendChild(b);
  }
  col.appendChild(name);
  col.appendChild(bubble);
  row.appendChild(col);
  thread.appendChild(row);
  scrollDown();
}

window.khoros.onLobbyStatus((s) => {
  if (lobbyRunning) lobbyBtn.textContent = s;
});
window.khoros.onLobbyMessage((m) => addLobbyMessage(m));

lobbyBtn.addEventListener("click", async () => {
  if (lobbyRunning || !ready) return;
  lobbyRunning = true;
  lobbyBtn.disabled = true;
  input.disabled = true;
  send.disabled = true;
  addSystem("⚽ Lobby starting — two agents are about to argue, then the real result lands.");

  let res;
  try {
    res = await window.khoros.startLobby();
  } catch (err) {
    res = { ok: false, error: err?.message ?? String(err) };
  }
  if (!res || !res.ok) addSystem(`lobby error: ${res?.error ?? "unknown"}`);
  else addSystem("— that's the Khoros lobby: the agent who called it just took its victory lap. —");

  lobbyBtn.textContent = "▶ Lobby";
  lobbyBtn.disabled = false;
  input.disabled = false;
  send.disabled = false;
  lobbyRunning = false;
  input.focus();
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ready) return;

  addMessage(text, "me");
  input.value = "";
  input.disabled = true;
  send.disabled = true;
  const typing = addTyping();

  let result;
  try {
    result = await window.khoros.ask(text);
  } catch (err) {
    result = { reply: `(error: ${err?.message ?? err})`, callback: null, tools: [] };
  }
  typing.remove();

  const { reply, callback, tools } = result;
  let badge = null;
  if (callback) badge = { kind: "gold", label: "↩ told you so" };
  else if (tools && tools.length) badge = { kind: "tool", label: `🔧 ${tools.join(", ")}` };
  addMessage(reply, "agent", badge);

  input.disabled = false;
  send.disabled = false;
  input.focus();
});
