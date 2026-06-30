/**
 * The live Match Room — the lobby is now a watch-along. We pick a real match
 * (a live one if any is in play, else the most recent decided match) and drive
 * three things on one screen from REAL ESPN data:
 *   - a scoreboard (teams, flags, running score, minute)
 *   - a match feed (real per-minute events: free kicks, shots, goals, cards)
 *   - two on-device agents who back opposite sides and react to the moments
 *
 * Live match → poll ESPN every ~25s and emit new events as they happen.
 * No live match → replay the finished match's real timeline, paced, so the room
 * always has something real to show. Nothing here is faked or hardcoded.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { Agent } from "../../agent/loop";
import { liveOrLatestMatch, matchRoom, type MatchRoomData, type MatchEvent } from "../../tools/football";

export interface LobbyMessage {
  kind: "scoreboard" | "feed" | "agent" | "system";
  // scoreboard
  home?: string;
  away?: string;
  homeFlag?: string;
  awayFlag?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
  live?: boolean;
  // feed
  clock?: string;
  emoji?: string;
  key?: boolean;
  // agent / system
  from?: string;
  text?: string;
  callback?: boolean;
}

interface AgentSpec {
  name: string;
  emoji: string;
  backs: string;
  side: "home" | "away";
  agent: Agent;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Lobby {
  private agents: AgentSpec[] = [];
  private room: MatchRoomData | null = null;
  private live = false;
  private stopped = false;

  constructor(private readonly dataDir: string) {}

  /** Pick the match (live or latest) and wake two agents backing each side. */
  async init(onStatus: (s: string) => void = () => {}): Promise<void> {
    onStatus("finding a live or recent match…");
    const pick = await liveOrLatestMatch();
    if (!pick) throw new Error("no World Cup match available right now");
    this.live = pick.live;
    this.room = await matchRoom(pick.id);
    if (!this.room) throw new Error("couldn't load the match data");

    const specs = [
      { name: "Dewi", emoji: "🟢", backs: this.room.home, side: "home" as const },
      { name: "Rian", emoji: "🔵", backs: this.room.away, side: "away" as const },
    ];
    // Fresh memory each run so the predictions belong to this match.
    rmSync(this.dataDir, { recursive: true, force: true });
    for (const s of specs) {
      onStatus(`waking ${s.name}…`);
      const agent = new Agent({
        bias: `Lo dukung ${s.backs} di pertandingan ini. Komentar PENDEK (1 kalimat), santai, kayak lagi nobar — gak usah formal.`,
        memoryFile: join(this.dataDir, `${s.name}.json`),
      });
      await agent.init();
      this.agents.push({ ...s, agent });
    }
  }

  stop(): void {
    this.stopped = true;
  }

  async run(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    this.emitScore(emit, 0, 0, this.live ? room.minute : "0'");
    emit({
      kind: "system",
      text: this.live
        ? `🔴 LIVE — ${room.home} vs ${room.away}. Real-time dari ESPN.`
        : `▶ Replay — ${room.home} vs ${room.away} (${room.minute === "FT" ? "udah kelar" : "match terakhir"}). Event asli, diputar ulang.`,
    });

    // Opening predictions from each agent.
    for (const a of this.agents) {
      if (this.stopped) return;
      const { reply } = await a.agent.turn(
        `Bentar lagi ${room.home} lawan ${room.away}. Lo jagoin tim lo menang nih, prediksi skornya berapa?`,
        { learnPredictions: false, allowCallback: false, useTools: false },
      );
      emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
    }

    if (this.live) await this.runLive(emit);
    else await this.runReplay(emit);
  }

  /** Replay the finished match's real event timeline, paced. */
  private async runReplay(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    let hs = 0;
    let as = 0;
    for (const e of room.events) {
      if (this.stopped) return;
      emit({ kind: "feed", clock: e.clock, emoji: e.emoji, text: e.text, key: e.key });
      if (e.emoji === "⚽" && e.key) {
        const sc = scoreFromGoalText(e.text, room.home, room.away);
        if (sc) {
          hs = sc.hs;
          as = sc.as;
        }
        this.emitScore(emit, hs, as, e.clock);
        await this.reactToGoal(emit, e, hs, as);
      } else {
        this.emitScore(emit, hs, as, e.clock || undefined);
      }
      await sleep(2200);
    }
    if (this.stopped) return;
    this.emitScore(emit, room.homeScore, room.awayScore, "FT");
    emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
    await this.closingTakes(emit, room.homeScore, room.awayScore);
  }

  /** Poll ESPN for a live match; emit new events + score as they land. */
  private async runLive(emit: (m: LobbyMessage) => void): Promise<void> {
    let seen = 0;
    while (!this.stopped) {
      const room = await matchRoom(this.room!.id);
      if (!room) {
        await sleep(20000);
        continue;
      }
      this.room = room;
      this.emitScore(emit, room.homeScore, room.awayScore, room.minute);
      for (let i = seen; i < room.events.length; i++) {
        const e = room.events[i]!;
        emit({ kind: "feed", clock: e.clock, emoji: e.emoji, text: e.text, key: e.key });
        if (e.emoji === "⚽" && e.key) await this.reactToGoal(emit, e, room.homeScore, room.awayScore);
      }
      seen = room.events.length;
      if (room.state === "post") {
        emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
        await this.closingTakes(emit, room.homeScore, room.awayScore);
        return;
      }
      await sleep(25000);
    }
  }

  /** The agent whose side scored celebrates; the other one groans. */
  private async reactToGoal(emit: (m: LobbyMessage) => void, e: MatchEvent, hs: number, as: number): Promise<void> {
    if (this.stopped) return;
    // Which side scored? Prefer the explicit team on the event, else infer from text.
    const room = this.room!;
    let side: "home" | "away" | null = e.team === room.home ? "home" : e.team === room.away ? "away" : null;
    if (!side) side = e.text.includes(room.home) ? "home" : e.text.includes(room.away) ? "away" : null;
    const speaker = this.agents.find((a) => a.side === side) ?? this.agents[0]!;
    const { reply } = await speaker.agent.turn(
      `GOL! ${e.text} Skor sekarang ${room.home} ${hs}-${as} ${room.away}. Reaksi lo gimana?`,
      { learnPredictions: false, allowCallback: false, useTools: false },
    );
    emit({ kind: "agent", from: speaker.name, emoji: speaker.emoji, text: reply });
  }

  /** Both agents react to the final score — the one who called it gloats. */
  private async closingTakes(emit: (m: LobbyMessage) => void, hs: number, as: number): Promise<void> {
    const room = this.room!;
    const winner = hs > as ? room.home : as > hs ? room.away : null;
    for (const a of this.agents) {
      if (this.stopped) return;
      const right = winner === a.backs;
      const { reply } = await a.agent.turn(
        `FULL TIME ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} menang.` : "Seri."} Tim lo (${a.backs}) ${right ? "MENANG" : winner ? "kalah" : "seri"}. Komentar penutup lo?`,
        { learnPredictions: false, allowCallback: false, useTools: false },
      );
      emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply, callback: right });
    }
  }

  private emitScore(emit: (m: LobbyMessage) => void, hs: number, as: number, minute?: string): void {
    const r = this.room!;
    emit({
      kind: "scoreboard",
      home: r.home,
      away: r.away,
      homeFlag: r.homeFlag,
      awayFlag: r.awayFlag,
      homeScore: hs,
      awayScore: as,
      minute: minute ?? r.minute,
      live: this.live,
    });
  }

  async close(): Promise<void> {
    // Models are shared by id with the main chat agent — don't unload them.
    this.stopped = true;
    this.agents = [];
  }
}

/** Parse the running score straight from a goal's text ("… Brazil 0, Japan 1 …"). */
function scoreFromGoalText(text: string, home: string, away: string): { hs: number; as: number } | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`${esc(home)}\\s+(\\d+),\\s+${esc(away)}\\s+(\\d+)`, "i"));
  return m ? { hs: Number(m[1]), as: Number(m[2]) } : null;
}
