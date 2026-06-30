import { useEffect, useRef } from "react";
import { ChevronLeft, Mic, Undo2, Users } from "lucide-react";
import { AgentGlyph } from "../Logo";

export interface Score {
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  hs: number;
  as: number;
  minute: string;
  live: boolean;
}
export interface FeedRow {
  id: number;
  clock?: string;
  emoji?: string;
  text: string;
  key?: boolean;
  system?: boolean;
}
export interface CrewMsg {
  id: number;
  from: string;
  emoji?: string;
  text: string;
  told?: boolean;
  remote?: boolean;
}

const CONFETTI = ["rgb(var(--cf4c44c))", "rgb(var(--c3da968))", "rgb(var(--cf1f2f5))", "rgb(var(--cf4c44c))", "rgb(var(--c3da968))", "rgb(var(--cc49a33))"];
const KEY_LABEL: Record<string, string> = { "⚽": "GOAL", "🟥": "RED CARD", "🟨": "YELLOW", "🎯": "PENALTY", "🔁": "SUB", "🔄": "SUB" };

export function MatchRoom({ score, feed, crew, watching, goal, onBack }: { score: Score | null; feed: FeedRow[]; crew: CrewMsg[]; watching: number; goal: boolean; onBack: () => void }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const crewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [feed]);
  useEffect(() => {
    crewRef.current?.scrollTo({ top: crewRef.current.scrollHeight, behavior: "smooth" });
  }, [crew]);

  return (
    <div className="flex h-full flex-col">
      {/* room bar */}
      <div className="flex flex-shrink-0 items-center gap-[10px] border-b border-[rgb(var(--c1f2128))] bg-[rgb(var(--c0c0d11))] px-[14px] py-[10px]">
        <button onClick={onBack} className="flex items-center gap-[6px] rounded-full border border-border-subtle bg-[rgb(var(--c111217))] py-[6px] pl-2 pr-[11px] text-[12px] text-content-muted transition-colors hover:text-content">
          <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={1.75} /> Rooms
        </button>
        {watching > 0 && (
          <div className="ml-auto flex items-center gap-[5px] text-[11.5px] text-content-muted">
            <Users className="h-[14px] w-[14px]" strokeWidth={1.75} /> {watching} watching
          </div>
        )}
      </div>

      {/* scoreboard */}
      {score && (
        <div className={`relative flex-shrink-0 overflow-hidden border-b border-[rgb(var(--c1f2128))] bg-[rgb(var(--c0c0d11))] px-[18px] pb-[14px] pt-4 ${goal ? "animate-goal-glow" : ""}`}>
          {goal &&
            CONFETTI.map((c, i) => (
              <span key={i} className="absolute -top-[6px] h-[9px] w-[6px] rounded-[1px] animate-confetti" style={{ left: `${12 + i * 15}%`, background: c, animationDelay: `${i * 0.12}s` }} />
            ))}
          <div className="mb-[13px] flex items-center justify-center gap-[8px]">
            {score.live ? (
              <span className="flex items-center gap-[6px] rounded-full border border-[rgb(var(--c4d2026))] bg-live/[.15] px-[9px] py-[3px]">
                <span className="h-[7px] w-[7px] rounded-full bg-live animate-pulse-dot" />
                <span className="text-[10.5px] font-extrabold tracking-[.08em] text-live-bright">LIVE</span>
              </span>
            ) : (
              <span className="rounded-full border border-border-subtle bg-[rgb(var(--c181920))] px-[9px] py-[3px] text-[10.5px] font-bold tracking-[.06em] text-content-muted">REPLAY</span>
            )}
            <span className="display text-[13px] tabular-nums" style={{ fontVariationSettings: "'wdth' 110" }}>
              {score.minute}
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <Side flag={score.homeFlag} name={score.home} />
            <div className="flex flex-shrink-0 items-center gap-[8px]">
              <ScoreNum n={score.hs} pop={goal} />
              <span className="text-[24px] font-bold text-content-faint">–</span>
              <ScoreNum n={score.as} pop={goal} />
            </div>
            <Side flag={score.awayFlag} name={score.away} />
          </div>
        </div>
      )}

      {/* feed | crew — each column scrolls independently with a fixed header */}
      <div className="flex min-h-0 flex-1 gap-px bg-[rgb(var(--c1f2128))]">
        <div className="flex min-w-0 flex-1 flex-col bg-bg-base">
          <div className="flex-shrink-0 px-[11px] pb-2 pt-[13px]">
            <Header>Match feed</Header>
          </div>
          <div ref={feedRef} className="kh-scroll flex flex-1 flex-col gap-[8px] overflow-y-auto px-[11px] pb-[13px]">
            {feed.length === 0 && <div className="px-1 text-[12px] text-content-faint">Waiting for the action…</div>}
            {feed.map((r) =>
              r.system ? (
                <div key={r.id} className="px-1 py-1 text-center text-[11px] italic text-content-faint">{r.text}</div>
              ) : (
                (() => {
                  const isGoal = r.emoji === "⚽";
                  const label = r.key ? KEY_LABEL[r.emoji ?? ""] : undefined;
                  return (
                    <div key={r.id} className={`flex flex-shrink-0 gap-[8px] rounded-[11px] px-[10px] py-[9px] animate-rise ${isGoal ? "border border-[rgb(var(--c3a3320))] bg-gold/[.1]" : "bg-[rgb(var(--c111217))]"}`}>
                      <span className="flex-shrink-0 text-[13px]">{r.emoji || "•"}</span>
                      <div className="min-w-0">
                        <div className={`text-[11px] ${isGoal ? "font-bold text-gold-bright" : label ? "font-semibold text-content-muted" : "text-content-faint"}`}>
                          {r.clock}
                          {label ? ` · ${label}` : ""}
                        </div>
                        <div className="text-[12px] leading-[1.35] text-[rgb(var(--cc9cdd6))]">{r.text}</div>
                      </div>
                    </div>
                  );
                })()
              ),
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-bg-base">
          <div className="flex-shrink-0 px-[11px] pb-2 pt-[13px]">
            <Header>Crew</Header>
          </div>
          <div ref={crewRef} className="kh-scroll flex flex-1 flex-col gap-[9px] overflow-y-auto px-[11px] pb-[13px]">
            {crew.length === 0 && <div className="px-1 text-[12px] text-content-faint">The crew's gathering…</div>}
            {crew.map((c) => (
              <div key={c.id} className={`flex-shrink-0 rounded-[12px] border px-[10px] py-[9px] animate-rise ${c.told ? "border-[rgb(var(--c3a3320))] bg-[rgb(var(--c100f0a))]" : c.from === "Commentator" ? "border-[rgb(var(--c1c3354))] bg-[rgb(var(--c0c1622))]" : "border-surface-3 bg-[rgb(var(--c111217))]"}`}>
                <div className="mb-[5px] flex items-center gap-[6px]">
                  {c.from === "Commentator" ? (
                    <span className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded-full bg-[rgb(var(--c13243a))]">
                      <Mic className="h-[9px] w-[9px] text-cast" />
                    </span>
                  ) : (
                    <AgentGlyph size={17} />
                  )}
                  <span className={`text-[11px] font-bold ${c.from === "Commentator" ? "text-[rgb(var(--caac0de))]" : "text-content"}`}>{c.from}</span>
                  {c.told && <Undo2 className="ml-auto h-[11px] w-[11px] text-gold" strokeWidth={2} />}
                </div>
                <div className={`text-[12px] leading-[1.4] ${c.told ? "text-[rgb(var(--cf3e7c4))]" : "text-[rgb(var(--cc9cdd6))]"}`}>{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Header = ({ children }: { children: React.ReactNode }) => <div className="mb-[11px] text-[10.5px] font-bold uppercase tracking-[.1em] text-content-faint">{children}</div>;

function Side({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-[7px]">
      <span className="text-[28px] leading-none">{flag}</span>
      <span className="font-condensed text-[15px] uppercase tracking-[.03em] text-content">{name}</span>
    </div>
  );
}

function ScoreNum({ n, pop }: { n: number; pop: boolean }) {
  return (
    <span key={n} className={`display text-[46px] leading-none text-white ${pop ? "animate-[rise_.4s_cubic-bezier(.16,1,.3,1)]" : ""}`} style={{ fontVariationSettings: "'wdth' 125", letterSpacing: "-.03em" }}>
      {n}
    </span>
  );
}
