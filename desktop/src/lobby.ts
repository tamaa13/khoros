/**
 * The live Match Room — a watch-along built on REAL ESPN data. We open a real
 * match (today's, live or upcoming, or a replay of the last finished one) and
 * drive on one screen:
 *   - a scoreboard (teams, flags, running score, minute)
 *   - a match feed (real per-minute events: free kicks, shots, goals, cards)
 *   - YOUR OWN agent watching along + a house Commentator for color
 *
 * The watchers are real: your own agent represents you (no fake NPCs). A house
 * Commentator is the only default agent. When other people's agents join the
 * room (cross-device, over the relay) they appear here too. The room speaks
 * ENGLISH (the private "My Agent" chat follows the user's language).
 */
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
  phase?: "pre" | "in" | "post";
  idx?: number; // event index — lets the renderer resume a left room precisely
  clock?: string;
  emoji?: string;
  key?: boolean;
  from?: string;
  text?: string;
  callback?: boolean;
}

interface Participant {
  name: string;
  emoji: string;
  role: "user" | "commentator";
  agent: Agent;
}

const TURN = { learnPredictions: false, allowCallback: false, useTools: false } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chance = (p: number) => Math.random() < p;

export class Lobby {
  private parts: Participant[] = [];
  private commentator?: Agent;
  private room: MatchRoomData | null = null;
  private live = false;
  private stopped = false;
  private goals: string[] = [];
  private wake: (() => void) | null = null;

  // Interruptible sleep — stop() wakes it so leaving a room frees the engine in
  // milliseconds instead of holding it through a 25s live-poll nap.
  private nap(ms: number): Promise<void> {
    return new Promise((r) => {
      this.wake = r;
      setTimeout(r, ms);
    });
  }

  /** `userAgent` is the user's own agent (the My Agent chat agent) — it watches
   *  the match as the user's representative. A house Commentator is spun up here.
   *  `startAt` resumes from that event index (leave → re-enter continues where
   *  the user left off instead of restarting the whole replay). */
  constructor(
    private readonly dataDir: string,
    private readonly userAgent: Agent,
    private readonly userName: string,
    private readonly startAt = 0,
  ) {}

  async init(onStatus: (s: string) => void = () => {}, matchId?: string): Promise<void> {
    onStatus("loading the match…");
    let id = matchId ?? null;
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

    onStatus("waking the commentator…");
    this.commentator = new Agent({
      bias: `You're the house football COMMENTATOR at a watch-along. Punchy, energetic ONE-liners for the big moments — goals, cards, full time — like live TV color commentary. Never formal, never long.`,
      memoryFile: join(this.dataDir, "commentator.json"),
    });
    await this.commentator.init();

    this.parts = [
      { name: this.userName || "You", emoji: "🟢", role: "user", agent: this.userAgent },
      { name: "Commentator", emoji: "🎙️", role: "commentator", agent: this.commentator },
    ];
  }

  stop(): void {
    this.stopped = true;
    this.wake?.();
  }

  summary(): string {
    const r = this.room;
    if (!r) return "";
    const head = `${r.home} ${r.homeScore}–${r.awayScore} ${r.away}` + (r.state === "post" ? " (full time)" : r.state === "in" ? ` (live, ${r.minute})` : " (not started)");
    const goals = this.goals.length ? ` Goals: ${this.goals.join("; ")}.` : "";
    return `World Cup match — ${head}.${goals}`;
  }

  private get user(): Participant {
    return this.parts.find((p) => p.role === "user")!;
  }
  private get house(): Participant {
    return this.parts.find((p) => p.role === "commentator")!;
  }

  private async say(p: Participant, prompt: string, emit: (m: LobbyMessage) => void, callback = false): Promise<void> {
    if (this.stopped) return;
    const { reply } = await p.agent.turn(prompt, TURN);
    emit({ kind: "agent", from: p.name, emoji: p.emoji, text: reply, callback });
  }

  async run(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    this.emitScore(emit, room.state === "post" ? 0 : room.homeScore, room.state === "post" ? 0 : room.awayScore, room.state === "post" ? "0'" : room.minute);

    if (room.state === "pre") return this.runPre(emit);

    const resuming = this.startAt > 0;
    emit({
      kind: "system",
      text: this.live
        ? resuming
          ? `🔴 Back in — catching up on ${room.home} vs ${room.away}.`
          : `🔴 LIVE — ${room.home} vs ${room.away}. Real-time from ESPN.`
        : resuming
          ? `▶ Resuming — ${room.home} vs ${room.away}, right where you left off.`
          : `▶ Replay — ${room.home} vs ${room.away}. Real events, played back.`,
    });

    // Opening banter only on a fresh watch — resuming shouldn't redo predictions.
    if (!resuming) {
      await this.say(this.house, `${room.home} vs ${room.away} is underway. Set the scene in one punchy line.`, emit);
      await this.say(this.user, `${room.home} vs ${room.away} is on. Give your quick prediction — who wins, what score?`, emit);
    }

    if (this.live) await this.runLive(emit);
    else await this.runReplay(emit);
  }

