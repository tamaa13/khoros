/**
 * Disk-backed semantic memory. Embeddings are computed on-device with
 * GTE-large; recall is cosine similarity over the stored vectors. Persisted as
 * JSON so the agent remembers across sessions.
 */
import { embed, loadModel, unloadModel } from "@qvac/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { MODELS, RECALL_K, RECALL_MIN_SCORE } from "../config";

export type MemoryKind = "chat" | "prediction" | "fact";

export interface MemoryEntry {
  id: string;
  ts: string;
  kind: MemoryKind;
  text: string;
  embedding: number[];
}

export interface Recalled {
  entry: MemoryEntry;
  score: number;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export class Memory {
  private entries: MemoryEntry[] = [];
  private modelId?: string;

  constructor(private readonly file: string) {}

  async init(onProgress?: (p: { percentage?: number }) => void): Promise<void> {
    if (existsSync(this.file)) {
      try {
        this.entries = JSON.parse(readFileSync(this.file, "utf8"));
      } catch {
        this.entries = [];
      }
    }
    this.modelId = await loadModel({ modelSrc: MODELS.embed, onProgress });
  }

  private id(): string {
    if (!this.modelId) throw new Error("Memory not initialized — call init() first");
    return this.modelId;
  }

  // The QVAC worker handles one job per model at a time, so callers must await
  // embeds sequentially (no Promise.all on this model).
  private async vector(text: string): Promise<number[]> {
    const { embedding } = await embed({ modelId: this.id(), text });
    return embedding;
  }

  async save(text: string, kind: MemoryKind): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      kind,
      text,
      embedding: await this.vector(text),
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  async recall(query: string, k: number = RECALL_K): Promise<Recalled[]> {
    if (this.entries.length === 0) return [];
    const q = await this.vector(query);
    return this.entries
      .map((entry) => ({ entry, score: cosine(q, entry.embedding) }))
      .filter((r) => r.score >= RECALL_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  all(): MemoryEntry[] {
    return this.entries.slice();
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.entries));
  }

  async close(): Promise<void> {
    if (this.modelId) {
      await unloadModel({ modelId: this.modelId }).catch(() => {});
      this.modelId = undefined;
    }
  }
}
