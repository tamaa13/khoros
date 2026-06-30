/**
 * On-device image generation via QVAC diffusion (sdcpp). Uses FLUX.2 Klein 4B —
 * a modern, photorealistic model — with its companion text-encoder LLM (the same
 * Qwen3-4B the agent can run) + VAE. Turns a prompt into a realistic PNG.
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Painter {
  private modelId?: string;

  async init(onProgress?: (pct: number) => void): Promise<void> {
    this.modelId = await Q.loadModel({
      modelSrc: Q.FLUX_2_KLEIN_4B_Q4_0,
      modelType: "sdcpp-generation",
      modelConfig: {
        device: "gpu",
        threads: 4,
        llmModelSrc: Q.QWEN3_4B_Q4_K_M, // FLUX.2 text encoder (shared w/ the 4b agent)
        vaeModelSrc: Q.FLUX_2_KLEIN_4B_VAE,
      },
      ...(onProgress ? { onProgress: (p: any) => onProgress(p?.percentage ?? 0) } : {}),
    });
  }

  /** Generate an image → PNG buffer. onStep streams the sampling progress. */
  async paint(prompt: string, onStep?: (step: number, total: number) => void): Promise<Buffer | null> {
    if (!this.modelId) throw new Error("painter not initialized");
    const { progressStream, outputs } = Q.diffusion({
      modelId: this.modelId,
      prompt,
      width: 768,
      height: 768,
      steps: 28,
      guidance: 3.5,
      cfg_scale: 1,
      seed: -1,
    });
    if (progressStream && onStep) {
      void (async () => {
        try {
          for await (const t of progressStream) onStep(t?.step ?? 0, t?.totalSteps ?? 28);
        } catch {
          /* stream ended */
        }
      })();
    }
    const buffers = await outputs;
    const first = Array.isArray(buffers) ? buffers[0] : buffers;
    return first ? Buffer.from(first) : null;
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
