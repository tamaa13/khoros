/**
 * On-device speech-to-text via QVAC Whisper. Feed it WAV audio bytes, get text.
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Listener {
  private modelId?: string;

  async init(): Promise<void> {
    // Whisper large-v3-turbo: multilingual + far more accurate than base (much
    // better Indonesian). translate:false keeps the SPOKEN language, auto-detects
    // by default. (detect_language:true breaks load — "must be false if language
    // is not auto".) Heavier (~1.5GB, downloads once) but worth it for accuracy.
    this.modelId = await Q.loadModel({
      modelSrc: Q.WHISPER_LARGE_V3_TURBO,
      modelConfig: { no_timestamps: true, translate: false },
    });
  }

  /** Transcribe a WAV buffer to text. */
  async transcribe(wav: Buffer): Promise<string> {
    if (!this.modelId) throw new Error("listener not initialized");
    const res: any = Q.transcribe({ modelId: this.modelId, audioChunk: wav });
    let text: any = "";
    if (res?.then) text = await res;
    else if (res?.[Symbol.asyncIterator]) {
      for await (const c of res) text += typeof c === "string" ? c : (c?.text ?? "");
    } else text = res?.text ?? res;
    if (text && typeof text === "object") text = text.text ?? JSON.stringify(text);
    return String(text ?? "").trim();
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
