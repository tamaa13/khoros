/**
 * The World Cup Lounge — a general, always-alive discussion between on-device
 * agents (the society of agents). Unlike the relay lobby (which needs ≥2 agents
 * across devices) this runs solo: the user's OWN agent and a house Pundit trade
 * takes about the 2026 World Cup, rolling through topics. It is NOT a user chat
 * box — the user watches their agent and the pundit talk.
 *
 * When real agents from other devices are present on the relay, this pauses and
 * yields the floor to that live cross-device conversation (no double-voicing).
 *
 * Turns are EPHEMERAL — lounge banter never touches the user's agent memory.
 */
import { join } from "node:path";
import { Agent } from "../../agent/loop";

export interface LoungeEvent {
  type: "message" | "presence" | "status";
  from?: string;
  kind?: "agent" | "commentator";
  text?: string;
  self?: boolean;
  peers?: string[];
}

// Rolling discussion seeds — general World Cup talk, no single match.
const SEEDS = [
  "Who's your pick to win the 2026 World Cup, and why?",
  "Biggest surprise of the tournament so far?",
  "Which young player has caught your eye this World Cup?",
  "USA, Mexico or Canada — which host has the best atmosphere?",
  "Most overrated team right now?",
  "A dark horse nobody's talking about?",
  "Golden Boot — who's your bet?",
  "Best goal you've seen so far?",
  "Which team's playing the most exciting football?",
  "Bold prediction for the knockouts — give us one.",
];

const TURN = { learnPredictions: false, allowCallback: false, useTools: false, ephemeral: true } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PACE = 2600; // gap between lines, readable
const GAP = 5000; // gap between topics

export class Lounge {
  private pundit?: Agent;
  private running = false;
  private stopped = false;
  private seed = 0;

  /** `peers` returns the current relay roster size; when ≥2 real agents are on
   *  the relay we yield to that live conversation. */
  constructor(
    private readonly dataDir: string,
    private readonly userAgent: Agent,
    private readonly userName: () => string,
    private readonly emit: (e: LoungeEvent) => void,
    private readonly peers: () => number,
  ) {}

  private async ensurePundit(): Promise<Agent> {
    if (this.pundit) return this.pundit;
    const pundit = new Agent({
      bias: `You're a sharp, fun football PUNDIT hanging in a World Cup watch-party lounge, chatting with another fan's agent about the 2026 World Cup. Opinions, hot takes, friendly banter. Keep it to ONE short, casual line — like a group chat, never formal, never a lecture.`,
      memoryFile: join(this.dataDir, "lounge-pundit.json"),
    });
    await pundit.init();
    this.pundit = pundit;
    return pundit;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    const pundit = await this.ensurePundit();
    void this.loop(pundit);
  }

  stop(): void {
    this.stopped = true;
    this.running = false;
  }

  private async loop(pundit: Agent): Promise<void> {
    while (!this.stopped) {
      // Real cross-device agents talking? Sit back and let them.
      if (this.peers() >= 2) {
        await sleep(GAP);
        continue;
      }
      const seed = SEEDS[this.seed % SEEDS.length]!;
      this.seed++;

      let last = await this.line(pundit, "Pundit", "commentator", `New topic in the lounge: ${seed} Kick it off in one punchy line.`);
      for (let i = 0; i < 2 && !this.stopped && this.peers() < 2; i++) {
        last = await this.line(this.userAgent, this.userName() || "You", "agent", `You're in the World Cup lounge. Someone just said: "${last}". Reply with your own take in one casual line.`);
        if (this.stopped) break;
        last = await this.line(pundit, "Pundit", "commentator", `In the lounge, they replied: "${last}". Come back with one line — agree, push back, or raise it.`);
      }
      if (this.stopped) break;
      await sleep(GAP);
    }
  }

  private async line(agent: Agent, from: string, kind: "agent" | "commentator", prompt: string): Promise<string> {
    const { reply } = await agent.turn(prompt, TURN);
    if (this.stopped) return reply;
    this.emit({ type: "message", from, kind, text: reply, self: true });
    await sleep(PACE);
    return reply;
  }

  close(): void {
    this.stopped = true;
    this.running = false;
    this.pundit = undefined; // shares the base model by id; just drop the ref
  }
}
