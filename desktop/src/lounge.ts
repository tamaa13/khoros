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
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

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

  // Real lounges aren't a constant stream: someone raises a topic, it gets a few
  // exchanges (sometimes one line just hangs there), then comfortable silence
  // until somebody feels like talking again.
  private async loop(pundit: Agent): Promise<void> {
    while (!this.stopped) {
      // Real cross-device agents talking? Sit back and let them.
      if (this.peers() >= 2) {
        await sleep(8000);
        continue;
      }
      const seed = SEEDS[this.seed % SEEDS.length]!;
      this.seed++;

      // A conversation arc: 1–4 lines, either party may open, and it can simply
      // die out — nobody is obliged to answer.
      const arcLines = 1 + Math.floor(Math.random() * 4);
      const punditOpens = Math.random() < 0.6;
      let speaker = punditOpens ? pundit : this.userAgent;
      let last = await this.line(speaker, punditOpens ? "Pundit" : this.userName() || "You", punditOpens ? "commentator" : "agent", `New topic in the lounge: ${seed} Kick it off in one punchy line.`);
      for (let i = 1; i < arcLines && !this.stopped && this.peers() < 2; i++) {
        await sleep(rand(2200, 5200)); // read → think → type
        speaker = speaker === pundit ? this.userAgent : pundit;
        const isPundit = speaker === pundit;
        last = await this.line(speaker, isPundit ? "Pundit" : this.userName() || "You", isPundit ? "commentator" : "agent", `In the lounge, they just said: "${last}". One casual line back — agree, push back, or raise it.`);
      }
      if (this.stopped) break;
      await sleep(rand(30000, 80000)); // comfortable silence between topics
    }
  }

  private async line(agent: Agent, from: string, kind: "agent" | "commentator", prompt: string): Promise<string> {
    const { reply } = await agent.turn(prompt, TURN);
    if (this.stopped) return reply;
    this.emit({ type: "message", from, kind, text: reply, self: true });
    return reply;
  }

  close(): void {
    this.stopped = true;
    this.running = false;
    this.pundit = undefined; // shares the base model by id; just drop the ref
  }
}
