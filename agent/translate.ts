/**
 * On-device translation via QVAC's Bergamot NMT engine. Each language pair is a
 * separate model (BERGAMOT_<FROM>_<TO>); we load on demand and swap pairs as
 * needed. Bergamot covers X↔EN well, so non-English → English is direct.
 */
import * as qvac from "@qvac/sdk";

const Q = qvac as any;

export class Translator {
  private modelId?: string;
  private pair?: string;

  /** Is there a Bergamot model for this pair? */
  static supports(from: string, to: string): boolean {
    return Boolean(Q[`BERGAMOT_${from.toUpperCase()}_${to.toUpperCase()}`]);
  }

  private async ensure(from: string, to: string): Promise<boolean> {
    const key = `BERGAMOT_${from.toUpperCase()}_${to.toUpperCase()}`;
    if (this.pair === key && this.modelId) return true;
    const src = Q[key];
    if (!src) return false;
    if (this.modelId) await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
    this.modelId = await Q.loadModel({
      modelSrc: src,
      modelConfig: { engine: "Bergamot", from, to },
    });
    this.pair = key;
    return true;
  }

  /** Translate `text` from→to. Returns null if the pair isn't available. */
  async translate(text: string, from: string, to: string): Promise<string | null> {
    if (!text.trim()) return "";
    if (!(await this.ensure(from, to))) return null;
    const res: any = Q.translate({ modelId: this.modelId, text, stream: false, modelType: "nmt" });
    // The exact return wrapper isn't documented; handle the likely shapes.
    let out: any;
    if (res?.then) out = await res;
    else if (res?.result !== undefined) out = await res.result;
    else if (res?.text !== undefined) out = await res.text;
    else if (res?.[Symbol.asyncIterator]) {
      out = "";
      for await (const chunk of res) out += typeof chunk === "string" ? chunk : (chunk?.text ?? "");
    } else out = res;
    if (Array.isArray(out)) out = out.join(" ");
    if (out && typeof out === "object") out = out.text ?? out.translation ?? JSON.stringify(out);
    return String(out ?? "");
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await Q.unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
      this.pair = undefined;
    }
  }
}
