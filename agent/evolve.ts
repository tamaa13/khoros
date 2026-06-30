/**
 * The "evolve" layer: the OPTIONAL personalization on top of memory. It quietly
 * collects the user's football takes, and — when there's enough fresh material,
 * the device can handle it, and it's idle — fine-tunes the agent's OWN model on
 * them so the agent argues in the user's voice. The trained LoRA adapter is then
 * applied on the next agent load (Agent.init's loraPath).
 *
 * Memory stays the always-on "knows you" backbone; this is the style tune-up.
 * Potato machines / large models gate out to memory-only and never train.
 */
import os from "node:os";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Trainer } from "./finetune";
import { LLM_KEY, MODELS } from "../config";

// Tiers light enough to LoRA-finetune on-device. 4b/8b are too heavy → memory-only.
const EVOLVABLE = new Set(["1.7b"]);
const MIN_NEW_TAKES = 12; // accumulate enough fresh material before a tune-up
const PROMPTS = ["What's your take?", "Who wins?", "Your prediction for this one?", "Thoughts on the match?", "Who's your pick to win it all?"];

export class EvolveManager {
  private newTakes = 0;
  private running = false;
  private readonly modelKey = LLM_KEY;

  constructor(private readonly baseDir: string) {
    mkdirSync(this.modelDir(), { recursive: true });
  }

  private modelDir(): string {
    return join(this.baseDir, this.modelKey);
  }
  private trainPath(): string {
    return join(this.modelDir(), "train.jsonl");
  }
  private evalPath(): string {
    return join(this.modelDir(), "eval.jsonl");
  }
  private outDir(): string {
    return join(this.modelDir(), "out");
  }

  /** The trained adapter for the CURRENT model, if one exists (model-matched). */
  adapterPath(): string | undefined {
    const p = join(this.outDir(), "trained-lora-adapter.gguf");
    return existsSync(p) ? p : undefined;
  }

  /** Can this device + model evolve, or do we stay memory-only? */
  capability(): { canEvolve: boolean; reason: string; ramGB: number } {
    const ramGB = os.totalmem() / 1e9;
    if (!EVOLVABLE.has(this.modelKey)) return { canEvolve: false, reason: `model ${this.modelKey} too large to fine-tune on-device — memory-only`, ramGB };
    if (ramGB < 7.5) return { canEvolve: false, reason: "low RAM — memory-only", ramGB };
    return { canEvolve: true, reason: "ok", ramGB };
  }

  /** Is this user message a substantive take worth learning the voice of? */
  private isTake(text: string): boolean {
    const t = text.trim();
    if (t.length < 25 || t.startsWith("/")) return false;
    return /\b(win|wins|lose|beat|better|best|pick|predict|favou?rite|stronger|weak|champion|trophy|gonna|will|should|class|overrated|menang|kalah|juara|jagoan|pasti)\b/i.test(t);
  }

  /** Log a take as a training pair (a generic prompt → the user's words). */
  recordTake(userText: string): void {
    if (!this.capability().canEvolve || !this.isTake(userText)) return;
    const prompt = PROMPTS[this.newTakes % PROMPTS.length];
    const line = JSON.stringify({ messages: [{ role: "user", content: prompt }, { role: "assistant", content: userText.trim() }] });
    appendFileSync(this.trainPath(), line + "\n");
    this.newTakes += 1;
  }

  private allTakes(): string[] {
    try {
      return readFileSync(this.trainPath(), "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Whether a tune-up is warranted right now (caller adds the idle/charging gate). */
  status(): { ready: boolean; reason: string; newTakes: number; total: number } {
    const cap = this.capability();
    const total = this.allTakes().length;
    if (!cap.canEvolve) return { ready: false, reason: cap.reason, newTakes: this.newTakes, total };
    if (this.running) return { ready: false, reason: "tune-up already running", newTakes: this.newTakes, total };
    if (this.newTakes < MIN_NEW_TAKES) return { ready: false, reason: `${this.newTakes}/${MIN_NEW_TAKES} new takes`, newTakes: this.newTakes, total };
    return { ready: true, reason: "ready", newTakes: this.newTakes, total };
  }

  /** Force a tune-up now (manual /evolve now), bypassing the idle + threshold
   *  gates. Still respects capability (won't train a too-large model). Seeds a
   *  few demo takes if the user hasn't logged enough yet, so it's demoable. */
  async forceEvolve(seed: string[][], onProgress?: (p: any) => void): Promise<{ trained: boolean; reason?: string; outcome?: any }> {
    const cap = this.capability();
    if (!cap.canEvolve) return { trained: false, reason: cap.reason };
    if (this.running) return { trained: false, reason: "tune-up already running" };
    if (this.allTakes().length < 6) {
      const lines = seed.map(([u, a]) => JSON.stringify({ messages: [{ role: "user", content: u }, { role: "assistant", content: a }] }));
      appendFileSync(this.trainPath(), lines.join("\n") + "\n");
    }
    this.running = true;
    try {
      const lines = this.allTakes();
      writeFileSync(this.evalPath(), lines.slice(-2).join("\n"));
      const trainer = new Trainer();
      const outcome = await trainer.train(this.trainPath(), this.evalPath(), this.outDir(), onProgress, MODELS.llm);
      this.newTakes = 0;
      return { trained: true, outcome };
    } finally {
      this.running = false;
    }
  }

  /** Fine-tune the agent's own model on the collected takes. Caller gates on idle. */
  async maybeEvolve(onProgress?: (p: any) => void): Promise<{ trained: boolean; reason?: string; outcome?: any }> {
    const s = this.status();
    if (!s.ready) return { trained: false, reason: s.reason };
    this.running = true;
    try {
      const lines = this.allTakes();
      writeFileSync(this.evalPath(), lines.slice(-2).join("\n"));
      const trainer = new Trainer();
      // Train the AGENT's model so the adapter applies to the real agent.
      const outcome = await trainer.train(this.trainPath(), this.evalPath(), this.outDir(), onProgress, MODELS.llm);
      this.newTakes = 0;
      return { trained: true, outcome };
    } finally {
      this.running = false;
    }
  }
}
