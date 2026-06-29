const thread = document.getElementById("thread");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const pill = document.getElementById("pill");
const pillText = document.getElementById("pillText");
const input = document.getElementById("input");
const send = document.getElementById("send");
const composer = document.getElementById("composer");

let ready = false;

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
  input.focus();
  addMessage("Halo! Lagi rame nih World Cup 2026. Jagoan lo siapa?", "agent");
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
