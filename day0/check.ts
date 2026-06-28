/**
 * Khoros Day-0 GO/NO-GO — validate QVAC actually runs on this machine.
 *
 * Proves the three on-device capabilities Khoros depends on, headlessly
 * (no mic/speaker interaction required):
 *   1. LLM     — Qwen3 1.7B Q4 completion (the agent "brain")
 *   2. TTS     — Supertonic synthesis → a real .wav on disk (the "speak" tool)
 *   3. EMBED   — GTE-large embeddings + cosine recall (the memory primitive)
 *
 * Each stage reports PROVEN or FAILED with a concrete reason. Run one stage or
 * all:  bun day0/check.ts [llm|tts|embed|all]   (default: all)
 *
 * Models download on first load via the QVAC registry (HuggingFace-backed):
 *   Qwen3-1.7B-Q4 ~1.06GB · Supertonic ~tens of MB · GTE-large ~670MB.
 */
import {
  loadModel,
  unloadModel,
  completion,
  textToSpeech,
  embed,
  QWEN3_1_7B_INST_Q4,
  TTS_EN_SUPERTONIC_Q8_0,
  GTE_LARGE_FP16,
} from "@qvac/sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ARTIFACTS = join(import.meta.dir, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });

const TTS_SAMPLE_RATE = 44100;

// ── WAV helpers (from QVAC examples/tts/utils) ──
function createWavHeader(dataLength: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}
function int16ArrayToBuffer(samples: ArrayLike<number>): Buffer {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] ?? 0)));
    buffer.writeInt16LE(v, i * 2);
  }
  return buffer;
}
function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
function progress(label: string) {
  let last = -1;
  return (p: { percentage?: number }) => {
    const pct = Math.floor(p?.percentage ?? 0);
    if (pct >= last + 10) {
      last = pct;
      console.log(`  [${label}] downloading/loading… ${pct}%`);
    }
  };
}

type Result = { name: string; ok: boolean; detail: string };
const now = () => performance.now();

async function checkLLM(): Promise<Result> {
  const t0 = now();
  console.log("\n── LLM (Qwen3 1.7B Q4) ──");
  const modelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: 4096 },
    onProgress: progress("llm"),
  });
  const tLoad = now();
  const history = [
    {
      role: "system",
      content:
        "You are a sharp, opinionated football pundit. Answer in one or two sentences. No markdown.",
    },
    {
      role: "user",
      content:
        "Who do you think wins the 2026 World Cup final, and give one reason why?",
    },
  ];
  const res = completion({ modelId, history, stream: true });
  let text = "";
  let tokens = 0;
  process.stdout.write("  ↳ ");
  for await (const token of res.tokenStream) {
    process.stdout.write(token);
    text += token;
    tokens++;
  }
  process.stdout.write("\n");
  const tGen = now();
  await unloadModel({ modelId });

  const genMs = tGen - tLoad;
  const tps = tokens / (genMs / 1000);
  const ok = text.trim().length > 0 && tokens > 3;
  return {
    name: "LLM",
    ok,
    detail: ok
      ? `${tokens} tok in ${(genMs / 1000).toFixed(1)}s = ${tps.toFixed(
          1
        )} tok/s · load ${((tLoad - t0) / 1000).toFixed(1)}s`
      : `empty/too-short output (${tokens} tokens)`,
  };
}

