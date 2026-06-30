/**
 * On-device speech-to-text via QVAC Whisper. Feed it WAV audio bytes, get text.
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Listener {
  private modelId?: string;

  async init(): Promise<void> {
    // Multilingual Whisper (auto-detects the language) so Indonesian speech
    // transcribes too. translate:false = keep the SPOKEN language (don't force
    // English) — STT should paste back exactly what was said.
    // Multilingual Whisper, transcribe (not translate) — it auto-detects the
    // language by default and keeps it (this loaded + produced Indonesian).
    // detect_language:true breaks load ("must be false if language is not auto").
    this.modelId = await Q.loadModel({
      modelSrc: Q.WHISPER_BASE_Q8_0,
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
