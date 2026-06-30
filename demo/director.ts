/**
 * One-command demo of the Khoros hero loop, with clean output for recording.
 *
 * It spawns the relay, an agent, and the house commentator off-camera (their
 * on-device SDK logs go to a logfile under the OS temp dir), connects as the
 * human, and prints only the room transcript: a prediction goes in, the
 * commentator replays a real World Cup match, and the agent calls the
 * prediction back the moment it comes true.
 *
 *   bun demo/director.ts
 *
 * All inference is on-device: Qwen3 runs locally, memory is on-device embeddings.
 * Agents meet only over a thin end-to-end-encrypted relay (localhost here) that
 * can't read a word they say. No chain.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomClient, type RoomMessage } from "../net/client";

const ROOT = join(import.meta.dir, "..");
const LOGDIR = join(tmpdir(), "khoros-demo");
const DATADIR = join(LOGDIR, "rian-mem");
const RELAY = "ws://localhost:8787";
const ROOM = "wc";
const PASS = "worldcup2026";
const PREDICTION = "gua yakin banget Canada bakal ngalahin South Africa";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[1;33m",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const beat = (s: string) => process.stdout.write(`${C.dim}· ${s}${C.reset}\n`);
const say = (color: string, who: string, text: string) =>
  process.stdout.write(`${color}${who.padEnd(12)}${C.reset}${text}\n`);

// Clean slate: no stray processes on the relay port, fresh agent memory.
try {
  execSync("pkill -f 'bun net/relay.ts'; pkill -f 'bun room.ts'; pkill -f 'bun commentator.ts'", {
    stdio: "ignore",
  });
} catch {
  /* nothing to kill */
}
rmSync(DATADIR, { recursive: true, force: true });
mkdirSync(DATADIR, { recursive: true });

const kids: ChildProcess[] = [];
function launch(name: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  // Truncate, not append: waitFor() scans these logs for readiness markers, and
  // stale "listening"/"joined" lines from a prior run would race us ahead of the
  // process actually being up.
  const fd = openSync(join(LOGDIR, `${name}.log`), "w");
  const child = spawn("bun", args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", fd, fd],
  });
  kids.push(child);
  return child;
}
function cleanup(): void {
  for (const k of kids) {
    try {
      k.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function waitFor(file: string, needle: string, timeoutMs = 60000): Promise<void> {
  const path = join(LOGDIR, file);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (readFileSync(path, "utf8").includes(needle)) return;
    } catch {
      /* not written yet */
    }
    await sleep(400);
  }
  throw new Error(`timed out waiting for "${needle}" in ${file}`);
}

console.log(`\n${C.bold}KHOROS${C.reset} — a society of on-device QVAC agents around the 2026 World Cup`);
console.log(`${C.dim}LLM · memory (RAG) · TTS · tool-calling — all on-device. only E2E-encrypted messages cross the wire. no chain.${C.reset}\n`);

beat("starting the E2E-encrypted relay…");
launch("relay", ["net/relay.ts"]);
await waitFor("relay.log", "listening");

beat(`waking agent Rian — on-device LLM (${process.env.KHOROS_LLM ?? "8b"}) loading…`);
launch("rian", ["room.ts", "--name", "Rian"], { KHOROS_DATA: DATADIR });
await waitFor("rian.log", "joined");

const me = new RoomClient(RELAY, "tama", "human");
await me.connect();
me.onMessage((m: RoomMessage) => {
  if (m.from === "tama") return;
  const color = m.kind === "commentator" ? C.yellow : m.kind === "agent" ? C.green : C.cyan;
  const who = m.kind === "commentator" ? "Commentator" : m.from;
  say(color, who, m.text);
});
me.join(ROOM, PASS);
await sleep(600);

console.log();
say(C.cyan, "tama (you)", PREDICTION);
me.post(PREDICTION);
beat("Rian hears it and files the prediction in on-device memory…\n");
await sleep(8000); // let Rian react and persist the prediction

beat("the house commentator steps up to replay a real match…\n");
const comm = launch("commentator", ["commentator.ts", "--replay", "--delay", "5000"]);
await new Promise<void>((resolve) => comm.on("exit", () => resolve()));
await sleep(3000); // let Rian finish reacting to full-time

console.log(
  `\n${C.dim}— Rian called the prediction back the moment it came true. that's Khoros. —${C.reset}\n`,
);
me.close();
cleanup();
process.exit(0);
