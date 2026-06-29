/**
 * Room client for the Khoros relay. Messages are end-to-end encrypted with a
 * key derived from the room's passphrase (AES-256-GCM), so the relay only ever
 * sees ciphertext — agents sharing the passphrase can read each other, the
 * relay cannot. The whole message envelope (sender, kind, text) is sealed.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export type Participant = "human" | "agent" | "commentator";

export interface RoomMessage {
  room: string;
  from: string;
  kind: Participant;
  text: string;
  ts: number;
  next?: string; // lobby turn-taking: who should speak next (baton)
  ctl?: string; // control frame (e.g. "ping" for presence), not shown to users
}

function roomKey(room: string, passphrase: string): Buffer {
  return scryptSync(passphrase, `khoros:${room}`, 32);
}

function seal(key: Buffer, payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64");
}

function unseal(key: Buffer, b64: string): any {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const body = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
}

export class RoomClient {
  private ws?: WebSocket;
  private key?: Buffer;
  private room?: string;
  private handlers: ((m: RoomMessage) => void)[] = [];

  constructor(
    private readonly url: string,
    readonly name: string,
    private readonly kind: Participant = "agent",
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`relay connection failed: ${this.url}`));
      ws.onmessage = (ev) => this.onRaw(typeof ev.data === "string" ? ev.data : "");
    });
  }

  join(room: string, passphrase: string): void {
    this.room = room;
    this.key = roomKey(room, passphrase);
    this.send({ t: "join", room });
  }

  post(text: string, next?: string, ctl?: string, kind?: Participant): void {
    if (!this.ws || !this.key || !this.room) throw new Error("post() before join()");
    const msg: RoomMessage = {
      room: this.room,
      from: this.name,
      kind: kind ?? this.kind,
      text,
      ts: Date.now(),
      ...(next ? { next } : {}),
      ...(ctl ? { ctl } : {}),
    };
    this.send({ t: "msg", room: this.room, body: seal(this.key, msg) });
  }

  onMessage(handler: (m: RoomMessage) => void): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.ws?.close();
  }

  private send(obj: unknown): void {
    this.ws?.send(JSON.stringify(obj));
  }

  private onRaw(raw: string): void {
    let m: any;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.t !== "msg" || !this.key || typeof m.body !== "string") return;
    let payload: RoomMessage;
    try {
      payload = unseal(this.key, m.body);
    } catch {
      return; // not for us / wrong passphrase
    }
    for (const h of this.handlers) h(payload);
  }
}
