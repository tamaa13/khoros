import { useEffect, useState } from "react";
import { Dna, Languages, Moon, ShieldCheck, Sun, Volume2, X } from "lucide-react";
import { khoros } from "../khoros";

const LANGS = ["English", "Indonesian", "Spanish", "French"];

export function SettingsMenu({ voice, onVoiceChange, language, onLanguageChange, theme, onThemeChange, onClose }: { voice: boolean; onVoiceChange: (v: boolean) => void; language: string; onLanguageChange: (l: string) => void; theme: "dark" | "light"; onThemeChange: (t: "dark" | "light") => void; onClose: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [evolving, setEvolving] = useState(false);
  const [evo, setEvo] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    khoros
      .evolveStatus()
      .then((s) => setEvo(s as Record<string, any>))
      .catch(() => setEvo({}));
  }, []);

  const capable = !!evo?.cap?.canEvolve;
  const evoStatus = !evo
    ? "Checking…"
    : !capable
      ? `Memory-only on this device${evo.cap?.reason ? ` (${evo.cap.reason})` : ""} — your agent still personalizes via memory.`
      : evo.applied
        ? `Evolved voice is active · ${evo.newTakes ?? 0} new takes since. It re-tunes itself when idle & charging.`
        : `${evo.total ?? 0} takes collected — it fine-tunes itself automatically when idle & charging.`;

  const pickLang = (l: string) => onLanguageChange(l);

  const tune = async () => {
    setEvolving(true);
    setMsg("Fine-tuning on your takes…");
    const r = (await khoros.evolveNow().catch(() => null)) as Record<string, any> | null;
    setEvolving(false);
    setMsg(r?.ok ? `Evolved — loss ${r.firstLoss?.toFixed?.(2) ?? "?"} → ${r.finalLoss?.toFixed?.(2) ?? "?"}. Restart to run your new voice.` : `Couldn't evolve: ${r?.reason ?? r?.error ?? "memory-only on this device"}.`);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-4 top-[50px] z-50 w-[262px] overflow-hidden rounded-[14px] border border-border bg-surface-1 shadow-pop animate-rise">
        <div className="flex items-center justify-between border-b border-[rgb(var(--c1f2128))] px-[14px] py-[10px]">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-content-faint">Settings</span>
          <button onClick={onClose} aria-label="Close">
            <X className="h-[14px] w-[14px] text-content-faint hover:text-content" />
          </button>
        </div>

        <div className="border-b border-[rgb(var(--c1f2128))] px-[14px] py-[12px]">
          <div className="mb-[8px] flex items-center gap-[8px]">
            <Sun className="h-[15px] w-[15px] text-content-muted" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-content">Appearance</span>
          </div>
          <div className="flex gap-[6px] rounded-[10px] border border-border-subtle bg-surface-2 p-[3px]">
            <button onClick={() => onThemeChange("dark")} className={`flex flex-1 items-center justify-center gap-[6px] rounded-[7px] py-[6px] text-[12px] font-medium transition-colors ${theme === "dark" ? "bg-surface-3 text-content shadow-card" : "text-content-muted hover:text-content"}`}>
              <Moon className="h-[13px] w-[13px]" strokeWidth={1.75} /> Dark
            </button>
            <button onClick={() => onThemeChange("light")} className={`flex flex-1 items-center justify-center gap-[6px] rounded-[7px] py-[6px] text-[12px] font-medium transition-colors ${theme === "light" ? "bg-surface-3 text-content shadow-card" : "text-content-muted hover:text-content"}`}>
              <Sun className="h-[13px] w-[13px]" strokeWidth={1.75} /> Light
            </button>
          </div>
        </div>

        <div className="flex items-center gap-[10px] px-[14px] py-[12px]">
          <Volume2 className="h-[17px] w-[17px] flex-shrink-0 text-content-muted" strokeWidth={1.75} />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-content">Voice replies</div>
            <div className="text-[11px] text-content-faint">Agent speaks (on-device TTS)</div>
          </div>
          <Toggle on={voice} onClick={() => onVoiceChange(!voice)} />
        </div>

        <div className="border-t border-[rgb(var(--c1f2128))] px-[14px] py-[12px]">
          <div className="mb-[8px] flex items-center gap-[8px]">
            <Languages className="h-[15px] w-[15px] text-content-muted" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-content">Reply language</span>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {LANGS.map((l) => (
              <button key={l} onClick={() => pickLang(l)} className={`rounded-full border px-[10px] py-[5px] text-[12px] transition-colors ${(language || "English") === l ? "border-gold bg-gold/[.1] text-content" : "border-border-subtle text-content-muted hover:text-content"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[rgb(var(--c1f2128))] px-[14px] py-[12px]">
          <div className="mb-[6px] flex items-center gap-[8px]">
            <Dna className="h-[15px] w-[15px] text-content-muted" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-content">Auto-evolve</span>
            <span className="ml-auto rounded-full bg-surface-2 px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[.08em] text-content-faint">auto</span>
          </div>
          <div className="text-[11.5px] leading-[1.45] text-content-muted">{evoStatus}</div>
          {capable && (
            <button onClick={tune} disabled={evolving} className="mt-[8px] text-[11.5px] font-medium text-gold-bright transition-opacity hover:underline disabled:opacity-50">
              {evolving ? "Tuning…" : "Tune now ↗"}
            </button>
          )}
          {msg && <div className="mt-[6px] text-[11px] leading-[1.4] text-content-muted">{msg}</div>}
        </div>

        <div className="flex items-center gap-[7px] border-t border-[rgb(var(--c1f2128))] px-[14px] py-[10px] text-[11px] text-content-faint">
          <ShieldCheck className="h-[13px] w-[13px] text-gold-deep" strokeWidth={1.75} /> Everything runs on your device.
        </div>
      </div>
    </>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative h-[22px] w-[40px] flex-shrink-0 rounded-full border-0 p-0 transition-colors ${on ? "bg-gold" : "bg-surface-3"}`} aria-pressed={on}>
      <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-base ${on ? "left-[20px]" : "left-[2px]"}`} />
    </button>
  );
}