async function checkTTS(): Promise<Result> {
  const t0 = now();
  console.log("\n── TTS (Supertonic) ──");
  const modelId = await loadModel({
    modelSrc: TTS_EN_SUPERTONIC_Q8_0,
    modelConfig: {
      ttsEngine: "supertonic",
      language: "en",
      voice: "F1",
      ttsSpeed: 1.05,
      ttsNumInferenceSteps: 5,
    },
    onProgress: progress("tts"),
  });
  const line = "Kan bener kata gua — Argentina takes it again.";
  const result = textToSpeech({
    modelId,
    text: line,
    inputType: "text",
    stream: false,
  });
  const samples = await result.buffer;
  await unloadModel({ modelId });

  const audioData = int16ArrayToBuffer(samples);
  const wav = Buffer.concat([
    createWavHeader(audioData.length, TTS_SAMPLE_RATE),
    audioData,
  ]);
  const outPath = join(ARTIFACTS, "tts-supertonic.wav");
  writeFileSync(outPath, wav);
  const seconds = samples.length / TTS_SAMPLE_RATE;
  const ok = samples.length > TTS_SAMPLE_RATE * 0.3; // at least ~0.3s of audio
  return {
    name: "TTS",
    ok,
    detail: ok
      ? `${seconds.toFixed(1)}s wav (${(wav.length / 1024).toFixed(
          0
        )} KB) → ${outPath} · total ${((now() - t0) / 1000).toFixed(1)}s`
      : `output too short (${samples.length} samples)`,
  };
}

async function checkEmbed(): Promise<Result> {
  const t0 = now();
  console.log("\n── EMBED / memory recall (GTE-large) ──");
  const modelId = await loadModel({
    modelSrc: GTE_LARGE_FP16,
    onProgress: progress("embed"),
  });
  const anchor = "Messi scored a hat-trick for Argentina in the final.";
  const related = "Argentina's captain netted three goals to win the cup.";
  const unrelated = "The weather in Jakarta is humid this afternoon.";
  // The QVAC worker processes one job per model at a time ("Cannot set new job"
  // if you fire concurrent calls on the same modelId), so embed sequentially.
  const ea = (await embed({ modelId, text: anchor })).embedding as number[];
  const er = (await embed({ modelId, text: related })).embedding as number[];
  const eu = (await embed({ modelId, text: unrelated })).embedding as number[];
  await unloadModel({ modelId });

  const simRelated = cosine(ea, er);
  const simUnrelated = cosine(ea, eu);
  console.log(
    `  ↳ dims=${ea.length} · sim(related)=${simRelated.toFixed(
      3
    )} · sim(unrelated)=${simUnrelated.toFixed(3)}`
  );
  // Recall is meaningful only if the semantically-related sentence is clearly
  // closer than the unrelated one — that's the whole basis of memory recall.
  const ok = simRelated > simUnrelated + 0.1 && ea.length > 0;
  return {
    name: "EMBED",
    ok,
    detail: ok
      ? `dims=${ea.length} · related ${simRelated.toFixed(
          3
        )} > unrelated ${simUnrelated.toFixed(3)} · total ${(
          (now() - t0) /
          1000
        ).toFixed(1)}s`
      : `recall not discriminative (related ${simRelated.toFixed(
          3
        )} vs unrelated ${simUnrelated.toFixed(3)})`,
  };
}

async function main() {
  const stage = (process.argv[2] ?? "all").toLowerCase();
  const stages: Record<string, () => Promise<Result>> = {
    llm: checkLLM,
    tts: checkTTS,
    embed: checkEmbed,
  };
  const toRun =
    stage === "all" ? Object.keys(stages) : stage.split(",").map((s) => s.trim());

  const results: Result[] = [];
  for (const s of toRun) {
    const fn = stages[s];
    if (!fn) {
      console.error(`unknown stage: ${s}`);
      continue;
    }
    try {
      results.push(await fn());
    } catch (e: any) {
      results.push({
        name: s.toUpperCase(),
        ok: false,
        detail: `THREW: ${e?.message ?? e}`,
      });
      console.error(`  ✗ ${s} threw:`, e?.message ?? e);
    }
  }

  console.log("\n══════════ DAY-0 GO/NO-GO ══════════");
  for (const r of results) {
    console.log(`${r.ok ? "✅ PROVEN" : "❌ FAILED"}  ${r.name.padEnd(6)} ${r.detail}`);
  }
  const allOk = results.length > 0 && results.every((r) => r.ok);
  console.log("════════════════════════════════════");
  console.log(allOk ? "VERDICT: GO ✅" : "VERDICT: NO-GO ❌");
  process.exit(allOk ? 0 : 1);
}

main();
