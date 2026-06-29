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
  // Model-download progress (first run pulls ~GB). `model` names which one.
  onProgress?: (p: { model: string; percentage?: number }) => void;
}

export interface TurnOptions {
  // Extract + remember a prediction from this message. Off for match commentary,
  // which narrates outcomes rather than stating the speaker's own predictions.
  learnPredictions?: boolean;
  // Allow a "told you so" callback this turn. Off during lobby banter so it only
  // fires on real news (the commentator's result), not hypothetical chatter.
  allowCallback?: boolean;
  // Let the agent call football tools this turn. Off in the lobby so agents opine
  // instead of looking up (and spoiling) a result the commentator will reveal.
  useTools?: boolean;
}

// A callback only makes sense when the new message actually reports an outcome —
// not just because it mentions the same teams as an earlier prediction. The
// score pattern excludes dates (the lookbehind/lookahead reject "2026-06-28").
export function reportsResult(text: string): boolean {
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

  constructor(opts: { bias?: string; memoryFile?: string } = {}) {
    // memoryFile lets several agents run in one process with isolated memory
    // (the lobby) instead of all sharing the default store.
    this.memory = new Memory(opts.memoryFile ?? MEMORY_FILE);
    this.brain = new Brain(opts.bias);
  }

  async init(opts: InitOptions = {}): Promise<void> {
    const status = opts.onStatus ?? (() => {});
    // Only hand loadModel a progress callback when one is actually wanted: under
    // Electron's Bare worker, passing onProgress to loadModel hangs the worker.
    const prog = opts.onProgress;
    status("loading memory + embeddings…");
    await this.memory.init(prog ? (p) => prog({ model: "memory", percentage: p.percentage }) : undefined);
    status("loading language model…");
    await this.brain.init(prog ? (p) => prog({ model: "brain", percentage: p.percentage }) : undefined);
    if (opts.voice) {
      this.voice = new Voice();
      status("loading voice…");
      await this.voice.init();
    }
  }

  // Set the agent's preferred reply language (from /language). Empty = English.
  setLanguage(language: string | undefined): void {
    this.brain.setLanguage(language);
  }

  async turn(userText: string, opts: TurnOptions = {}): Promise<TurnResult> {
    const recalled = await this.memory.recall(userText);

    // The magic: when this message reports an outcome that confirms a recalled
    // prediction (strong match), have the agent call it back. Gated on a real
    // result so it fires once on the news, not on every mention of the teams.
    let confirmed =
      (opts.allowCallback ?? true) && reportsResult(userText)
        ? recalled.find((r) => r.entry.kind === "prediction" && r.score >= CALLBACK_MIN_SCORE)
        : undefined;
    // Topic match isn't enough — verify the outcome actually confirms the call,
    // so a rival who picked the loser doesn't also get to say "told you so".
    if (confirmed && !(await this.brain.confirmsPrediction(confirmed.entry.text, userText))) {
      confirmed = undefined;
    }

    const tools: string[] = [];
    const reply = await this.brain.respond(
      userText,
      recalled,
      confirmed?.entry.text ?? null,
      (t) => tools.push(t),
      opts.useTools ?? true,
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

  // Remember a prediction the agent itself just made (from its own reply), so it
  // can later call its own shot back. Used in the lobby, where each agent voices
  // its own take rather than reacting to someone else's.
  async rememberOwnPrediction(reply: string): Promise<string | null> {
    const prediction = await this.brain.extractPrediction(reply);
    if (prediction) await this.memory.save(prediction, "prediction");
    return prediction;
  }

  async close(): Promise<void> {
    await this.voice?.close();
    await this.brain.close();
    await this.memory.close();
  }
}
