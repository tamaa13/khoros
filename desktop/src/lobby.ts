/**
 * The live Match Room — the lobby is a watch-along (nobar). We pick a real match
 * (a live one if any is in play, else the most recent decided match) and drive
 * three things on one screen from REAL ESPN data:
 *   - a scoreboard (teams, flags, running score, minute)
 *   - a match feed (real per-minute events: free kicks, shots, goals, cards)
 *   - a few on-device agents who watch along and chat like real people
 *
 * A LIVE match is genuinely real-time (everyone watching sees the same moment).
 * A replay is personal/async — you start it whenever — so the agents behave like
 * humans at a nobar: they DON'T all show up at kickoff. One's on time, another
 * rolls in late asking the score, someone neutral drifts in to vibe. They react
 * casually to the moments, not in lockstep with every event. They blend in.
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
  backs: string | null; // the team they're rooting for (null = neutral)
  side: "home" | "away" | "neutral";
  arrival: number; // match-minute they "show up" at the nobar (0 = on time)
  agent: Agent;
}

const TURN = { learnPredictions: false, allowCallback: false, useTools: false } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Lobby {
  private agents: AgentSpec[] = [];
  private room: MatchRoomData | null = null;
  private live = false;
  private stopped = false;

  constructor(private readonly dataDir: string) {}

  /** Pick the match (live or latest) and gather a small nobar crowd. */
  async init(onStatus: (s: string) => void = () => {}): Promise<void> {
    onStatus("finding a live or recent match…");
    const pick = await liveOrLatestMatch();
    if (!pick) throw new Error("no World Cup match available right now");
    this.live = pick.live;
    this.room = await matchRoom(pick.id);
    if (!this.room) throw new Error("couldn't load the match data");

    // Staggered arrivals = the nobar feel: Dewi's on time, Rian rolls in during
    // the first half, Budi drifts in late just to vibe. For a live match they're
    // all already watching (arrival 0).
    const specs: Omit<AgentSpec, "agent">[] = [
      { name: "Dewi", emoji: "🟢", backs: this.room.home, side: "home", arrival: 0 },
      { name: "Rian", emoji: "🔵", backs: this.room.away, side: "away", arrival: this.live ? 0 : 11 },
      { name: "Budi", emoji: "🟡", backs: null, side: "neutral", arrival: this.live ? 0 : 27 },
    ];
    rmSync(this.dataDir, { recursive: true, force: true });
    for (const s of specs) {
      onStatus(`waking ${s.name}…`);
      const bias = s.backs
        ? `Lo lagi NOBAR bola, dukung ${s.backs}. Ngomong SANTAI & PENDEK (1 kalimat), kayak chat grup nobar — slang, becanda, gak formal, JANGAN kayak komentator TV.`
        : `Lo lagi NOBAR bola, netral, ikut seru-seruan aja. Ngomong SANTAI & PENDEK (1 kalimat) — suka nyeletuk, becanda, gak mihak sapa-sapa.`;
      const agent = new Agent({ bias, memoryFile: join(this.dataDir, `${s.name}.json`) });
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
        ? `🔴 LIVE — ${room.home} vs ${room.away}. Real-time dari ESPN, semua nonton barengan.`
        : `▶ Nobar replay — ${room.home} vs ${room.away}. Event asli diputar; orang-orang dateng beda-beda waktu (cuma room LIVE yang bener-bener barengan).`,
    });

    // Only the people already here at kickoff give a pre-match take.
    for (const a of this.agents.filter((x) => x.arrival === 0)) {
      if (this.stopped) return;
      const { reply } = await a.agent.turn(
        a.backs
          ? `Bentar lagi ${room.home} lawan ${room.away}. Lo jagoin ${a.backs} — prediksi santai dong, skor berapa?`
          : `Bentar lagi ${room.home} lawan ${room.away}. Lo netral, komentar pembuka santai aja.`,
        TURN,
      );
      emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
    }

    if (this.live) await this.runLive(emit);
    else await this.runReplay(emit);
  }

  /** Replay the finished match's real timeline, paced, with a nobar crowd. */
  private async runReplay(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    let hs = 0;
    let as = 0;
    const here = new Set(this.agents.filter((a) => a.arrival === 0).map((a) => a.name));
    for (const e of room.events) {
      if (this.stopped) return;
      emit({ kind: "feed", clock: e.clock, emoji: e.emoji, text: e.text, key: e.key });
      const isGoal = e.emoji === "⚽" && e.key;
      if (isGoal) {
        const sc = scoreFromGoalText(e.text, room.home, room.away);
        if (sc) {
          hs = sc.hs;
          as = sc.as;
        }
      }
      this.emitScore(emit, hs, as, e.clock || undefined);

      // Latecomers roll in as the clock passes their arrival minute.
      for (const a of this.agents) {
        if (this.stopped) return;
        if (here.has(a.name) || e.minute < a.arrival) continue;
        here.add(a.name);
        const { reply } = await a.agent.turn(
          `Lo baru NYAMPE nobar menit ${e.minute}', ketinggalan. Skor sekarang ${room.home} ${hs}-${as} ${room.away}. Sapa temen-temen + nyeletuk santai 1 kalimat, kayak baru dateng.`,
          TURN,
        );
        emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
      }

      // React casually — NOT to every event. Goals always get a rise; cards/big
      // chances only sometimes; and someone might chime in on top.
      if (isGoal) {
        await this.reactToGoal(emit, e, hs, as, here);
        if (chance(0.45)) await this.chime(emit, e, hs, as, here);
      } else if (e.key && chance(0.3)) {
        await this.chime(emit, e, hs, as, here);
      } else if (chance(0.08)) {
        await this.chime(emit, e, hs, as, here); // random idle banter, like real nobar
      }

      await sleep(2200);
    }
    if (this.stopped) return;
    this.emitScore(emit, room.homeScore, room.awayScore, "FT");
    emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
    await this.closingTakes(emit, room.homeScore, room.awayScore, here);
  }

  /** Poll ESPN for a live match; emit new events + score as they land. */
  private async runLive(emit: (m: LobbyMessage) => void): Promise<void> {
    const here = new Set(this.agents.map((a) => a.name));
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
        if (e.emoji === "⚽" && e.key) await this.reactToGoal(emit, e, room.homeScore, room.awayScore, here);
        else if (e.key && chance(0.35)) await this.chime(emit, e, room.homeScore, room.awayScore, here);
      }
      seen = room.events.length;
      if (room.state === "post") {
        emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
        await this.closingTakes(emit, room.homeScore, room.awayScore, here);
        return;
      }
      await sleep(25000);
    }
  }

  /** Whoever's side scored pops off; if they're not here yet, someone else does. */
  private async reactToGoal(emit: (m: LobbyMessage) => void, e: MatchEvent, hs: number, as: number, here: Set<string>): Promise<void> {
    if (this.stopped) return;
    const room = this.room!;
    let side: "home" | "away" | null = e.team === room.home ? "home" : e.team === room.away ? "away" : null;
    if (!side) side = e.text.includes(room.home) ? "home" : e.text.includes(room.away) ? "away" : null;
    const present = this.agents.filter((a) => here.has(a.name));
    if (!present.length) return;
    const speaker = present.find((a) => a.side === side) ?? pick(present);
    const mine = speaker.backs && side && (speaker.side === side);
    const { reply } = await speaker.agent.turn(
      `GOL! ${e.text} Skor ${room.home} ${hs}-${as} ${room.away}. ${mine ? "Tim lo yang gol — " : speaker.backs ? "Bukan tim lo yang gol — " : ""}reaksi spontan lo gimana? Santai, 1 kalimat.`,
      TURN,
    );
    emit({ kind: "agent", from: speaker.name, emoji: speaker.emoji, text: reply });
  }

  /** A random present agent drops a casual line about the moment. */
  private async chime(emit: (m: LobbyMessage) => void, e: MatchEvent, hs: number, as: number, here: Set<string>): Promise<void> {
    if (this.stopped) return;
    const present = this.agents.filter((a) => here.has(a.name));
    if (!present.length) return;
    const a = pick(present);
    const room = this.room!;
    const { reply } = await a.agent.turn(
      `Lagi nobar, barusan: "${e.text}" (skor ${room.home} ${hs}-${as} ${room.away}). Nyeletuk santai 1 kalimat aja.`,
      TURN,
    );
    emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
  }

  /** Everyone who's here reacts to the final score; the one who called it gloats. */
  private async closingTakes(emit: (m: LobbyMessage) => void, hs: number, as: number, here: Set<string>): Promise<void> {
    const room = this.room!;
    const winner = hs > as ? room.home : as > hs ? room.away : null;
    for (const a of this.agents.filter((x) => here.has(x.name))) {
      if (this.stopped) return;
      const right = !!a.backs && winner === a.backs;
      const { reply } = await a.agent.turn(
        a.backs
          ? `FULL TIME ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} menang.` : "Seri."} Tim lo (${a.backs}) ${right ? "MENANG" : winner ? "kalah" : "seri"}. Komentar penutup santai lo?`
          : `FULL TIME ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} menang.` : "Seri."} Komentar penutup santai lo (lo netral)?`,
        TURN,
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

const chance = (p: number) => Math.random() < p;
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
