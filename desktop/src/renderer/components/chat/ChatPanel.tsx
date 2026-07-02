import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search, Sparkles, X } from "lucide-react";
import { khoros } from "../../khoros";
import { useMic } from "../../hooks/useMic";
import { AgentGlyph } from "../Logo";
import { AgentBubble, ImageBubble, SystemLine, ToldYouSo, Typing, UserBubble, type ChatMsg } from "./Bubbles";
import { Composer } from "./Composer";

let uid = 0;
const CHAT_KEY = "khoros.chat.v1";

function loadMsgs(name: string): ChatMsg[] {
  try {
    const saved = localStorage.getItem(CHAT_KEY);
    if (saved) {
      const arr = JSON.parse(saved) as ChatMsg[];
      if (Array.isArray(arr) && arr.length) {
        uid = arr.reduce((m, x) => Math.max(m, x.id || 0), 0);
        return arr;
      }
    }
  } catch {
    /* fall through to the greeting */
  }
  return [{ id: ++uid, role: "agent", text: `Hey — I'm ${name}. World Cup's heating up. Who's your team? (type / for commands)` }];
}

export function ChatPanel({ name, onRename, voice, onVoiceChange, searchOpen, onCloseSearch }: { name: string; onRename: (n: string) => void; voice: boolean; onVoiceChange: (v: boolean) => void; searchOpen: boolean; onCloseSearch: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => loadMsgs(name));
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [gen, setGen] = useState<{ pct: number } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const voiceOn = useRef(voice);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mic = useMic(useCallback((t: string) => setInput(t), []));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    voiceOn.current = voice;
  }, [voice]);

  // The search row lives behind the header's 🔍 toggle; focus it when it opens
  // and drop the filter when it closes.
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
    else setSearch("");
  }, [searchOpen]);

  useEffect(() => {
    khoros.onImagineProgress((p) => {
      const pct = p.phase === "gen" && p.total ? Math.round(((p.step ?? 0) / p.total) * 100) : p.pct;
      if (typeof pct === "number") setGen({ pct });
    });
    // Proactive agent messages — e.g. the recap after it watched a match for you.
    khoros.onNotify((p) => {
      if (p?.text) {
        push({ role: "agent", text: p.text });
        void speakReply(p.text);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First paint jumps straight to the latest message (smooth-scrolling through
  // 200 restored messages looks silly); everything after eases.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: scrolledOnce.current ? "smooth" : "auto" });
    scrolledOnce.current = true;
  }, [msgs, typing, gen]);

  // Persist the thread so it survives app restarts (cap the tail to stay small).
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-200)));
    } catch {
      /* storage full — ignore */
    }
  }, [msgs]);

  const shown = useMemo(
    () => (search.trim() ? msgs.filter((m) => `${m.text} ${m.caption ?? ""}`.toLowerCase().includes(search.toLowerCase())) : msgs),
    [msgs, search],
  );

  const push = useCallback((m: Omit<ChatMsg, "id">) => setMsgs((x) => [...x, { ...m, id: ++uid }]), []);
  const addSystem = (text: string) => push({ role: "system", text });

  const speakReply = useCallback(async (text: string) => {
    if (!voiceOn.current || !text) return;
    const r = await khoros.speak(text);
    if (r?.ok && r.wav) new Audio(`data:audio/wav;base64,${r.wav}`).play().catch(() => {});
  }, []);

  const runCommand = useCallback(
    async (raw: string) => {
      const parts = raw.slice(1).trim().split(/\s+/);
      const cmd = (parts.shift() || "").toLowerCase();
      const arg = parts.join(" ");
      switch (cmd) {
        case "help":
          return addSystem(
            ["/imagine <prompt> — generate an image", "/voice on|off — spoken replies", "/translate <text> — on-device translation", "/watch <team vs team> — I'll watch it and report back", "/recap <team> — recap a finished match", "/listen — voice input (/listen test = self-test)", "/read <path> — read text from a photo (or use 📎)", "/evolve [now|status|apply] — fine-tune on your style", "/memories · /recall <q> — memory", "/schedule [recent] — fixtures/results", "/name <name> · /language <lang>", "/lobby · /clear"].join("\n"),
          );
        case "clear":
          return setMsgs([]);
        case "name":
          if (!arg) return addSystem("Usage: /name <name>");
          onRename(arg);
          return addSystem(`You're now "${arg}".`);
        case "language":
        case "lang": {
          const v = arg || "English";
          const en = /^(en|english)$/i.test(v);
          await khoros.setSettings({ language: en ? "" : v });
          return addSystem(`Language set to ${en ? "English" : v}.`);
        }
        case "imagine":
        case "img": {
          if (!arg) return addSystem('Usage: /imagine <prompt>  (e.g. /imagine Mexico lifting the trophy). For a real player photo, just ask me — e.g. "photo of Mbappe".');
          setGen({ pct: 0 });
          const r = await khoros.imagine(arg);
          setGen(null);
          if (r?.ok && r.png) push({ role: "agent", text: "", image: r.png, caption: arg });
          else addSystem(`imagine failed: ${r?.error ?? "unknown"}`);
          return;
        }
        case "translate":
        case "tr": {
          if (!arg) return addSystem("Usage: /translate <text>  (or /translate es:en <text>)");
          let from = "id", to = "en", text = arg;
          const m = arg.match(/^([a-z]{2}):([a-z]{2})\s+(.+)$/i);
          if (m) {
            from = m[1]!.toLowerCase();
            to = m[2]!.toLowerCase();
            text = m[3]!;
          }
          const r = await khoros.translate(text, from, to);
          return push({ role: "agent", text: r?.ok ? `(${from}→${to}) ${r.text}` : `translate failed: ${r?.error ?? "unknown"}` });
        }
        case "evolve":
        case "finetune": {
          if (/^status$/i.test(arg)) {
            const st = (await khoros.evolveStatus()) as Record<string, any>;
            return addSystem(st?.cap?.canEvolve ? `Evolve: ${st.applied ? "evolved voice ACTIVE" : "memory-only"} · ${st.newTakes} new takes · ${st.total} total` : `Evolve: memory-only — ${st?.cap?.reason ?? ""}`);
          }
          if (/^now$/i.test(arg)) {
            addSystem("…tuning your agent on your own model (watch the loss drop)");
            const r = (await khoros.evolveNow()) as Record<string, any>;
            return addSystem(r?.ok ? `🧬 Evolved — loss ${r.firstLoss?.toFixed?.(3) ?? "?"} → ${r.finalLoss?.toFixed?.(3) ?? "?"}. Restart for your new voice.` : `evolve failed: ${r?.error ?? "unknown"}`);
          }
          addSystem("…fine-tuning a small LoRA on-device (watch the loss drop)");
          const r = (await khoros.finetuneSelfTest()) as Record<string, any>;
          return addSystem(r?.skipped ? `Evolve skipped: ${r.reason}. Memory personalization stays on.` : r?.ok ? `✅ Evolved — loss ${r.firstLoss?.toFixed?.(3) ?? "?"} → ${r.finalLoss?.toFixed?.(3) ?? "?"}.` : `evolve failed: ${r?.error ?? "unknown"}`);
        }
        case "watch": {
          if (!arg) return addSystem("Usage: /watch <team vs team> — I'll follow the match and report back when it ends.");
          setTyping(true);
          const r = await khoros.watchMatch(arg).catch(() => null);
          setTyping(false);
          if (!r?.ok) return addSystem(`couldn't set that up: ${r?.error ?? "unknown"}`);
          push({ role: "agent", text: r.reply ?? "On it — I'll report back at full time." });
          if (r.reply) speakReply(r.reply);
          return;
        }
        case "recap": {
          if (!arg) return addSystem("Usage: /recap <team> — recap of a finished match.");
          setTyping(true);
          const r = await khoros.recapMatch(arg).catch(() => null);
          setTyping(false);
          if (!r?.ok) return addSystem(`no recap: ${r?.error ?? "unknown"}`);
          push({ role: "agent", text: r.reply ?? "" });
          if (r.reply) speakReply(r.reply);
          return;
        }
        case "read": {
          if (!arg) return addSystem("Usage: /read <path-to-image> — I'll read the text in it (on-device OCR).");
          const r = await khoros.ocrRead(arg.replace(/^~/, ""));
          return addSystem(r?.ok ? (r.text?.trim() ? `📖 I read:\n${r.text}` : "No readable text found.") : `read failed: ${r?.error ?? "unknown"}`);
        }
        case "listen":
          if (/^test$/i.test(arg)) {
            const r = (await khoros.sttSelfTest()) as Record<string, any>;
            return addSystem(r?.ok ? `STT self-test:\n  said:  ${r.original}\n  heard: ${r.transcribed}` : `self-test failed: ${r?.error ?? "unknown"}`);
          }
          mic.toggle();
          return;
        case "voice": {
          const next = /^(on|true|1)$/i.test(arg) ? true : /^(off|false|0)$/i.test(arg) ? false : !voiceOn.current;
          voiceOn.current = next;
          onVoiceChange(next);
          addSystem(next ? "🔊 Voice on — I'll speak my replies." : "🔇 Voice off.");
          if (next) speakReply("Voice on.");
          return;
        }
        case "memories": {
          const m = await khoros.memories();
          return addSystem(m.length ? m.map((x) => `• (${x.kind}) ${x.text}`).join("\n") : "No memories yet — tell me your takes!");
        }
        case "recall": {
          if (!arg) return addSystem("Usage: /recall <query>");
          const r = await khoros.recall(arg);
          return addSystem(r.length ? r.map((x) => `• ${x.text}  (${x.score.toFixed(2)})`).join("\n") : "Nothing relevant recalled.");
        }
        case "schedule": {
          const when = /recent|result|past/i.test(arg) ? "recent" : "upcoming";
          const s = await khoros.schedule(when);
          return addSystem(String(s));
        }
        default:
          return addSystem(`Unknown command: /${cmd}. Type /help.`);
      }
    },
    [mic, onRename, push, speakReply, onVoiceChange],
  );

  // Share a photo: the agent reads the text in it (on-device OCR) and reacts —
  // match schedules, scoreboards, tickets, screenshots.
  const attachPhoto = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await khoros.ocrPick();
      if (r?.canceled) return;
      if (!r?.ok) return addSystem(`couldn't read that photo: ${r?.error ?? "unknown"}`);
      push({ role: "user", text: "", image: r.image });
      if (!r.text?.trim()) return addSystem("I couldn't find any readable text in that photo.");
      setTyping(true);
      const prompt = `I'm sharing a photo (${r.name ?? "image"}). The text in it reads:\n"""\n${r.text}\n"""\nTell me what this is and react to it briefly.`;
      const a = await khoros.ask(prompt).catch((e) => ({ reply: `(error: ${e?.message ?? e})` }) as Awaited<ReturnType<typeof khoros.ask>>);
      setTyping(false);
      push({ role: "agent", text: a.reply, tools: a.tools });
      speakReply(a.reply);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }, [busy, push, speakReply]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    push({ role: "user", text });
    setBusy(true);
    try {
      if (text.startsWith("/")) {
        await runCommand(text);
      } else {
        setTyping(true);
        const r = await khoros.ask(text).catch((e) => ({ reply: `(error: ${e?.message ?? e})` }) as Awaited<ReturnType<typeof khoros.ask>>);
        setTyping(false);
        if (r.callback) push({ role: "agent", text: r.reply, told: true });
        else push({ role: "agent", text: r.reply, tools: r.tools });
        if (r.image) push({ role: "agent", text: "", image: r.image, caption: r.imageCaption });
        speakReply(r.reply);
      }
    } catch (e) {
      setTyping(false);
      addSystem(`error: ${(e as Error)?.message ?? e}`);
    }
    setBusy(false);
  }, [busy, input, push, runCommand, speakReply]);

  const saveImage = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `khoros-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex h-full flex-col">
      {/* grid-rows 0fr→1fr animates the height, so the thread eases down
          instead of jumping when search opens */}
      <div className={`grid flex-shrink-0 transition-[grid-template-rows] duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] ${searchOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--c1f2128))] bg-[rgb(var(--c0c0d11))] px-4 py-[6px]">
            <Search className="h-[15px] w-[15px] flex-shrink-0 text-content-faint" strokeWidth={1.75} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onCloseSearch()}
              placeholder="Search this chat…"
              tabIndex={searchOpen ? 0 : -1}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-content outline-none placeholder:text-content-faint"
            />
            <button onClick={onCloseSearch} tabIndex={searchOpen ? 0 : -1} className="flex h-[28px] w-[28px] items-center justify-center rounded-md text-content-faint hover:text-content" aria-label="Close search">
              <X className="h-[14px] w-[14px]" />
            </button>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="kh-scroll flex flex-1 flex-col gap-[14px] overflow-y-auto px-4 pb-2 pt-[18px]">
        {search.trim() && shown.length === 0 && <div className="mt-8 text-center text-[12.5px] text-content-faint">No messages match “{search}”.</div>}
        {shown.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} image={m.image} />
          ) : m.role === "system" ? (
            <SystemLine key={m.id} text={m.text} />
          ) : m.told ? (
            <ToldYouSo key={m.id} text={m.text} />
          ) : m.image ? (
            <ImageBubble key={m.id} src={m.image} caption={m.caption} onOpen={setLightbox} />
          ) : (
            <AgentBubble key={m.id} text={m.text} tools={m.tools} />
          ),
        )}
        {gen && <GeneratingBubble pct={gen.pct} />}
        {typing && <Typing />}
      </div>

      <Composer value={input} onChange={setInput} onSubmit={submit} onPick={setInput} mic={mic.status} onMic={mic.toggle} onAttach={attachPhoto} disabled={busy && !input.startsWith("/")} name={name} />

      {lightbox && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="preview" className="max-h-[80%] max-w-full rounded-lg" />
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => saveImage(lightbox)} className="flex items-center gap-2 rounded-md border border-border bg-surface-1 px-4 py-2 text-sm text-content">
              <Download className="h-4 w-4" /> Save
            </button>
            <button onClick={() => setLightbox(null)} className="flex items-center gap-2 rounded-md border border-border bg-surface-1 px-4 py-2 text-sm text-content">
              <X className="h-4 w-4" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratingBubble({ pct }: { pct: number }) {
  return (
    <div className="flex items-end gap-[10px]">
      <AgentGlyph size={28} />
      <div className="w-[78%] overflow-hidden rounded-[16px_16px_16px_5px] border border-surface-3 bg-[rgb(var(--c181a20))]">
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-[13px] [background:repeating-linear-gradient(115deg,rgb(var(--c161820)),rgb(var(--c161820))_11px,rgb(var(--c121319))_11px,rgb(var(--c121319))_22px)]">
          <Sparkles className="h-[26px] w-[26px] animate-pulse text-gold" />
          <span className="text-[12px] tabular-nums text-content-muted">Generating{pct ? ` · ${pct}%` : "…"}</span>
          <span className="font-mono text-[10px] text-[rgb(var(--c50545e))]">on-device diffusion</span>
        </div>
      </div>
    </div>
  );
}
