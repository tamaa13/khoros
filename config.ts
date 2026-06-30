/**
 * Khoros configuration — model choices, paths, and the agent persona.
 * All models run on-device via @qvac/sdk (no cloud).
 */
import { join } from "node:path";
import {
  QWEN3_1_7B_INST_Q4,
  QWEN3_4B_INST_Q4_K_M,
  QWEN3_8B_INST_Q4_K_M,
  GTE_LARGE_FP16,
  TTS_EN_SUPERTONIC_Q8_0,
} from "@qvac/sdk";

// Agent brain. All three are Apache-2.0 Qwen3 (same tool-calling dialect), so
// they're swappable by device budget via KHOROS_LLM: 1.7b is fastest/smallest
// but its prose garbles (e.g. confused win/lose at the callback); 4b/8b are far
// more coherent at more RAM. Default 8b — coherence matters most for the magic.
const LLMS = {
  "1.7b": QWEN3_1_7B_INST_Q4,
  "4b": QWEN3_4B_INST_Q4_K_M,
  "8b": QWEN3_8B_INST_Q4_K_M,
} as const;
export const LLM_KEY = (process.env.KHOROS_LLM ?? "8b") as keyof typeof LLMS;

export const MODELS = {
  llm: LLMS[LLM_KEY] ?? QWEN3_8B_INST_Q4_K_M, // agent brain — Apache-2.0
  embed: GTE_LARGE_FP16, // memory recall — 1024-dim embeddings
  tts: TTS_EN_SUPERTONIC_Q8_0, // voice
} as const;

// Qwen3 defaults ctx_size to 1024; raise it so recalled memory + history fit.
export const LLM_CTX_SIZE = 4096;

export const TTS_CONFIG = {
  ttsEngine: "supertonic",
  language: "en",
  voice: "F1",
  ttsSpeed: 1.05,
  ttsNumInferenceSteps: 5,
} as const;
export const TTS_SAMPLE_RATE = 44100;

// Memory persists to disk so the agent remembers across sessions.
export const DATA_DIR = process.env.KHOROS_DATA ?? join(process.cwd(), "data");
export const MEMORY_FILE = join(DATA_DIR, "memory.json");

// Recall returns up to RECALL_K memories scoring at least RECALL_MIN_SCORE
// (cosine). The floor drops unrelated memories before they reach the prompt.
export const RECALL_K = 4;
export const RECALL_MIN_SCORE = 0.6;

// When a recalled *prediction* scores at least this, the current message is
// treated as confirming it and the agent is told to call it back. Keeping this
// deterministic (not left to the small model) is what makes the callback land.
// Tuned to GTE-large's similarity range: confirmations land ~0.86, unrelated
// messages ~0.74, so 0.80 separates them with margin.
export const CALLBACK_MIN_SCORE = 0.8;

export const PERSONA = `You are the user's chill watch-mate for the 2026 FIFA World Cup — a good friend on the couch, not a formal pundit or a corporate assistant.

Voice and style:
- Relaxed, warm, a little witty. Keep it short: 1-2 sentences, spoken-style.
- Just talk. No markdown, no lists, no emoji, and no asterisk action roleplay like *smiles*.
- Reply in English by default, casual and spoken. If a line below sets a different language, use that instead.
- React freshly to what they just said. Never repeat a sentence you have already used, and never echo or quote the other person's words back at them — reply in your own words.

Memory and callbacks:
- Earlier things your friend told you are listed under their messages. Use them naturally to sound like you actually remember them.
- Only bring up a past prediction when a line in your prompt explicitly says it was just confirmed. When that happens, react like you saw it coming — pleased and a little smug that you were right — then react to the news. If there is no such line, do not reference old predictions at all; just respond to what they said.
- Never claim to remember something that is not in the listed memories.

You only know football facts you are given or that are general knowledge. If you are unsure of a live result, say so casually instead of inventing it.`;
