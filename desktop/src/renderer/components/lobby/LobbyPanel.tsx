import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Play, Radio } from "lucide-react";
import { khoros, type LobbyMessage, type RoomChoice } from "../../khoros";
import { MatchRoom, type CrewMsg, type FeedRow, type Score } from "./MatchRoom";

let rid = 0;

export function LobbyPanel({ active }: { active: boolean }) {
  const [rooms, setRooms] = useState<RoomChoice[] | null>(null);
  const [view, setView] = useState<"picker" | "room">("picker");
  const [score, setScore] = useState<Score | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [crew, setCrew] = useState<CrewMsg[]>([]);
  const [watching, setWatching] = useState(0);
  const [goal, setGoal] = useState(false);
  const totalRef = useRef(0);
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRooms = useCallback(async () => {
    const r = await khoros.lobbyRooms().catch(() => null);
    setRooms(r?.ok && r.rooms ? r.rooms : []);
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
        setScore({ home: m.home ?? "", away: m.away ?? "", homeFlag: m.homeFlag ?? "🏳️", awayFlag: m.awayFlag ?? "🏳️", hs: m.homeScore ?? 0, as: m.awayScore ?? 0, minute: m.minute ?? "", live: !!m.live });
      } else if (m.kind === "feed") {
        setFeed((f) => [...f, { id: ++rid, clock: m.clock, emoji: m.emoji, text: m.text ?? "", key: m.key }]);
      } else if (m.kind === "agent") {
        setCrew((c) => [...c, { id: ++rid, from: m.from ?? "agent", emoji: m.emoji, text: m.text ?? "", told: m.callback }]);
      } else if (m.kind === "system") {
        setFeed((f) => [...f, { id: ++rid, text: m.text ?? "", system: true }]);
      }
    });
    khoros.onLobbyEvent((ev) => {
      if (ev.type === "presence") setWatching(Math.max(0, (ev.peers?.length ?? 1) - 1));
      else if (ev.type === "message") setCrew((c) => [...c, { id: ++rid, from: ev.from ?? "agent", text: ev.text ?? "", told: ev.callback, remote: !ev.self }]);
    });
  }, []);

  useEffect(() => {
    if (active && rooms === null) void loadRooms();
  }, [active, rooms, loadRooms]);

  const enterRoom = useCallback(async (id: string) => {
    setView("room");
    setScore(null);
    setFeed([]);
    setCrew([]);
    totalRef.current = 0;
    await khoros.startLobby(id);
  }, []);

  const back = useCallback(async () => {
    await khoros.stopLobby().catch(() => {});
    setView("picker");
    void loadRooms();
  }, [loadRooms]);

  if (view === "room") return <MatchRoom score={score} feed={feed} crew={crew} watching={watching} goal={goal} onBack={back} />;

  return (
    <div className="kh-scroll h-full overflow-y-auto px-4 py-[18px]">
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
            <RoomCard key={r.id} room={r} onClick={() => enterRoom(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onClick }: { room: RoomChoice; onClick: () => void }) {
  const replay = room.state === "post";
  return (
    <button onClick={onClick} className={`rounded-[16px] border p-[15px] text-left transition-all duration-fast hover:-translate-y-[2px] ${replay ? "border-border-subtle bg-surface-0 opacity-90 hover:opacity-100" : "border-border bg-[#111217] hover:border-border-strong"} ${room.live ? "hover:shadow-[0_0_22px_-4px_rgba(209,65,80,.5)]" : ""}`}>
      <div className="mb-[13px] flex items-center justify-between">
        {room.live ? (
          <span className="flex items-center gap-[6px] rounded-full border border-[#4d2026] bg-live/[.14] px-[9px] py-[4px]">
            <span className="h-[7px] w-[7px] rounded-full bg-live animate-pulse-dot" />
            <span className="text-[10.5px] font-extrabold tracking-[.08em] text-live-bright">LIVE</span>
          </span>
        ) : replay ? (
          <span className="flex items-center gap-[6px] rounded-full border border-border bg-[#181920] px-[9px] py-[4px]">
            <Play className="h-[11px] w-[11px] text-content-muted" strokeWidth={2} />
            <span className="text-[10.5px] font-bold tracking-[.04em] text-content-muted">REPLAY</span>
          </span>
        ) : (
          <span className="flex items-center gap-[6px] rounded-full border border-border bg-[#181920] px-[9px] py-[4px]">
            <Clock className="h-[12px] w-[12px] text-content-muted" strokeWidth={1.75} />
            <span className="text-[10.5px] font-bold tracking-[.04em] text-[#C9CDD6]">{room.kickoff || "soon"}</span>
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] text-content-faint">
          {room.live && <Radio className="h-[11px] w-[11px]" strokeWidth={1.75} />}
          {room.detail || (replay ? "full time" : "")}
        </span>
      </div>
      <div className="flex items-center gap-[12px]">
        <div className="flex flex-1 items-center gap-[10px]">
          <span className="text-[22px] leading-none">{room.homeFlag}</span>
          <span className={`text-[14px] font-semibold ${replay ? "text-[#C9CDD6]" : "text-content"}`}>{room.home}</span>
        </div>
        <span className="text-[12px] font-semibold text-content-faint">vs</span>
        <div className="flex flex-1 items-center justify-end gap-[10px]">
          <span className={`text-[14px] font-semibold ${replay ? "text-[#C9CDD6]" : "text-content"}`}>{room.away}</span>
          <span className="text-[22px] leading-none">{room.awayFlag}</span>
        </div>
      </div>
    </button>
  );
}
