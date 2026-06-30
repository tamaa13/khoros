import { useCallback, useRef, useState } from "react";
import { khoros } from "../khoros";

function encodeWav(float32: Float32Array, sampleRate: number): Uint8Array {
  const len = float32.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + len * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, len * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

function u8ToBase64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

interface MicState {
  ctx: AudioContext;
  stream: MediaStream;
  node: ScriptProcessorNode;
  chunks: Float32Array[];
  rate: number;
}

export type MicStatus = "idle" | "listening" | "transcribing";

/** On-device voice input: capture mic at 16 kHz mono, transcribe via Whisper. */
export function useMic(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const ref = useRef<MicState | null>(null);

  const stop = useCallback(async () => {
    const m = ref.current;
    ref.current = null;
    if (!m) return;
    try {
      m.node.disconnect();
      m.stream.getTracks().forEach((t) => t.stop());
      await m.ctx.close();
    } catch {
      /* already closed */
    }
    const len = m.chunks.reduce((a, c) => a + c.length, 0);
    if (len < m.rate * 0.3) {
      setStatus("idle");
      return;
    }
    const all = new Float32Array(len);
    let off = 0;
    for (const c of m.chunks) {
      all.set(c, off);
      off += c.length;
    }
    setStatus("transcribing");
    const r = await khoros.transcribe(u8ToBase64(encodeWav(all, m.rate)));
    setStatus("idle");
    if (r?.ok && r.text) onTranscript(r.text);
  }, [onTranscript]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // Whisper wants 16 kHz mono (48 kHz reads as 3x-fast garbage → "♪♪").
      const ctx = new AudioContext({ sampleRate: 16000 });
      const srcNode = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0; // process without echoing the mic to the speakers
      const state: MicState = { ctx, stream, node, chunks: [], rate: ctx.sampleRate };
      ref.current = state;
      node.onaudioprocess = (e) => state.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      srcNode.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);
      setStatus("listening");
    } catch {
      setStatus("idle");
    }
  }, []);

  const toggle = useCallback(() => {
    if (ref.current) void stop();
    else void start();
  }, [start, stop]);

  return { status, toggle, recording: status === "listening" };
}
