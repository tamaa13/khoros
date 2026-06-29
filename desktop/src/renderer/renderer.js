const thread = document.getElementById("thread");
const statusEl = document.getElementById("status");
const input = document.getElementById("input");
const send = document.getElementById("send");
const composer = document.getElementById("composer");

let ready = false;

function bubble(text, who, extra) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.textContent = text;
  if (extra) {
    const tag = document.createElement("span");
    tag.className = "badge";
    tag.textContent = extra;
    el.appendChild(tag);
  }
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

window.khoros.onStatus((s) => {
  statusEl.textContent = s;
});

window.khoros.onReady(() => {
  ready = true;
  statusEl.textContent = "ready — everything runs locally, no cloud.";
  statusEl.classList.add("ready");
  input.disabled = false;
  send.disabled = false;
  input.focus();
  bubble("Halo! Lagi rame nih World Cup 2026. Jagoan lo siapa?", "agent");
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ready) return;
  bubble(text, "me");
  input.value = "";
  input.disabled = true;
  send.disabled = true;
  const thinking = bubble("…", "agent thinking");

  const { reply, callback, tools } = await window.khoros.ask(text);
  thinking.remove();
  let extra = "";
  if (callback) extra = "↩ told you so";
  else if (tools && tools.length) extra = `🔧 ${tools.join(", ")}`;
  bubble(reply, "agent", extra);

  input.disabled = false;
  send.disabled = false;
  input.focus();
});
