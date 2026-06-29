/**
 * Put an agent — or a human console — into a relay room.
 *
 *   bun net/relay.ts                              # 1) start the relay
 *   bun room.ts --name Rian                       # 2) an agent in room "wc"
 *   bun room.ts --name Sari                       # 3) another agent, same room
 *   bun room.ts --name you --human                # 4) you, to nudge them
 *
 * Each agent needs its own memory: run with a distinct KHOROS_DATA per agent.
 * Agents react to humans always, and to other agents only when mentioned by
 * name — so they don't ping-pong forever.
 */
import "./quiet"; // before @qvac/sdk
import { createInterface } from "node:readline";
import { Agent } from "./agent/loop";
import { RoomClient, type RoomMessage } from "./net/client";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const RELAY = arg("--relay", process.env.KHOROS_RELAY ?? "ws://localhost:8787")!;
const ROOM = arg("--room", "wc")!;
const PASS = arg("--pass", process.env.KHOROS_ROOM_PASS ?? "worldcup2026")!;
const NAME = arg("--name", "agent")!;
const asHuman = process.argv.includes("--human");

const status = (s: string) => process.stderr.write(`\x1b[2m${s}\x1b[0m\n`);

if (asHuman) {
  const client = new RoomClient(RELAY, NAME, "human");
  await client.connect();
  client.onMessage((m) => {
    if (m.from !== NAME) console.log(`${m.from} › ${m.text}`);
  });
  client.join(ROOM, PASS);
  status(`joined "${ROOM}" as ${NAME} (human). type to talk, Ctrl+C to quit.`);
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    const text = line.trim();
    if (text) client.post(text);
  }
  client.close();
} else {
  const agent = new Agent();
  status(`loading ${NAME}…`);
  await agent.init({ onStatus: status });

  const client = new RoomClient(RELAY, NAME, "agent");
  await client.connect();

  // Serialize reactions: the model handles one inference at a time, so queue
  // incoming messages rather than reacting concurrently.
  const queue: RoomMessage[] = [];
  let busy = false;
  const mentioned = (text: string) => new RegExp(`\\b${NAME}\\b`, "i").test(text);

  async function drain() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const m = queue.shift()!;
      status(`${NAME} reacting to ${m.from}…`);
      try {
        // Don't mine predictions from the commentator — it narrates outcomes,
        // it isn't the speaker making a fresh prediction.
        const { reply, tools, callback } = await agent.turn(`${m.from}: ${m.text}`, {
          learnPredictions: m.kind !== "commentator",
        });
        if (tools.length) status(`🔧 ${tools.join(", ")}`);
        if (callback) status(`↩ called back: ${callback}`);
        client.post(reply);
      } catch (e: any) {
        status(`error: ${e?.message ?? e}`);
      }
    }
    busy = false;
  }

  client.onMessage((m) => {
    if (m.from === NAME) return;
    status(`saw ${m.from} [${m.kind}]: ${m.text.slice(0, 70)}`);
    // React to humans and the match commentator always; to other agents only
    // when mentioned by name (keeps them from talking in circles).
    if (m.kind === "human" || m.kind === "commentator" || mentioned(m.text)) {
      queue.push(m);
      void drain();
    }
  });

  client.join(ROOM, PASS);
  status(`${NAME} joined "${ROOM}". reacting to humans + mentions.`);

  process.on("SIGINT", async () => {
    client.close();
    await agent.close();
    process.exit(0);
  });
}
