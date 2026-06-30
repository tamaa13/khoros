import { useState } from "react";
import { Check, MessageCircle, ShieldCheck } from "lucide-react";
import { Logo } from "../Logo";

const SUGGESTIONS = ["Gaffer", "Pundit", "Mate", "Boots"];
const LANGS = ["English", "Español", "Français"];

export function Welcome({ onCreate }: { onCreate: (name: string, lang: string) => void | Promise<void> }) {
  const [name, setName] = useState("Gaffer");
  const [lang, setLang] = useState("English");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    await onCreate(n, lang);
  };

  return (
    <div className="kh-scroll flex flex-1 flex-col overflow-y-auto px-[30px] pb-[30px] pt-[38px]">
      <div className="mb-[26px] flex justify-center">
        <Logo size={78} float />
      </div>
      <h2 className="display mb-[10px] text-center text-[34px] leading-[.98]" style={{ fontVariationSettings: "'wdth' 118", letterSpacing: "-.03em" }}>
        Meet your
        <br />
        watch-mate
      </h2>
      <p className="mb-[30px] text-center text-[14px] leading-[1.55] text-content-muted">
        Give your agent a name. It'll learn your takes, remember its own calls, and hold you both to them.
      </p>

      <label className="mb-[9px] block text-[11px] font-bold uppercase tracking-[.1em] text-content-faint">Agent name</label>
      <div className="mb-[12px] flex items-center gap-[10px] rounded-lg border border-gold bg-[rgb(var(--c0d1411))] px-4 py-[14px] shadow-[0_0_0_3px_rgba(244,196,76,.12)]">
        <MessageCircle className="h-[18px] w-[18px] text-gold" strokeWidth={1.75} />
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          maxLength={24}
          className="flex-1 bg-transparent text-[16px] font-semibold text-content outline-none"
          placeholder="Your agent's name"
        />
      </div>
      <div className="mb-[28px] flex flex-wrap gap-[7px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setName(s)}
            className={`rounded-full border px-3 py-[6px] text-[12px] transition-colors duration-fast ${
              name === s ? "border-border-subtle bg-[rgb(var(--c111217))] text-content-muted" : "border-[rgb(var(--c1f2128))] text-content-faint hover:text-content-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="mb-[9px] block text-[11px] font-bold uppercase tracking-[.1em] text-content-faint">Language</label>
      <div className="mb-[30px] flex gap-[8px]">
        {LANGS.map((l) => {
          const on = l === lang;
          return (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex flex-1 items-center justify-center gap-[8px] rounded-[12px] border py-[11px] text-[14px] transition-colors duration-fast ${
                on ? "border-gold bg-gold/[.08] font-semibold text-content" : "border-border-subtle text-content-muted hover:border-border"
              }`}
            >
              {on && <Check className="h-[15px] w-[15px] text-gold" strokeWidth={2} />}
              {l}
            </button>
          );
        })}
      </div>

      <div className="mb-[26px] flex gap-[13px] rounded-lg border border-[rgb(var(--c3a3320))] bg-gradient-to-r from-gold/[.06] to-transparent p-4">
        <ShieldCheck className="mt-[1px] h-5 w-5 flex-shrink-0 text-gold" strokeWidth={1.75} />
        <div>
          <div className="mb-[4px] text-[13px] font-semibold text-content">Private by design</div>
          <div className="text-[12.5px] leading-[1.5] text-content-muted">Every model — chat, voice, translation, images — runs on this machine. Nothing is ever sent to a server.</div>
        </div>
      </div>

      <button
        onClick={create}
        disabled={busy || !name.trim()}
        className="mt-auto w-full rounded-lg bg-gold py-[15px] text-[15px] font-bold text-gold-fg transition-transform duration-fast ease-enter hover:-translate-y-px active:translate-y-px disabled:opacity-50"
      >
        {busy ? "Setting up…" : `Create ${name.trim() || "your agent"} →`}
      </button>
    </div>
  );
}
