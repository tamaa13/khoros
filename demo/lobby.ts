/**
 * Autonomous lobby show, with clean output for watching. Two on-device agents
 * with opposite calls debate on their own (no human), then the house commentator
 * drops a real result into the room — and the agent who predicted it calls its
 * own shot back. Relay, agents, and commentator are spawned off-camera (their
 * SDK logs go to a logfile); only the room transcript is printed.
 *
 *   bun demo/lobby.ts            # uses the default brain (KHOROS_LLM, 8b)
 *   KHOROS_LLM=4b bun demo/lobby.ts   # snappier, a little less accurate
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomClient, type RoomMessage } from "../net/client";

const ROOT = join(import.meta.dir, "..");
const LOGDIR = join(tmpdir(), "khoros-lobby");
const RELAY = "ws://localhost:8787";
const ROOM = "lobby";
const PASS = "worldcup2026";
const PEERS = "Dewi,Rian";
const TOPIC = "Bentar lagi South Africa lawan Canada. Menurut lo siapa yang menang, dan kenapa?";

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

try {
  execSync("pkill -f 'bun net/relay.ts'; pkill -f 'bun room.ts'; pkill -f 'bun commentator.ts'", {
    stdio: "ignore",
  });
} catch {
  /* nothing to kill */
}
for (const a of ["Dewi", "Rian"]) rmSync(join(LOGDIR, a), { recursive: true, force: true });
mkdirSync(LOGDIR, { recursive: true });

const kids: ChildProcess[] = [];
function launch(name: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  const fd = openSync(join(LOGDIR, `${name}.log`), "w"); // truncate: fresh per run
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

async function waitFor(file: string, needle: string, timeoutMs = 180000): Promise<void> {
  const path = join(LOGDIR, file);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (readFileSync(path, "utf8").includes(needle)) return;
    } catch {
      /* not written yet */
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for "${needle}" in ${file}`);
}

console.log(`\n${C.bold}KHOROS — autonomous lobby${C.reset}`);
console.log(
  `${C.dim}two on-device agents debate on their own; the commentator drops a real result; whoever called it says "told you so".${C.reset}\n`,
);

beat("starting the E2E-encrypted relay…");
launch("relay", ["net/relay.ts"]);
await waitFor("relay.log", "listening");

beat("waking two agents — Dewi (backs Canada) and Rian (backs South Africa)…");
launch(
  "dewi",
  [
    "room.ts", "--name", "Dewi", "--room", ROOM, "--lobby", "--starter", "--peers", PEERS,
    "--max-turns", "2", "--turn-delay", "1500", "--topic", TOPIC,
    "--bias", "Lo yakin BANGET Canada bakal ngalahin South Africa. Tonjolin prediksi itu dengan pede.",
  ],
  { KHOROS_DATA: join(LOGDIR, "Dewi") },
);
launch(
  "rian",
  [
    "room.ts", "--name", "Rian", "--room", ROOM, "--lobby", "--peers", PEERS,
    "--max-turns", "2", "--turn-delay", "1500",
    "--bias", "Lo jagoin South Africa habis-habisan, under-dog, suka ngedebat dengan pede.",
  ],
  { KHOROS_DATA: join(LOGDIR, "Rian") },
);
await waitFor("dewi.log", "joined");
await waitFor("rian.log", "joined");

const watch = new RoomClient(RELAY, "watch", "human");
await watch.connect();
watch.onMessage((m: RoomMessage) => {
  if (m.from === "watch") return;
  const color = m.kind === "commentator" ? C.yellow : m.from === "Dewi" ? C.green : C.cyan;
  const tag = m.kind === "commentator" ? "Commentator" : m.from;
  process.stdout.write(`${color}${tag.padEnd(12)}${C.reset}${m.text}\n`);
});
watch.join(ROOM, PASS);

beat("they start arguing who wins…\n");
await waitFor("dewi.log", "dropping the baton"); // let the debate play out
await sleep(1500);

beat("\nthe house commentator replays the real match…\n");
launch("commentator", ["commentator.ts", "--replay", "--room", ROOM, "--delay", "5000"]);
await new Promise<void>((resolve) => kids[kids.length - 1].on("exit", () => resolve()));

// wait for the result reaction (the callback) to land, then a beat to capture it
const start = Date.now();
while (Date.now() - start < 45000) {
  try {
    const logs = ["Dewi", "Rian"].map((n) => readFileSync(join(LOGDIR, `${n.toLowerCase()}.log`), "utf8"));
    if (logs.some((l) => l.includes("called back"))) break;
  } catch {
    /* not written yet */
  }
  await sleep(1000);
}
await sleep(3000); // let the callback message reach the transcript

console.log(
  `\n${C.dim}— the agent who called it just took its own victory lap. that's the Khoros lobby. —${C.reset}\n`,
);
watch.close();
cleanup();
process.exit(0);
