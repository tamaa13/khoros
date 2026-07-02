/**
 * On-device OCR via QVAC (easyocr pipeline, ONNX). Feed it an image, get the
 * text out — match schedules, scoreboards, tickets, screenshots.
 *
 * Uses the Latin recognizer (covers English AND Indonesian — same script); the
 * pipeline pulls its own text detector. Config mirrors the official example
 * (dist/examples/ocr-fasttext.js).
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export interface OcrBlock {
  text: string;
  confidence?: number;
}

export class Reader {
  private modelId?: string;

  async init(): Promise<void> {
    try {
      this.modelId = await this.load();
    } catch (e: any) {
      // A stale/orphaned worker may already hold this model ("Model with ID X is
      // already registered") — unload that ID and retry with a clean slate.
      const m = String(e?.message ?? e).match(/Model with ID "([0-9a-f]+)" is already registered/);
      if (!m) throw e;
      await Q.unloadModel({ modelId: m[1] }).catch(() => {});
      this.modelId = await this.load();
    }
  }

  private load(): Promise<string> {
    // sdk 0.14 (the desktop's copy) bundles the pipeline as OCR_LATIN (GGUF) and
    // rejects the old ONNX recognizer ("failed to open GGUF") AND unrecognized
    // config keys (no useGPU/timeout). 0.13 (repo root, bun probes) predates
    // OCR_LATIN — fall back to the ONNX recognizer there.
    return Q.loadModel({
      modelSrc: Q.OCR_LATIN ?? Q.OCR_LATIN_RECOGNIZER_1,
      modelConfig: {
        langList: ["en"],
        magRatio: 1.5,
        defaultRotationAngles: [90, 180, 270],
        contrastRetry: false,
        lowConfidenceThreshold: 0.5,
        recognizerBatchSize: 1,
      },
    });
  }

  /** Read all text out of an image file. Returns the blocks in reading order. */
  async read(imagePath: string): Promise<OcrBlock[]> {
    if (!this.modelId) throw new Error("reader not initialized");
    const { blocks } = Q.ocr({ modelId: this.modelId, image: imagePath, options: { paragraph: false } });
    const out: OcrBlock[] = [];
    for (const b of await blocks) {
      const text = String(b?.text ?? "").trim();
      if (text) out.push({ text, confidence: b?.confidence });
    }
    return out;
  }

  /** Read an image and join the text into one string for the agent. */
  async readText(imagePath: string): Promise<string> {
    return (await this.read(imagePath)).map((b) => b.text).join("\n");
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
