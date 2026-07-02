import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Eye, Play, Radio } from "lucide-react";
import { khoros, type LobbyMessage, type RoomChoice } from "../../khoros";
import { AgentGlyph } from "../Logo";
import { MatchRoom, type CrewMsg, type FeedRow, type Score } from "./MatchRoom";

let rid = 0;

// Per-room watch log: what you've seen survives leaving the room (and app
// restarts), so re-entering restores the chat/feed instead of wiping it.
interface RoomLog {
  feed: FeedRow[];
  crew: CrewMsg[];
  score: Score | null;
  next: number; // next unwatched event index — resume point
  finished: boolean;
}
const LOG_KEY = "khoros.roomlog.v1";
function loadLogs(): Record<string, RoomLog> {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function LobbyPanel({ active }: { active: boolean }) {
  const [rooms, setRooms] = useState<RoomChoice[] | null>(null);
  const [view, setView] = useState<"picker" | "room">("picker");
  const [score, setScore] = useState<Score | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [crew, setCrew] = useState<CrewMsg[]>([]);
  const [watching, setWatching] = useState(0);
  const [peers, setPeers] = useState<string[]>([]);
  const [lounge, setLounge] = useState<CrewMsg[]>([]);
  const [goal, setGoal] = useState(false);
  const [banner, setBanner] = useState<"resume" | "rewatch" | null>(null);
  const totalRef = useRef(0);
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loungeRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<Record<string, RoomLog>>(loadLogs());
  const roomRef = useRef<string | null>(null);
  const nextRef = useRef(0);

  useEffect(() => {
    loungeRef.current?.scrollTo({ top: loungeRef.current.scrollHeight, behavior: "smooth" });
  }, [lounge]);

  // The Lounge auto-discussion (the user's agent + a house pundit) only runs
  // while the user is actually looking at the picker — pause it otherwise.
  // Never send the initial "off" — the handler registers after agent.init, so an
  // eager call on mount just logs a "no handler" error.
  const loungeWasOn = useRef(false);
  useEffect(() => {
    const on = active && view === "picker";
    if (!on && !loungeWasOn.current) return;
    loungeWasOn.current = on || loungeWasOn.current;
    void khoros.loungeActive(on).catch(() => {});
    return () => {
      if (on) void khoros.loungeActive(false).catch(() => {});
    };
  }, [active, view]);

  const [watchIds, setWatchIds] = useState<Set<string>>(new Set());
  const loadRooms = useCallback(async () => {
    const [r, w] = await Promise.all([khoros.lobbyRooms().catch(() => null), khoros.watchList().catch(() => null)]);
    setRooms(r?.ok && r.rooms ? r.rooms : []);
    setWatchIds(new Set((w?.watches ?? []).map((x) => x.id)));
  }, []);

  useEffect(() => {
    khoros.onLobbyMessage((m: LobbyMessage) => {
      if (m.kind === "scoreboard") {
        const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
        if (total > totalRef.current) {
          setGoal(true);
          if (goalTimer.current) clearTimeout(goalTimer.current);
          goalTimer.current = setTimeout(() => setGoal(false), 2600);
        }
        totalRef.current = total;
        setScore({ home: m.home ?? "", away: m.away ?? "", homeFlag: m.homeFlag ?? "🏳️", awayFlag: m.awayFlag ?? "🏳️", hs: m.homeScore ?? 0, as: m.awayScore ?? 0, minute: m.minute ?? "", live: !!m.live, phase: m.phase ?? (m.live ? "in" : "post") });
      } else if (m.kind === "feed") {
        if (typeof m.idx === "number") nextRef.current = m.idx + 1;
        setFeed((f) => [...f, { id: ++rid, clock: m.clock, emoji: m.emoji, text: m.text ?? "", key: m.key }]);
      } else if (m.kind === "agent") {
        setCrew((c) => [...c, { id: ++rid, from: m.from ?? "agent", emoji: m.emoji, text: m.text ?? "", told: m.callback }]);
      } else if (m.kind === "system") {
        if ((m.text ?? "").includes("FULL TIME") && roomRef.current) {
          const log = logsRef.current[roomRef.current];
          if (log) log.finished = true;
          else logsRef.current[roomRef.current] = { feed: [], crew: [], score: null, next: nextRef.current, finished: true };
        }
        setFeed((f) => [...f, { id: ++rid, text: m.text ?? "", system: true }]);
      }
    });
    // The relay lobby = cross-device agents chatting GENERALLY about the World
    // Cup. It feeds the Lounge in the picker (presence + banter), separate from a
    // match room's crew (which is the in-process watch-along).
    khoros.onLobbyEvent((ev) => {
      if (ev.type === "presence") {
        setPeers(ev.peers ?? []);
        setWatching(Math.max(0, (ev.peers?.length ?? 1) - 1));
      } else if (ev.type === "message") {
        setLounge((l) => [...l.slice(-40), { id: ++rid, from: ev.from ?? "agent", text: ev.text ?? "", told: ev.callback, remote: !ev.self }]);
      }
    });
  }, []);

  useEffect(() => {
    if (active && rooms === null) void loadRooms();
  }, [active, rooms, loadRooms]);

  // Everything watched in the current room is logged (and saved) as it happens,
  // so leaving never loses the room's history.
  useEffect(() => {
    const id = roomRef.current;
    if (view !== "room" || !id || (feed.length === 0 && crew.length === 0)) return;
    logsRef.current[id] = {
      feed: feed.slice(-250),
      crew: crew.slice(-120),
      score,
      next: nextRef.current,
      finished: logsRef.current[id]?.finished ?? false,
    };
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(logsRef.current));
    } catch {
      /* storage full — history just won't survive restarts */
    }
  }, [feed, crew, score, view]);

  // startLobby can bounce off a still-unwinding previous room (an agent line
  // mid-generation keeps the engine busy for a few seconds) — retry briefly.
  const startWithRetry = useCallback(async (id: string, from: number) => {
    for (let i = 0; i < 20; i++) {
      const r = await khoros.startLobby(id, from).catch(() => null);
      if (!r || r.ok || !/already running/i.test(r.error ?? "")) return;
      await new Promise((res) => setTimeout(res, 500));
    }
  }, []);

  const enterRoom = useCallback(
    async (room: RoomChoice) => {
      const log = logsRef.current[room.id];
      roomRef.current = room.id;
      nextRef.current = log?.next ?? 0;
      totalRef.current = log?.score ? (log.score.hs ?? 0) + (log.score.as ?? 0) : 0;
      setFeed(log?.feed ?? []);
      setCrew(log?.crew ?? []);
      setScore(log?.score ?? null);
      setView("room");
      if (log?.finished) return setBanner("rewatch"); // just hang out — rewatch is optional
      if (log && log.next > 0 && !room.live) return setBanner("resume"); // paused mid-replay
      setBanner(null);
      await startWithRetry(room.id, room.live ? (log?.next ?? 0) : 0); // live reattaches + catches up
    },
    [startWithRetry],
  );

  const resumeRoom = useCallback(() => {
    setBanner(null);
    if (roomRef.current) void startWithRetry(roomRef.current, nextRef.current);
  }, [startWithRetry]);

  const restartRoom = useCallback(() => {
    const id = roomRef.current;
    if (!id) return;
    setBanner(null);
    delete logsRef.current[id];
    nextRef.current = 0;
    totalRef.current = 0;
    setFeed([]);
    setCrew([]);
    setScore(null);
    void startWithRetry(id, 0);
  }, [startWithRetry]);

  const back = useCallback(async () => {
    await khoros.stopLobby().catch(() => {});
    setBanner(null);
    setView("picker");
    void loadRooms();
  }, [loadRooms]);

  if (view === "room") return <MatchRoom score={score} feed={feed} crew={crew} watching={watching} goal={goal} onBack={back} banner={banner} onResume={resumeRoom} onRestart={restartRoom} />;

  return (
    <div className="kh-scroll h-full overflow-y-auto px-4 py-[14px]">
      {/* Lounge — the society of agents talking World Cup on its own (the user's
          own agent + a house pundit, plus real agents from other devices). Not a
          user chat box — you watch the agents discuss. Capped short: it's ambient;
          picking a room is the job, so ≥2 cards stay above the fold. */}
      <div className="mb-[14px] rounded-[16px] border border-border-subtle bg-surface-0/70 p-[13px]">
        <div className="mb-[10px] flex items-center gap-[8px]">
          <span className="relative h-[7px] w-[7px]">
            <span className="absolute inset-0 rounded-full bg-gold animate-pulse-dot" />
          </span>
          <span className="font-condensed text-[15px] uppercase tracking-[.04em] text-content">World Cup lounge</span>
          <span className="ml-auto text-[11px] text-content-faint">{peers.length > 1 ? `${peers.length} agents` : "agents talking"}</span>
        </div>
        {lounge.length === 0 ? (
          <div className="flex items-center gap-[7px] text-[12px] leading-[1.5] text-content-faint">
            <span className="flex gap-[3px]">
              <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-content-faint [animation-delay:-0.3s]" />
              <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-content-faint [animation-delay:-0.15s]" />
              <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-content-faint" />
            </span>
            Your agent and the lounge are warming up…
          </div>
        ) : (
          <div ref={loungeRef} className="kh-scroll flex max-h-[148px] flex-col gap-[9px] overflow-y-auto">
            {lounge.map((m) => (
              <div key={m.id} className="flex gap-[7px]">
                <AgentGlyph size={18} />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-content">{m.from}</span>{" "}
                  <span className="text-[12px] leading-[1.4] text-[rgb(var(--cc9cdd6))]">{m.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-[14px] flex items-center justify-between">
        <span className="font-condensed text-[18px] uppercase tracking-[.04em] text-content">Today</span>
        {rooms && <span className="text-[12px] text-content-faint">{rooms.length} match{rooms.length === 1 ? "" : "es"}</span>}
      </div>
      {rooms === null ? (
        <div className="flex flex-col gap-[12px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[86px] rounded-[16px] border border-border-subtle bg-gradient-to-r from-surface-1 via-surface-2 to-surface-1 bg-[length:200%_100%] animate-shimmer" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-16 text-center text-[13px] text-content-muted">No matches found right now.</div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} watching={watchIds.has(r.id)} onClick={() => enterRoom(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreDigit({ n, dim }: { n: number; dim: boolean }) {
  return (
    <span className={`display text-[18px] tabular-nums ${dim ? "text-content-muted" : "text-content"}`} style={{ fontVariationSettings: "'wdth' 125", letterSpacing: "-.02em" }}>
      {n}
    </span>
  );
}

function RoomCard({ room, watching, onClick }: { room: RoomChoice; watching?: boolean; onClick: () => void }) {
  const replay = room.state === "post";
  const played = room.homeScore != null && room.awayScore != null;
  return (
    <button onClick={onClick} className={`rounded-[16px] border p-[13px] text-left transition-all duration-fast hover:-translate-y-[2px] ${replay ? "border-border-subtle bg-surface-0 opacity-90 hover:opacity-100" : "border-border bg-[rgb(var(--c111217))] hover:border-border-strong"} ${room.live ? "hover:shadow-[0_0_22px_-4px_rgba(209,65,80,.5)]" : ""}`}>
      <div className="mb-[10px] flex items-center justify-between">
        {room.live ? (
          <span className="flex items-center gap-[6px] rounded-full border border-[rgb(var(--c4d2026))] bg-live/[.14] px-[9px] py-[4px]">
            <span className="h-[7px] w-[7px] rounded-full bg-live animate-pulse-dot" />
            <span className="text-[10.5px] font-extrabold tracking-[.08em] text-live-bright">LIVE</span>
          </span>
        ) : replay ? (
          <span className="flex items-center gap-[6px] rounded-full border border-border bg-[rgb(var(--c181920))] px-[9px] py-[4px]">
            <Play className="h-[11px] w-[11px] text-content-muted" strokeWidth={2} />
            <span className="text-[10.5px] font-bold tracking-[.04em] text-content-muted">REPLAY</span>
          </span>
        ) : (
          <span className="flex items-center gap-[6px] rounded-full border border-border bg-[rgb(var(--c181920))] px-[9px] py-[4px]">
            <Clock className="h-[12px] w-[12px] text-content-muted" strokeWidth={1.75} />
            <span className="text-[10.5px] font-bold tracking-[.04em] text-[rgb(var(--cc9cdd6))]">{room.kickoff || "soon"}</span>
          </span>
        )}
        <span className="flex items-center gap-[8px]">
          {watching && (
            <span className="flex items-center gap-[5px] rounded-full border border-[rgb(var(--c3a3320))] bg-gold/[.1] px-[8px] py-[3px]" title="Your agent is watching this for you">
              <Eye className="h-[11px] w-[11px] text-gold" strokeWidth={2} />
              <span className="text-[10px] font-bold tracking-[.04em] text-gold-bright">WATCHING</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-content-faint">
            {room.live && <Radio className="h-[11px] w-[11px]" strokeWidth={1.75} />}
            {room.detail || (replay ? "full time" : "")}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-[12px]">
        <div className="flex min-w-0 flex-1 items-center gap-[10px]">
          <span className="text-[22px] leading-none">{room.homeFlag}</span>
          <span className={`truncate text-[14px] font-semibold ${replay ? "text-[rgb(var(--cc9cdd6))]" : "text-content"}`}>{room.home}</span>
        </div>
        {played ? (
          <span className="flex flex-shrink-0 items-center gap-[7px]">
            <ScoreDigit n={room.homeScore!} dim={replay} />
            <span className="text-[13px] text-content-faint">–</span>
            <ScoreDigit n={room.awayScore!} dim={replay} />
          </span>
        ) : (
          <span className="flex-shrink-0 text-[12px] font-semibold text-content-faint">vs</span>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-[10px]">
          <span className={`truncate text-[14px] font-semibold ${replay ? "text-[rgb(var(--cc9cdd6))]" : "text-content"}`}>{room.away}</span>
          <span className="text-[22px] leading-none">{room.awayFlag}</span>
        </div>
      </div>
    </button>
  );
}
