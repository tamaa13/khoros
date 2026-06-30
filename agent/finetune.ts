/**
 * On-device LoRA fine-tuning via QVAC (llamacpp). Trains a small adapter on the
 * user's own takes so their agent argues in their voice. This is the OPTIONAL
 * top layer — memory/recall is the always-on personalization backbone; finetune
 * is a periodic "style tune-up" gated on device capability + idle/charging.
 */
import * as qvac from "@qvac/sdk";
import os from "node:os";
import { mkdirSync, readdirSync } from "node:fs";

const Q = qvac as any;

export interface TuneProgress {
  epoch: number;
  step: number;
  loss?: number;
  acc?: number;
  etaSec?: number;
}

export interface TuneOutcome {
  status: string;
  firstLoss?: number;
  finalLoss?: number;
  elapsedMs: number;
  adapterFiles: string[];
}

export class Trainer {
  /** Can this device train? Potato machines fall back to memory-only. */
  static capability(): { canTrain: boolean; reason: string; ramGB: number } {
    const ramGB = os.totalmem() / 1e9;
    if (ramGB < 7.5) return { canTrain: false, reason: "low RAM — staying in memory-only mode", ramGB };
    return { canTrain: true, reason: "ok", ramGB };
  }

  /** Train a LoRA adapter on a JSONL dataset (HF chat format). */
  /** Generate a reply from the 600M base, optionally with a LoRA adapter applied
   *  (modelConfig.lora). Used to prove the adapter actually changes the output. */
  async sample(prompt: string, loraPath?: string): Promise<string> {
    const modelConfig: any = { device: "gpu", ctx_size: 512 };
    if (loraPath) modelConfig.lora = loraPath;
    const modelId = await Q.loadModel({ modelSrc: Q.QWEN3_600M_INST_Q4, modelConfig });
    try {
      const run = Q.completion({ modelId, history: [{ role: "user", content: prompt }], stream: false });
      const final: any = await run.final;
      const text = final?.content ?? final?.raw?.fullText ?? final?.text ?? "";
      return String(text).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    } finally {
      await Q.unloadModel({ modelId, clearStorage: false }).catch(() => {});
    }
  }

  async train(
    jsonlPath: string,
    evalPath: string,
    outDir: string,
    onProgress?: (p: TuneProgress) => void,
    modelSrc: any = Q.QWEN3_600M_INST_Q4,
  ): Promise<TuneOutcome> {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(`${outDir}/ckpt`, { recursive: true });
    const t0 = Date.now();
    // Defaults to 600M (fast self-test); the evolve pipeline passes the agent's
    // own model so the trained adapter applies to the real agent.
    const modelId = await Q.loadModel({ modelSrc, modelConfig: { device: "gpu", ctx_size: 512 } });
    let firstLoss: number | undefined;
    let finalLoss: number | undefined;
    try {
      const handle = Q.finetune({
        modelId,
        options: {
          trainDatasetDir: jsonlPath,
          validation: { type: "dataset", path: evalPath },
          numberOfEpochs: 2,
          learningRate: 1e-4,
          lrMin: 1e-8,
          loraModules: "attn_q,attn_k,attn_v,attn_o,ffn_gate,ffn_up,ffn_down",
          assistantLossOnly: true,
          checkpointSaveSteps: 4,
          checkpointSaveDir: `${outDir}/ckpt`,
          outputParametersDir: outDir,
        },
      });
      void (async () => {
        try {
          for await (const t of handle.progressStream) {
            const loss = t.loss;
            if (firstLoss === undefined && loss != null) firstLoss = loss;
            if (loss != null) finalLoss = loss;
            onProgress?.({
              epoch: (t.current_epoch ?? 0) + 1,
              step: t.global_steps,
              loss,
              acc: t.accuracy,
              etaSec: Math.round((t.eta_ms ?? 0) / 1000),
            });
          }
        } catch {
          /* stream ended */
        }
      })();
      const result = await handle.result;
      let adapterFiles: string[] = [];
      try {
        adapterFiles = readdirSync(outDir).filter((f) => f !== "ckpt");
      } catch {
        /* none */
      }
      return { status: result?.status ?? "done", firstLoss, finalLoss, elapsedMs: Date.now() - t0, adapterFiles };
    } finally {
      await Q.unloadModel({ modelId, clearStorage: false }).catch(() => {});
    }
  }
}
