import { ShieldCheck } from "lucide-react";
import { Logo } from "../Logo";

const R = 54;
const C = 2 * Math.PI * R;

export function Boot({ name, status, progress }: { name: string; status: string; progress: number | null }) {
  const pct = progress != null ? Math.max(0, Math.min(100, progress)) : null;
  const offset = pct != null ? C * (1 - pct / 100) : C * 0.7;

  return (
    <div className="kh-scroll flex flex-1 flex-col overflow-y-auto px-[30px] py-[36px]">
      <div className="relative mb-[24px] flex justify-center">
        <svg viewBox="0 0 120 120" width="118" height="118" className="absolute -top-[20px]">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#181920" strokeWidth="4" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="#F4C44C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ filter: "drop-shadow(0 0 6px rgba(244,196,76,.6))", transition: "stroke-dashoffset .5s cubic-bezier(.16,1,.3,1)", animation: pct == null ? "spin 1.4s linear infinite" : undefined, transformOrigin: "60px 60px" }}
          />
        </svg>
        <div className="flex h-[78px] w-[78px] items-center justify-center">
          <Logo size={52} variant="simple" float />
        </div>
      </div>

      <h2 className="display mb-[6px] text-center text-[25px]" style={{ fontVariationSettings: "'wdth' 115", letterSpacing: "-.02em" }}>
        Setting up {name}
      </h2>
      <p className="mb-[4px] text-center text-[13.5px] text-content-muted">Downloading models to your machine</p>
      <p className="mb-[26px] text-center text-[12px] text-content-faint">Happens once · stays on your device</p>

      <div className="rounded-[13px] border border-border bg-[#111217] p-[15px]">
        <div className="mb-[11px] flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-semibold text-content">{status}</span>
          {pct != null && <span className="text-[12px] font-bold tabular-nums text-gold">{Math.round(pct)}%</span>}
        </div>
        <div className="h-[6px] overflow-hidden rounded-full bg-[#181920]">
          {pct != null ? (
            <div className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold shadow-[0_0_12px_rgba(244,196,76,.6)] transition-[width] duration-slow ease-enter" style={{ width: `${pct}%` }} />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-center gap-[8px] pt-[24px] text-[11.5px] text-content-faint">
        <ShieldCheck className="h-[14px] w-[14px] text-gold-deep" strokeWidth={1.75} />
        Models stay on your device — no account, no cloud.
      </div>
    </div>
  );
}
