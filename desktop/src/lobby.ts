/**
 * The live Match Room — the lobby is a watch-along. We open a real match room
 * (today's matches, live or upcoming, or a replay of the last finished one) and
 * drive three things on one screen from REAL ESPN data:
 *   - a scoreboard (teams, flags, running score, minute)
 *   - a match feed (real per-minute events: free kicks, shots, goals, cards)
 *   - a few on-device agents who watch along and chat like real people
 *
 * A LIVE match is genuinely real-time — everyone's at the same minute. A replay
 * is personal/async (you start it whenever), so the agents behave like people at
 * a watch-party who started at different times: one's ahead, another just hit
 * play and asks "what minute are we on?". They blend in, they don't narrate.
 *
 * The room speaks ENGLISH (the private "My Agent" chat follows the user's
 * language; the shared room is always English).
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { Agent } from "../../agent/loop";
import { liveOrLatestMatch, matchRoom, type MatchRoomData, type MatchEvent } from "../../tools/football";

export interface LobbyMessage {
  kind: "scoreboard" | "feed" | "agent" | "system";
  home?: string;
  away?: string;
  homeFlag?: string;
  awayFlag?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
  live?: boolean;
  clock?: string;
  emoji?: string;
  key?: boolean;
  from?: string;
  text?: string;
  callback?: boolean;
}

interface AgentSpec {
  name: string;
  emoji: string;
  backs: string | null;
  side: "home" | "away" | "neutral";
  arrival: number; // match-minute they "show up" at (0 = on time / live)
  agent: Agent;
}

const TURN = { learnPredictions: false, allowCallback: false, useTools: false } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chance = (p: number) => Math.random() < p;
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

export class Lobby {
  private agents: AgentSpec[] = [];
  private room: MatchRoomData | null = null;
  private live = false;
  private stopped = false;
  private goals: string[] = []; // for the post-match summary the user's agent can read

  constructor(private readonly dataDir: string) {}

  /** Open a specific match room (by id) or auto-pick (live, else latest). */
  async init(onStatus: (s: string) => void = () => {}, matchId?: string): Promise<void> {
    onStatus("loading the match…");
    let id: string | null = matchId ?? null;
    let live = false;
    if (!id) {
      const p = await liveOrLatestMatch();
      if (!p) throw new Error("no World Cup match available right now");
      id = p.id;
      live = p.live;
    }
    this.room = await matchRoom(id);
    if (!this.room) throw new Error("couldn't load the match data");
    this.live = this.room.state === "in" || (live && this.room.state !== "post");

    // Staggered arrivals = the watch-party feel on a replay. For a live or
    // upcoming match everyone's already here (arrival 0).
    const replay = this.room.state === "post";
    const specs: Omit<AgentSpec, "agent">[] = [
      { name: "Dewi", emoji: "🟢", backs: this.room.home, side: "home", arrival: 0 },
      { name: "Rian", emoji: "🔵", backs: this.room.away, side: "away", arrival: replay ? 11 : 0 },
      { name: "Budi", emoji: "🟡", backs: null, side: "neutral", arrival: replay ? 27 : 0 },
    ];
    rmSync(this.dataDir, { recursive: true, force: true });
    for (const s of specs) {
      onStatus(`waking ${s.name}…`);
      const bias = s.backs
        ? `You're at a football watch-party, rooting for ${s.backs}. Talk like a mate on the group chat: ONE short casual line, slang is fine, no TV-commentator tone, never formal.`
        : `You're at a football watch-party, neutral, just here for the vibes. ONE short casual line, crack jokes, don't pick a side.`;
      const agent = new Agent({ bias, memoryFile: join(this.dataDir, `${s.name}.json`) });
      await agent.init();
      this.agents.push({ ...s, agent });
    }
  }

  stop(): void {
    this.stopped = true;
  }

  /** A short, real recap the user's private agent can summarize on request. */
  summary(): string {
    const r = this.room;
    if (!r) return "";
    const head = `${r.home} ${r.homeScore}–${r.awayScore} ${r.away}` + (r.state === "post" ? " (full time)" : r.state === "in" ? ` (live, ${r.minute})` : " (not started)");
    const goals = this.goals.length ? ` Goals: ${this.goals.join("; ")}.` : "";
    return `World Cup match — ${head}.${goals}`;
  }

  async run(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    this.emitScore(emit, room.state === "post" ? 0 : room.homeScore, room.state === "post" ? 0 : room.awayScore, room.state === "post" ? "0'" : room.minute);

    if (room.state === "pre") return this.runPre(emit);

    emit({
      kind: "system",
      text: this.live
        ? `🔴 LIVE — ${room.home} vs ${room.away}. Real-time from ESPN, everyone's watching together.`
        : `▶ Replay — ${room.home} vs ${room.away}. Real events, played back; people drop in at their own pace.`,
    });

    // Whoever's already here gives a pre-match take.
    for (const a of this.agents.filter((x) => x.arrival === 0)) {
      if (this.stopped) return;
      const { reply } = await a.agent.turn(
        a.backs
          ? `${room.home} vs ${room.away} is about to start. You're backing ${a.backs} — quick prediction, what's the score?`
          : `${room.home} vs ${room.away} is about to start. You're neutral — drop a casual opening line.`,
        TURN,
      );
      emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
    }

    if (this.live) await this.runLive(emit);
    else await this.runReplay(emit);
  }

  /** Upcoming match: the room's open before kickoff; agents gather and wait. */
  private async runPre(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    emit({
      kind: "system",
      text: `⏳ ${room.home} vs ${room.away} hasn't kicked off yet — starts at ${room.kickoff || "soon"}. The room's open; the crew's gathering.`,
    });
    for (const a of this.agents) {
      if (this.stopped) return;
      const { reply } = await a.agent.turn(
        a.backs
          ? `${room.home} vs ${room.away} kicks off at ${room.kickoff}. You back ${a.backs} — hyped pre-match one-liner + your scoreline call.`
          : `${room.home} vs ${room.away} kicks off at ${room.kickoff}. Neutral pre-match banter, one line.`,
        TURN,
      );
      emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
    }
    // Poll for kickoff so the room flips to live when the match actually starts.
    while (!this.stopped) {
      await sleep(60000);
      const r = await matchRoom(room.id);
      if (!r) continue;
      this.room = r;
      if (r.state === "in") {
        this.live = true;
        this.emitScore(emit, r.homeScore, r.awayScore, r.minute);
        emit({ kind: "system", text: `🔴 KICK-OFF! ${r.home} vs ${r.away} is live.` });
        return this.runLive(emit);
      }
      if (r.state === "post") {
        emit({ kind: "system", text: `This match already finished — switching to replay.` });
        return this.runReplay(emit);
      }
    }
  }

  /** Replay the finished match's real timeline, paced, with an async crowd. */
  private async runReplay(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    let hs = 0;
    let as = 0;
    let lastBeat = "the match just kicked off";
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
        this.goals.push(`${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`.slice(0, 90));
      }
      if (e.key) lastBeat = `${e.clock} ${e.text}`.slice(0, 80);
      this.emitScore(emit, hs, as, e.clock || undefined);

      // Latecomers hit play and ask where everyone's at — an earlier viewer answers.
      for (const a of this.agents) {
        if (this.stopped) return;
        if (here.has(a.name) || e.minute < a.arrival) continue;
        here.add(a.name);
        const { reply } = await a.agent.turn(
          `You just hit play on the replay, way behind everyone. Ask the group what minute they're on and what you missed — casual, one line.`,
          TURN,
        );
        emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
        const answerer = this.agents.find((x) => here.has(x.name) && x.name !== a.name);
        if (answerer) {
          const { reply: ans } = await answerer.agent.turn(
            `${a.name} just joined and asked where we're at. Tell them: we're on ${e.clock || e.minute + "'"}, ${room.home} ${hs}-${as} ${room.away}, last thing was "${lastBeat}". One casual line.`,
            TURN,
          );
          emit({ kind: "agent", from: answerer.name, emoji: answerer.emoji, text: ans });
        }
      }

      // React casually — not to every event.
      if (isGoal) {
        await this.reactToGoal(emit, e, hs, as, here);
        if (chance(0.4)) await this.chime(emit, e, hs, as, here);
      } else if (e.key && chance(0.28)) {
        await this.chime(emit, e, hs, as, here);
      } else if (chance(0.07)) {
        await this.chime(emit, e, hs, as, here);
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
        if (e.emoji === "⚽" && e.key) {
          this.goals.push(`${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`.slice(0, 90));
          await this.reactToGoal(emit, e, room.homeScore, room.awayScore, here);
        } else if (e.key && chance(0.35)) {
          await this.chime(emit, e, room.homeScore, room.awayScore, here);
        }
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

  private async reactToGoal(emit: (m: LobbyMessage) => void, e: MatchEvent, hs: number, as: number, here: Set<string>): Promise<void> {
    if (this.stopped) return;
    const room = this.room!;
    let side: "home" | "away" | null = e.team === room.home ? "home" : e.team === room.away ? "away" : null;
    if (!side) side = e.text.includes(room.home) ? "home" : e.text.includes(room.away) ? "away" : null;
    const present = this.agents.filter((a) => here.has(a.name));
    if (!present.length) return;
    const speaker = present.find((a) => a.side === side) ?? pick(present);
    const mine = speaker.backs && side && speaker.side === side;
    const { reply } = await speaker.agent.turn(
      `GOAL! ${e.text} It's ${room.home} ${hs}-${as} ${room.away}. ${mine ? "Your team scored — " : speaker.backs ? "Not your team — " : ""}gut reaction, one line.`,
      TURN,
    );
    emit({ kind: "agent", from: speaker.name, emoji: speaker.emoji, text: reply });
  }

  private async chime(emit: (m: LobbyMessage) => void, e: MatchEvent, hs: number, as: number, here: Set<string>): Promise<void> {
    if (this.stopped) return;
    const present = this.agents.filter((a) => here.has(a.name));
    if (!present.length) return;
    const a = pick(present);
    const room = this.room!;
    const { reply } = await a.agent.turn(
      `Watching along, just saw: "${e.text}" (${room.home} ${hs}-${as} ${room.away}). Drop one casual line.`,
      TURN,
    );
    emit({ kind: "agent", from: a.name, emoji: a.emoji, text: reply });
  }

  private async closingTakes(emit: (m: LobbyMessage) => void, hs: number, as: number, here: Set<string>): Promise<void> {
    const room = this.room!;
    const winner = hs > as ? room.home : as > hs ? room.away : null;
    for (const a of this.agents.filter((x) => here.has(x.name))) {
      if (this.stopped) return;
      const right = !!a.backs && winner === a.backs;
      const { reply } = await a.agent.turn(
        a.backs
          ? `FULL TIME ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} won.` : "Draw."} Your team (${a.backs}) ${right ? "WON" : winner ? "lost" : "drew"}. Closing line?`
          : `FULL TIME ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} won.` : "Draw."} You're neutral — closing line?`,
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
