/**
 * On-device image generation via QVAC diffusion (sdcpp).
 *  - text2img: FLUX.2 Klein 4B (photorealistic) when there's no reference.
 *  - img2img:  SD 2.1 1B over a REAL reference photo (a player cutout / team
 *    image from TheSportsDB) so the face + kit are grounded in reality and the
 *    model only adds the celebration styling.
 * One diffusion model is resident at a time (swap on mode change) to bound RAM.
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Painter {
  private modelId?: string;
  private mode?: "flux" | "sd";

  private async ensure(mode: "flux" | "sd", onLoad?: (pct: number) => void): Promise<void> {
    if (this.mode === mode && this.modelId) return;
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
    const onProgress = onLoad ? { onProgress: (p: any) => onLoad(p?.percentage ?? 0) } : {};
    if (mode === "flux") {
      this.modelId = await Q.loadModel({
        modelSrc: Q.FLUX_2_KLEIN_4B_Q4_0,
        modelType: "sdcpp-generation",
        modelConfig: { device: "gpu", threads: 4, llmModelSrc: Q.QWEN3_4B_Q4_K_M, vaeModelSrc: Q.FLUX_2_KLEIN_4B_VAE },
        ...onProgress,
      });
    } else {
      // The official img2img example loads SD with NO modelConfig; the text2img
      // `prediction: "v"` config crashes init_image. Match the example.
      this.modelId = await Q.loadModel({
        modelSrc: Q.SD_V2_1_1B_Q8_0,
        modelType: "sdcpp-generation",
        ...onProgress,
      });
    }
    this.mode = mode;
  }

  private async collect(gen: any, onStep?: (s: number, t: number) => void): Promise<Buffer | null> {
    const { progressStream, outputs } = gen;
    if (progressStream && onStep) {
      void (async () => {
        try {
          for await (const t of progressStream) onStep(t?.step ?? 0, t?.totalSteps ?? 0);
        } catch {
          /* ended */
        }
      })();
    }
    const buffers = await outputs;
    const first = Array.isArray(buffers) ? buffers[0] : buffers;
    return first ? Buffer.from(first) : null;
  }

  /** Photorealistic text-to-image (FLUX.2) — used when there's no reference. */
  async paint(prompt: string, onStep?: (s: number, t: number) => void, onLoad?: (p: number) => void): Promise<Buffer | null> {
    await this.ensure("flux", onLoad);
    return this.collect(
      Q.diffusion({ modelId: this.modelId, prompt, width: 768, height: 768, steps: 28, guidance: 3.5, cfg_scale: 1, seed: -1 }),
      onStep,
    );
  }

  /** Image-to-image over a real reference (SD 2.1). Low strength keeps the real
   *  face/kit; the model adds the scene/styling. */
  async paintFrom(
    refBytes: Buffer,
    prompt: string,
    onStep?: (s: number, t: number) => void,
    onLoad?: (p: number) => void,
    strength = 0.2,
  ): Promise<Buffer | null> {
    await this.ensure("sd", onLoad);
    // Low strength keeps the real face/kit from the reference photo; the model
    // only lightly restyles. (negative_prompt/cfg_scale crash this sdcpp build.)
    try {
      return await this.collect(
        Q.diffusion({ modelId: this.modelId, prompt, init_image: new Uint8Array(refBytes), width: 768, height: 768, strength, steps: 30, seed: -1 }),
        onStep,
      );
    } catch (e) {
      this.modelId = undefined; // worker may have died — force a fresh load next time
      this.mode = undefined;
      throw e;
    }
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
      this.mode = undefined;
    }
  }
}
