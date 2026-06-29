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

export interface TurnOptions {
  // Extract + remember a prediction from this message. Off for match commentary,
  // which narrates outcomes rather than stating the speaker's own predictions.
  learnPredictions?: boolean;
}

// A callback only makes sense when the new message actually reports an outcome —
// not just because it mentions the same teams as an earlier prediction. The
// score pattern excludes dates (the lookbehind/lookahead reject "2026-06-28").
function reportsResult(text: string): boolean {
  return (
    /(?<![\d-])\d{1,2}\s*[-–]\s*\d{1,2}(?![\d-])/.test(text) ||
    /\b(won|win|wins|winner|beat|beats|defeat|defeats|lost|menang|kalah|imbang|draw|full[ -]?time|final whistle|juara|champions?)\b/i.test(
      text,
    )
  );
}

export class Agent {
  readonly memory: Memory;
  readonly brain: Brain;
  private voice?: Voice;

  constructor(opts: { bias?: string } = {}) {
    this.memory = new Memory(MEMORY_FILE);
    this.brain = new Brain(opts.bias);
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

  async turn(userText: string, opts: TurnOptions = {}): Promise<TurnResult> {
    const recalled = await this.memory.recall(userText);

    // The magic: when this message reports an outcome that confirms a recalled
    // prediction (strong match), have the agent call it back. Gated on a real
    // result so it fires once on the news, not on every mention of the teams.
    const confirmed = reportsResult(userText)
      ? recalled.find((r) => r.entry.kind === "prediction" && r.score >= CALLBACK_MIN_SCORE)
      : undefined;

    const tools: string[] = [];
    const reply = await this.brain.respond(userText, recalled, confirmed?.entry.text ?? null, (t) =>
      tools.push(t),
    );

    await this.memory.save(userText, "chat");
    let prediction: string | null = null;
    if (opts.learnPredictions ?? true) {
      prediction = await this.brain.extractPrediction(userText);
      if (prediction) await this.memory.save(prediction, "prediction");
    }

    if (this.voice) await this.voice.speak(reply);

    return { reply, recalled, prediction, callback: confirmed?.entry.text ?? null, tools };
  }

  async close(): Promise<void> {
    await this.voice?.close();
    await this.brain.close();
    await this.memory.close();
  }
}
