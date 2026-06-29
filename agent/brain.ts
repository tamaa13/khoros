/**
 * The agent's reasoning. Qwen3 1.7B runs on-device for both the persona reply
 * and a lightweight prediction-extraction pass.
 */
import { completion, loadModel, unloadModel } from "@qvac/sdk";
import { z } from "zod";
import { LLM_CTX_SIZE, MODELS, PERSONA } from "../config";
import { getFixtures, getLive } from "../tools/football";
import type { Recalled } from "./memory";

export interface Msg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

// Tool-calling is the QVAC showcase: the model decides when it needs real World
// Cup data, calls a tool, and answers from the result.
const TOOLS = [
  {
    name: "get_fixtures",
    description:
      "Look up 2026 World Cup matches. when='upcoming' for the schedule of matches not played yet. when='recent' for matches that already finished and their FINAL SCORES — use this for any question about results, scores, or what happened (including yesterday or the last few days).",
    parameters: z.object({
      when: z
        .enum(["upcoming", "recent"])
        .describe("'upcoming' = future schedule; 'recent' = finished matches with final scores"),
    }),
  },
  {
    name: "get_live",
    description:
      "Look up matches scheduled specifically for TODAY in the 2026 World Cup. Use only when the user asks what is on today or playing right now — not for past results.",
    parameters: z.object({}),
  },
];

const EXECUTORS: Record<string, (args: any) => Promise<string>> = {
  get_fixtures: (args) => getFixtures(args?.when ?? "upcoming"),
  get_live: () => getLive(),
};

const TOOLS_HINT =
  "\n\nYou can call tools to look up real 2026 World Cup fixtures, results, and today's matches. Use them whenever the user asks about actual matches or scores; otherwise just chat. Never invent scores or fixtures.";

function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

// The small model ignores "no emoji / no roleplay" often enough that we enforce
// it after the fact: strip emoji, *action* roleplay, and #hashtags.
function sanitize(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\*[^*\n]{1,40}\*/g, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Qwen3 emits a <think> block then the answer. `final.content` is the clean
// answer; the fallbacks cover models that only populate the raw text.
function readReply(final: any): string {
  if (typeof final?.content === "string" && final.content.trim()) {
    return final.content.trim();
  }
  const raw = final?.raw?.fullText ?? final?.text ?? "";
  return stripThink(typeof raw === "string" ? raw : "");
}

function memoryBlock(recalled: Recalled[]): string {
  if (recalled.length === 0) return "";
  const lines = recalled.map((r) => `- (${r.entry.kind}) ${r.entry.text}`).join("\n");
  return `\n\nThings your friend told you earlier:\n${lines}`;
}

export class Brain {
  private modelId?: string;

  async init(onProgress?: (p: { percentage?: number }) => void): Promise<void> {
    this.modelId = await loadModel({
      modelSrc: MODELS.llm,
      modelConfig: { ctx_size: LLM_CTX_SIZE, tools: true },
      onProgress,
    });
  }

  private id(): string {
    if (!this.modelId) throw new Error("Brain not initialized — call init() first");
    return this.modelId;
  }

  // Continuity comes from recalled memory, not a rolling chat history — a 1.7B
  // model parrots its previous turn if you feed it back, which swallows the
  // callback. Each turn is a focused prompt: persona + memory + this message.
  async respond(
    userText: string,
    recalled: Recalled[],
    confirmedPrediction: string | null = null,
    onTool?: (name: string) => void,
  ): Promise<string> {
    let system = PERSONA + memoryBlock(recalled) + TOOLS_HINT;
    if (confirmedPrediction) {
      system += `\n\nRIGHT NOW: your friend earlier predicted "${confirmedPrediction}", and their current message confirms it. Open your reply by calling that prediction back in their language — a warm, smug "told you so" / "kan bener kata lo" — then react in one short line.`;
    }
    const messages: Msg[] = [
      { role: "system", content: system },
      { role: "user", content: userText },
    ];

    // Tool-call loop: the model may call football tools; we run them, feed the
    // results back, and let it answer. Capped so a confused model can't loop.
    for (let hop = 0; hop < 3; hop++) {
      const run = completion({ modelId: this.id(), history: messages, tools: TOOLS, stream: false });
      const final: any = await run.final;
      let calls: any[] = Array.isArray(final?.toolCalls) ? final.toolCalls : [];
      if (calls.length === 0) {
        try {
          calls = (await run.toolCalls) ?? [];
        } catch {
          calls = [];
        }
      }
      if (calls.length === 0) return sanitize(readReply(final));

      messages.push({ role: "assistant", content: readReply(final) });
      for (const call of calls) {
        onTool?.(call.name);
        const result = await (EXECUTORS[call.name]?.(call.arguments) ??
          Promise.resolve(`Unknown tool: ${call.name}`));
        messages.push({ role: "tool", content: result });
      }
    }

    // Hop budget spent — answer with whatever tool results are now in context.
    const run = completion({ modelId: this.id(), history: messages, stream: false });
    return sanitize(readReply(await run.final));
  }

  // One short pass to capture any prediction/strong claim as a third-person
  // line so it can be recalled later. Returns null when there's nothing to keep.
  async extractPrediction(userText: string): Promise<string | null> {
    const messages: Msg[] = [
      {
        role: "system",
        content:
          'The user is talking about football. If they are making a prediction or strong claim about a FUTURE or not-yet-decided outcome, reply with ONE short third-person line, e.g. "Predicts Argentina wins the final." If they are only reporting a result that already happened, or there is no prediction, reply with exactly: NONE',
      },
      { role: "user", content: userText },
    ];
    const run = completion({ modelId: this.id(), history: messages, stream: false });
    let out = readReply(await run.final);
    if (!out || /^none\b/i.test(out)) return null;
    return out.length > 200 ? out.slice(0, 200) : out;
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
