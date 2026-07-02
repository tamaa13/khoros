/**
 * Typed bridge to the Electron main process. Mirrors the surface exposed in
 * src/preload.cjs (window.khoros). Keep this in sync with the preload.
 */
export interface Settings {
  agentName?: string;
  language?: string | null;
  voice?: boolean;
}
export interface ReadyCtx {
  needsName: boolean;
  name: string | null;
  language: string | null;
}

export interface AskResult {
  reply: string;
  callback?: boolean | null;
  tools?: string[];
  image?: string; // base64 PNG (real-photo intent)
  imageCaption?: string;
}
export interface OkResult {
  ok: boolean;
  error?: string;
}
export type SpeakResult = OkResult & { wav?: string };
export type TranslateResult = OkResult & { text?: string };
export type TranscribeResult = OkResult & { text?: string };
export type ImagineResult = OkResult & { png?: string };

export interface RoomChoice {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  state: "pre" | "in" | "post";
  kickoff?: string;
  detail: string;
  live: boolean;
}
export type RoomsResult = OkResult & { rooms?: RoomChoice[] };

export interface LobbyMessage {
  kind: "scoreboard" | "feed" | "agent" | "system";
  // scoreboard
  home?: string;
  away?: string;
  homeFlag?: string;
  awayFlag?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
  live?: boolean;
  phase?: "pre" | "in" | "post";
  // feed
  idx?: number;
  clock?: string;
  emoji?: string;
  key?: boolean;
  // agent / system
  from?: string;
  text?: string;
  callback?: boolean;
}
export interface LobbyEvent {
  type: "message" | "presence" | "status";
  from?: string;
  kind?: string;
  text?: string;
  callback?: boolean;
  self?: boolean;
  peers?: string[];
}

export interface ImagineProgress {
  phase: "gen" | "load";
  step?: number;
  total?: number;
  pct?: number;
}
export interface MemoryEntry {
  kind: string;
  text: string;
  ts: number;
}

export interface KhorosAPI {
  ask(text: string): Promise<AskResult>;
  onNotify(cb: (p: { text: string }) => void): void;
  watchMatch(q: string): Promise<OkResult & { kind?: "armed" | "recap"; reply?: string }>;
  recapMatch(q: string): Promise<OkResult & { kind?: "recap" | "pending"; reply?: string }>;
  onStatus(cb: (s: string) => void): void;
  onProgress(cb: (p: unknown) => void): void;
  onReady(cb: (ctx: ReadyCtx) => void): void;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  speak(text: string): Promise<SpeakResult>;
  translate(text: string, from?: string, to?: string): Promise<TranslateResult>;
  imagine(prompt: string): Promise<ImagineResult>;
  onImagineProgress(cb: (p: ImagineProgress) => void): void;
  transcribe(base64Wav: string): Promise<TranscribeResult>;
  sttSelfTest(): Promise<OkResult & { text?: string }>;
  ocrPick(): Promise<OkResult & { canceled?: boolean; text?: string; image?: string; name?: string }>;
  ocrRead(path: string): Promise<OkResult & { text?: string }>;
  finetuneSelfTest(): Promise<OkResult>;
  finetuneApplyTest(prompt?: string): Promise<OkResult>;
  onFinetuneProgress(cb: (p: unknown) => void): void;
  evolveStatus(): Promise<Record<string, unknown>>;
  evolveNow(): Promise<OkResult>;
  onEvolveDone(cb: (p: unknown) => void): void;
  memories(): Promise<MemoryEntry[]>;
  recall(q: string): Promise<Array<{ kind: string; text: string; score: number }>>;
  schedule(when: string): Promise<unknown>;
  lobbyRooms(): Promise<RoomsResult>;
  startLobby(roomId?: string, fromIndex?: number): Promise<OkResult>;
  stopLobby(): Promise<OkResult>;
  onLobbyStatus(cb: (s: string) => void): void;
  onLobbyMessage(cb: (m: LobbyMessage) => void): void;
  onLobbyEvent(cb: (ev: LobbyEvent) => void): void;
  loungeActive(on: boolean): Promise<OkResult>;
  matches(): Promise<unknown>;
  debate(label: string): Promise<unknown>;
  result(text: string): Promise<unknown>;
}

declare global {
  interface Window {
    khoros: KhorosAPI;
  }
}

export const khoros: KhorosAPI = window.khoros;
