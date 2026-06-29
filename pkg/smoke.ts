/**
 * Minimal QVAC smoke test: load the LLM, run one completion, exit. Two uses:
 *   bun pkg/smoke.ts                          # quick on-device sanity check (works)
 *   bun build --compile pkg/smoke.ts ...      # the single-binary attempt (see PACKAGING.md)
 *
 * The compiled binary builds but can't load QVAC's native Bare runtime, which is
 * why distribution goes through Electron/Expo/Pear instead — details in PACKAGING.md.
 */
import "../quiet";
import { loadModel, completion, unloadModel } from "@qvac/sdk";
import { MODELS, LLM_CTX_SIZE } from "../config";
const id = await loadModel({ modelSrc: MODELS.llm, modelConfig: { ctx_size: LLM_CTX_SIZE } });
const r: any = await completion({ modelId: id, history: [{ role: "user", content: "Say hi in 5 words." }], stream: false }).final;
console.log("REPLY:", (r?.content ?? r?.raw?.fullText ?? "").trim());
await unloadModel({ modelId: id });
process.exit(0);
