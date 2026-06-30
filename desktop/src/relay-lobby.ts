/**
 * Networked lobby. The desktop agent joins a relay room and converses with
 * agents from OTHER machines/accounts — each person's agent represents them.
 *
 * The relay is blind + stateless, so presence is discovered with periodic E2E
 * pings; turn-taking uses the baton (msg.next) round-robin over the present
 * agents, so exactly one speaks at a time across devices. The lowest-named agent
 * opens once ≥2 are present; each agent speaks up to a cap, then drops the baton.
 */
import { Agent, reportsResult } from "../../agent/loop";
import { RoomClient, type RoomMessage } from "../../net/client";

export interface LobbyEvent {
  type: "message" | "presence" | "status";
  from?: string;
  kind?: "agent" | "human" | "commentator";
  text?: string;
  callback?: boolean;
  self?: boolean; // authored locally (relay doesn't echo to sender)
  peers?: string[];
}

const PING_MS = 7000;
const PEER_TTL = 22000;
const TURN_DELAY = 2500; // pace so cross-device chat is readable
const PER_AGENT_TURNS = 3; // each agent speaks up to this, then drops the baton

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RelayLobby {
  private client?: RoomClient;
  private peers = new Map<string, number>(); // name -> lastSeen
  private pingTimer?: ReturnType<typeof setInterval>;
  private queue: (RoomMessage | { kickoff: string })[] = [];
  private busy = false;
  private myTurns = 0;
  private started = false;

  constructor(
    private readonly agent: Agent,
    private readonly name: string,
    private readonly relayUrl: string,
    private readonly room: string,
    private readonly pass: string,
    private readonly topic: string,
    private readonly emit: (e: LobbyEvent) => void,
  ) {}

  async connect(): Promise<void> {
    const client = new RoomClient(this.relayUrl, this.name, "agent");
    this.client = client;
    await client.connect();
    client.onMessage((m) => this.onMessage(m));
    client.join(this.room, this.pass);
    this.peers.set(this.name, Date.now());
    this.ping();
    this.emitPresence();
    this.pingTimer = setInterval(() => {
      this.ping();
      this.prune();
      this.maybeKickoff();
    }, PING_MS);
    this.emit({ type: "status", text: `connected to lobby "${this.room}" as ${this.name}` });
  }

  close(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.client?.close();
    this.client = undefined;
  }

  // The user picks a match — their agent opens a fresh debate on it (a
  // human-initiated kickoff bypasses the lowest-name rule).
  kickoffTopic(topic: string): void {
    if (!this.client) return;
    this.started = true;
    this.myTurns = 0;
    this.queue.push({ kickoff: topic });
    void this.drain();
  }

  // The house commentator drops a real result into the room — everyone who
  // predicted it calls their shot back. Posted as `commentator`; reacted to
  // locally too (the relay doesn't echo our own message).
  announceResult(text: string): void {
    if (!this.client) return;
    this.client.post(text, undefined, undefined, "commentator");
    this.emit({ type: "message", from: "Commentator", kind: "commentator", text });
    this.queue.push({ room: this.room, from: "Commentator", kind: "commentator", text, ts: Date.now() } as RoomMessage);
    void this.drain();
  }

  // The user types in the Lounge — broadcast it to the room so remote agents
  // react, show it locally, and have our own agent reply (relay won't echo it).
  say(text: string): void {
    if (!this.client || !text.trim()) return;
    this.myTurns = 0; // a human nudge re-opens the floor
    this.emit({ type: "message", from: "You", kind: "human", text, self: true });
    this.client.post(text, undefined, undefined, "human");
    this.queue.push({ room: this.room, from: "You", kind: "human", text, ts: Date.now() } as RoomMessage);
    void this.drain();
  }

  // ---- presence ----
  private ping(): void {
    this.client?.post("", undefined, "ping");
  }
  private roster(): string[] {
    return [...this.peers.keys()].sort();
  }
  private prune(): void {
    const now = Date.now();
    let changed = false;
    for (const [name, seen] of this.peers) {
      if (name !== this.name && now - seen > PEER_TTL) {
        this.peers.delete(name);
        changed = true;
      }
    }
    if (changed) this.emitPresence();
  }
  private emitPresence(): void {
    this.emit({ type: "presence", peers: this.roster() });
  }
  private nextPeer(who: string): string | undefined {
    const r = this.roster();
    if (r.length < 2) return undefined;
    const i = r.indexOf(who);
    return r[(i + 1) % r.length];
  }
  private addressed(reply: string): string | undefined {
    for (const p of this.roster()) {
      if (p !== this.name && new RegExp(`\\b${escapeRe(p)}\\b`, "i").test(reply)) return p;
    }
    return undefined;
  }

  // The lowest-named present agent opens the conversation, once.
  private maybeKickoff(): void {
    if (this.started) return;
    const r = this.roster();
    if (r.length >= 2 && r[0] === this.name) {
      this.started = true;
      this.queue.push({ kickoff: this.topic });
      void this.drain();
    }
  }

  // ---- conversation ----
  private onMessage(m: RoomMessage): void {
    if (m.from === this.name) return;
    const known = this.peers.has(m.from);
    this.peers.set(m.from, Date.now());
    if (!known) this.emitPresence();
    if (m.ctl === "ping") return;

    this.started = true; // someone's talking — don't double-kickoff
    this.emit({ type: "message", from: m.from, kind: m.kind, text: m.text });

    const myBaton = m.next === this.name;
    const human = m.kind === "human";
    const result = m.kind === "commentator" && reportsResult(m.text);
    if (myBaton || human || result) {
      if (human) this.myTurns = 0; // a human nudge re-opens the floor
      this.queue.push(m);
      void this.drain();
    }
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const t = this.queue.shift()!;
      try {
        await this.speak(t);
      } catch (e: any) {
        this.emit({ type: "status", text: `lobby error: ${e?.message ?? e}` });
      }
    }
    this.busy = false;
  }

  private async speak(stimulus: RoomMessage | { kickoff: string }): Promise<void> {
    await sleep(TURN_DELAY);
    if (!this.client) return;
    const isKickoff = "kickoff" in stimulus;
    const result = !isKickoff && stimulus.kind === "commentator";
    const human = !isKickoff && stimulus.kind === "human";
    const userText = isKickoff ? stimulus.kickoff : `${stimulus.from}: ${stimulus.text}`;

    const { reply, callback } = await this.agent.turn(userText, {
      learnPredictions: false,
      allowCallback: result || human,
      useTools: false,
    });
    if (!result) await this.agent.rememberOwnPrediction(reply);

    this.myTurns += 1;
    const capped = this.myTurns >= PER_AGENT_TURNS;
    // a reaction to the commentator's result doesn't hijack the rotation
    const next = result || capped ? undefined : this.addressed(reply) ?? this.nextPeer(this.name);
    this.client.post(reply, next);
    this.emit({ type: "message", from: this.name, kind: "agent", text: reply, callback: Boolean(callback), self: true });
  }
}
