/**
 * On-device image generation via QVAC Stable Diffusion (sdcpp). Turn a prompt
 * into a PNG — match posters, trophy-lift celebrations, etc. Uses the compact
 * SD 2.1 1B all-in-one model (single GGUF, no companion files).
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Painter {
  private modelId?: string;

  async init(): Promise<void> {
    this.modelId = await Q.loadModel({
      modelSrc: Q.SD_V2_1_1B_Q8_0,
      modelType: "sdcpp-generation",
      modelConfig: { prediction: "v" },
    });
  }

  /** Generate an image from a prompt → PNG buffer. */
  async paint(prompt: string): Promise<Buffer | null> {
    if (!this.modelId) throw new Error("painter not initialized");
    const { outputs } = Q.diffusion({ modelId: this.modelId, prompt });
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