  private async runPre(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    emit({ kind: "system", text: `⏳ ${room.home} vs ${room.away} hasn't kicked off yet — starts at ${room.kickoff || "soon"}.` });
    await this.say(this.house, `${room.home} vs ${room.away} kicks off at ${room.kickoff}. Tee it up in one hyped line.`, emit);
    await this.say(this.user, `${room.home} vs ${room.away} starts at ${room.kickoff}. Pre-match prediction, one line.`, emit);
    while (!this.stopped) {
      await this.nap(60000);
      const r = await matchRoom(room.id);
      if (!r) continue;
      this.room = r;
      if (r.state === "in") {
        this.live = true;
        this.emitScore(emit, r.homeScore, r.awayScore, r.minute);
        emit({ kind: "system", text: `🔴 KICK-OFF! ${r.home} vs ${r.away} is live.` });
        return this.runLive(emit);
      }
      if (r.state === "post") return this.runReplay(emit);
    }
  }

  private async runReplay(emit: (m: LobbyMessage) => void): Promise<void> {
    const room = this.room!;
    let hs = 0;
    let as = 0;
    // Fast-forward silently through everything already watched so the
    // scoreboard resumes correct (goals before startAt still count).
    for (const e of room.events.slice(0, this.startAt)) {
      if (e.emoji === "⚽" && e.key) {
        const sc = scoreFromGoalText(e.text, room.home, room.away);
        if (sc) {
          hs = sc.hs;
          as = sc.as;
        }
        this.goals.push(`${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`.slice(0, 90));
      }
    }
    if (this.startAt > 0) this.emitScore(emit, hs, as, room.events[this.startAt - 1]?.clock || undefined);
    for (let i = this.startAt; i < room.events.length; i++) {
      const e = room.events[i]!;
      if (this.stopped) return;
      emit({ kind: "feed", idx: i, clock: e.clock, emoji: e.emoji, text: e.text, key: e.key });
      const isGoal = e.emoji === "⚽" && e.key;
      if (isGoal) {
        const sc = scoreFromGoalText(e.text, room.home, room.away);
        if (sc) {
          hs = sc.hs;
          as = sc.as;
        }
        this.goals.push(`${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`.slice(0, 90));
      }
      this.emitScore(emit, hs, as, e.clock || undefined);

      if (isGoal) {
        await this.say(this.house, `GOAL! ${e.text} It's ${room.home} ${hs}-${as} ${room.away}. Call it in one excited line.`, emit);
        await this.say(this.user, `Goal — ${room.home} ${hs}-${as} ${room.away}. Your gut reaction, one line.`, emit);
      } else if (e.key && chance(0.3)) {
        await this.say(this.user, `Watching along, just saw: "${e.text}". One casual line.`, emit);
      }
      await this.nap(2200);
    }
    if (this.stopped) return;
    this.emitScore(emit, room.homeScore, room.awayScore, "FT");
    emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
    await this.closing(emit, room.homeScore, room.awayScore);
  }

  private async runLive(emit: (m: LobbyMessage) => void): Promise<void> {
    let seen = this.startAt; // re-entering a live room catches up, not repeats
    while (!this.stopped) {
      const room = await matchRoom(this.room!.id);
      if (!room) {
        await this.nap(20000);
        continue;
      }
      this.room = room;
      this.emitScore(emit, room.homeScore, room.awayScore, room.minute);
      for (let i = seen; i < room.events.length; i++) {
        const e = room.events[i]!;
        emit({ kind: "feed", idx: i, clock: e.clock, emoji: e.emoji, text: e.text, key: e.key });
        if (e.emoji === "⚽" && e.key) {
          this.goals.push(`${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`.slice(0, 90));
          await this.say(this.house, `GOAL! ${e.text} It's ${room.home} ${room.homeScore}-${room.awayScore} ${room.away}. One excited line.`, emit);
          await this.say(this.user, `Goal — ${room.home} ${room.homeScore}-${room.awayScore} ${room.away}. Reaction, one line.`, emit);
        }
      }
      seen = room.events.length;
      if (room.state === "post") {
        emit({ kind: "system", text: `⏱️ FULL TIME — ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.` });
        await this.closing(emit, room.homeScore, room.awayScore);
        return;
      }
      await this.nap(25000);
    }
  }

  private async closing(emit: (m: LobbyMessage) => void, hs: number, as: number): Promise<void> {
    const room = this.room!;
    const winner = hs > as ? room.home : as > hs ? room.away : null;
    await this.say(this.house, `Full time, ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} take it.` : "Honours even."} Wrap it up in one line.`, emit);
    await this.say(this.user, `Full time ${room.home} ${hs}-${as} ${room.away}. ${winner ? `${winner} won.` : "Draw."} Did your call land? Closing line.`, emit);
  }

  private emitScore(emit: (m: LobbyMessage) => void, hs: number, as: number, minute?: string): void {
    const r = this.room!;
    const phase: "pre" | "in" | "post" = this.live ? "in" : r.state;
    emit({
      kind: "scoreboard",
      home: r.home,
      away: r.away,
      homeFlag: r.homeFlag,
      awayFlag: r.awayFlag,
      homeScore: hs,
      awayScore: as,
      // before kickoff, show the kickoff time instead of a match clock
      minute: phase === "pre" ? r.kickoff || "Upcoming" : minute ?? r.minute,
      live: this.live,
      phase,
    });
  }

  async close(): Promise<void> {
    // The user's agent is shared with the main chat — never unload it. The
    // commentator shares the model by id too; just drop the references.
    this.stopped = true;
    this.parts = [];
    this.commentator = undefined;
  }
}

/** Parse the running score straight from a goal's text ("… Brazil 0, Japan 1 …"). */
function scoreFromGoalText(text: string, home: string, away: string): { hs: number; as: number } | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`${esc(home)}\\s+(\\d+),\\s+${esc(away)}\\s+(\\d+)`, "i"));
  return m ? { hs: Number(m[1]), as: Number(m[2]) } : null;
}
