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

const CONFETTI = ["#F4C44C", "#3DA968", "#F1F2F5", "#F4C44C", "#3DA968", "#C49A33"];

export function MatchRoom({ score, feed, crew, watching, goal, onBack }: { score: Score | null; feed: FeedRow[]; crew: CrewMsg[]; watching: number; goal: boolean; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* room bar */}
      <div className="flex flex-shrink-0 items-center gap-[10px] border-b border-[#1F2128] bg-[#0C0D11] px-[14px] py-[10px]">
        <button onClick={onBack} className="flex items-center gap-[6px] rounded-full border border-border-subtle bg-[#111217] py-[6px] pl-2 pr-[11px] text-[12px] text-content-muted transition-colors hover:text-content">
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
        <div className={`relative flex-shrink-0 overflow-hidden border-b border-[#1F2128] bg-[#0C0D11] px-[18px] pb-[14px] pt-4 ${goal ? "animate-goal-glow" : ""}`}>
          {goal &&
            CONFETTI.map((c, i) => (
              <span key={i} className="absolute -top-[6px] h-[9px] w-[6px] rounded-[1px] animate-confetti" style={{ left: `${12 + i * 15}%`, background: c, animationDelay: `${i * 0.12}s` }} />
            ))}
          <div className="mb-[13px] flex items-center justify-center gap-[8px]">
            {score.live ? (
              <span className="flex items-center gap-[6px] rounded-full border border-[#4d2026] bg-live/[.15] px-[9px] py-[3px]">
                <span className="h-[7px] w-[7px] rounded-full bg-live animate-pulse-dot" />
                <span className="text-[10.5px] font-extrabold tracking-[.08em] text-live-bright">LIVE</span>
              </span>
            ) : (
              <span className="rounded-full border border-border-subtle bg-[#181920] px-[9px] py-[3px] text-[10.5px] font-bold tracking-[.06em] text-content-muted">REPLAY</span>
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

      {/* feed | crew */}
      <div className="kh-scroll flex flex-1 gap-px overflow-y-auto bg-[#1F2128]">
        <div className="min-w-0 flex-1 bg-bg-base px-[11px] py-[13px]">
          <Header>Match feed</Header>
          <div className="flex flex-col gap-[8px]">
            {feed.length === 0 && <div className="px-1 text-[12px] text-content-faint">Waiting for the action…</div>}
            {feed.map((r) =>
              r.system ? (
                <div key={r.id} className="px-1 py-1 text-center text-[11px] italic text-content-faint">{r.text}</div>
              ) : (
                <div key={r.id} className={`flex gap-[8px] rounded-[11px] px-[10px] py-[9px] animate-rise ${r.key ? "border border-[#3A3320] bg-gold/[.1]" : "bg-[#111217]"}`}>
                  <span className="flex-shrink-0 text-[13px]">{r.emoji || "•"}</span>
                  <div className="min-w-0">
                    <div className={`text-[11px] ${r.key ? "font-bold text-gold-bright" : "text-content-faint"}`}>{r.clock}{r.key ? " · GOAL" : ""}</div>
                    <div className="text-[12px] leading-[1.35] text-[#C9CDD6]">{r.text}</div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 bg-bg-base px-[11px] py-[13px]">
          <Header>Crew</Header>
          <div className="flex flex-col gap-[9px]">
            {crew.length === 0 && <div className="px-1 text-[12px] text-content-faint">The crew's gathering…</div>}
            {crew.map((c) => (
              <div key={c.id} className={`rounded-[12px] border px-[10px] py-[9px] animate-rise ${c.told ? "border-[#3A3320] bg-[#100F0A]" : c.from === "Commentator" ? "border-[#1c3354] bg-[#0c1622]" : "border-surface-3 bg-[#111217]"}`}>
                <div className="mb-[5px] flex items-center gap-[6px]">
                  {c.from === "Commentator" ? (
                    <span className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded-full bg-[#13243a]">
                      <Mic className="h-[9px] w-[9px] text-cast" />
                    </span>
                  ) : (
                    <AgentGlyph size={17} />
                  )}
                  <span className={`text-[11px] font-bold ${c.from === "Commentator" ? "text-[#AAC0DE]" : "text-content"}`}>{c.from}</span>
                  {c.told && <Undo2 className="ml-auto h-[11px] w-[11px] text-gold" strokeWidth={2} />}
                </div>
                <div className={`text-[12px] leading-[1.4] ${c.told ? "text-[#F3E7C4]" : "text-[#C9CDD6]"}`}>{c.text}</div>
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
