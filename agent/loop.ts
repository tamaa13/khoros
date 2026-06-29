/**
 * The agent loop: stimulus -> recall memory -> think (persona) -> save memory
 * -> reply (+ optional speak). One deep agent, memory is the moat.
 */
import { CALLBACK_MIN_SCORE, MEMORY_FILE } from "../config";
import { Brain } from "./brain";
import { Memory, type Recalled } from "./memory";
import { Voice } from "./voice";

export interface TurnResult {
  reply: string;
  recalled: Recalled[];
  prediction: string | null; // new prediction extracted from this message
  callback: string | null; // past prediction this message confirmed, if any
  tools: string[]; // football tools the model called this turn
}

export interface InitOptions {
  voice?: boolean;
  onStatus?: (status: string) => void;
}

export class Agent {
  readonly memory: Memory;
  readonly brain: Brain;
  private voice?: Voice;

  constructor() {
    this.memory = new Memory(MEMORY_FILE);
    this.brain = new Brain();
  }

  async init(opts: InitOptions = {}): Promise<void> {
    const status = opts.onStatus ?? (() => {});
    status("loading memory + embeddings…");
    await this.memory.init();
    status("loading language model…");
    await this.brain.init();
    if (opts.voice) {
      this.voice = new Voice();
      status("loading voice…");
      await this.voice.init();
    }
  }

  async turn(userText: string): Promise<TurnResult> {
    const recalled = await this.memory.recall(userText);

    // The magic: if a recalled prediction is a strong match for what they just
    // said, treat it as confirmed and have the agent call it back. Decided in
    // code so it lands reliably instead of depending on the small model.
    const confirmed = recalled.find(
      (r) => r.entry.kind === "prediction" && r.score >= CALLBACK_MIN_SCORE,
    );

    const tools: string[] = [];
    const reply = await this.brain.respond(userText, recalled, confirmed?.entry.text ?? null, (t) =>
      tools.push(t),
    );

    await this.memory.save(userText, "chat");
    const prediction = await this.brain.extractPrediction(userText);
    if (prediction) await this.memory.save(prediction, "prediction");

    if (this.voice) await this.voice.speak(reply);

    return { reply, recalled, prediction, callback: confirmed?.entry.text ?? null, tools };
  }

  async close(): Promise<void> {
    await this.voice?.close();
    await this.brain.close();
    await this.memory.close();
  }
}
