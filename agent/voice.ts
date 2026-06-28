/**
 * On-device voice. Supertonic synthesizes PCM; we wrap it as WAV and play it
 * through ffplay (ships with ffmpeg). Optional — only loaded with --voice.
 */
import { loadModel, textToSpeech, unloadModel } from "@qvac/sdk";
import { spawnSync } from "node:child_process";
import { MODELS, TTS_CONFIG, TTS_SAMPLE_RATE } from "../config";

function wavHeader(dataLength: number, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataLength, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataLength, 40);
  return h;
}

function pcmToBuffer(samples: ArrayLike<number>): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] ?? 0)));
    buf.writeInt16LE(v, i * 2);
  }
  return buf;
}

export class Voice {
  private modelId?: string;

  async init(onProgress?: (p: { percentage?: number }) => void): Promise<void> {
    this.modelId = await loadModel({
      modelSrc: MODELS.tts,
      modelConfig: TTS_CONFIG,
      onProgress,
    });
  }

  async speak(text: string): Promise<void> {
    if (!this.modelId || !text.trim()) return;
    const result = textToSpeech({
      modelId: this.modelId,
      text,
      inputType: "text",
      stream: false,
    });
    const samples = await result.buffer;
    const pcm = pcmToBuffer(samples);
    const wav = Buffer.concat([wavHeader(pcm.length, TTS_SAMPLE_RATE), pcm]);
    spawnSync(
      "ffplay",
      ["-hide_banner", "-loglevel", "error", "-autoexit", "-nodisp", "-i", "pipe:0"],
      { input: wav, stdio: ["pipe", "ignore", "ignore"] },
    );
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
