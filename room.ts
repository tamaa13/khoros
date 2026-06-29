/**
 * Put an agent — or a human console — into a relay room.
 *
 *   bun net/relay.ts                              # 1) start the relay
 *   bun room.ts --name Rian                       # 2) an agent in room "wc"
 *   bun room.ts --name Sari                       # 3) another agent, same room
 *   bun room.ts --name you --human                # 4) you, to nudge them
 *
 * Each agent needs its own memory: run with a distinct KHOROS_DATA per agent.
 * By default agents react to humans always, and to other agents only when
 * mentioned by name — so they don't ping-pong forever.
 *
 * Lobby mode lets them converse on their own with no human in the loop, passing
 * a baton (msg.next) so one speaks at a time. Give each the roster and a slant:
 *   bun room.ts --name Rian --lobby --starter --peers Rian,Sari --bias "Die-hard Brazil fan."
 *   bun room.ts --name Sari --lobby           --peers Rian,Sari --bias "Backs Argentina, loves data."
 */
import "./quiet"; // before @qvac/sdk
import { createInterface } from "node:readline";
import { Agent, reportsResult } from "./agent/loop";
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
  // Lobby mode: agents converse on their own, passing a baton (msg.next) so
  // exactly one speaks at a time — round-robin, but a peer addressed by name
  // gets the baton instead, which makes it feel like a real back-and-forth.
  const lobby = process.argv.includes("--lobby");
  const isStarter = process.argv.includes("--starter");
  const peers = (arg("--peers") ?? NAME).split(",").map((s) => s.trim()).filter(Boolean);
  const TURN_DELAY = Number(arg("--turn-delay", "3500"));
  const MAX_TURNS = Number(arg("--max-turns", "0")); // 0 = until Ctrl+C
  const KICKOFF =
    arg("--topic") ??
    "Lagi santai di lobby nih. Buka obrolan: siapa jagoan lo buat juara Piala Dunia 2026, dan kenapa?";

  const agent = new Agent({ bias: arg("--bias") });
  status(`loading ${NAME}…`);
  await agent.init({ onStatus: status });

  const client = new RoomClient(RELAY, NAME, "agent");
  await client.connect();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const mentioned = (text: string) => new RegExp(`\\b${NAME}\\b`, "i").test(text);
  const rrNext = (): string => {
    const i = peers.indexOf(NAME);
    return peers[(i + 1) % peers.length] ?? NAME;
  };
  // Hand the baton to a peer the reply addresses by name, else round-robin.
  const pickNext = (reply: string): string => {
    for (const p of peers) {
      if (p !== NAME && new RegExp(`\\b${p}\\b`, "i").test(reply)) return p;
    }
    return rrNext();
  };

  // Serialize reactions: the model handles one inference at a time, so queue
  // incoming work rather than reacting concurrently. A null task is the kickoff.
  type Task = RoomMessage | { kickoff: true };
  const queue: Task[] = [];
  let busy = false;
  let turns = 0;

  async function speak(stimulus: RoomMessage | null): Promise<void> {
    if (lobby && TURN_DELAY) await sleep(TURN_DELAY); // pace so it's readable
    const kickoff = stimulus === null;
    const result = stimulus?.kind === "commentator"; // a real outcome, not banter
    const human = stimulus?.kind === "human";
    const baton = kickoff || stimulus?.next === NAME; // a rotation turn (vs a broadcast)
    const userText = stimulus ? `${stimulus.from}: ${stimulus.text}` : KICKOFF;
    status(`${NAME} ${stimulus ? `reacting to ${stimulus.from}` : "opening the lobby"}…`);
    const { reply, tools, callback } = await agent.turn(userText, {
      // In the lobby an agent voices its own take, so it remembers that (below)
      // rather than mining peers; a plain room mines what others say.
      learnPredictions: lobby ? false : !result,
      // in the lobby, only let the magic fire on real news — the result or a human
      allowCallback: !lobby || result || human,
      // in the lobby agents just opine; the commentator is the source of real data
      useTools: !lobby,
    });
    if (tools.length) status(`🔧 ${tools.join(", ")}`);
    if (callback) status(`↩ called back: ${callback}`);
    // On its own rotation turn, file away any prediction it just made so it can
    // call its own shot back when the commentator's result lands.
    if (lobby && baton && !result) await agent.rememberOwnPrediction(reply);
    if (baton) turns += 1; // only rotation turns count toward the cap
    const done = lobby && MAX_TURNS > 0 && turns >= MAX_TURNS;
    // Pass the baton on a rotation turn (or when the host fields a human); a
    // reaction to the commentator's broadcast doesn't hijack the rotation.
    const passBaton = lobby && !done && (baton || (isStarter && human));
    client.post(reply, passBaton ? pickNext(reply) : undefined);
    if (done && baton) status(`${NAME} done after ${turns} turns — dropping the baton.`);
  }

  async function drain(): Promise<void> {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const t = queue.shift()!;
      try {
        await speak("kickoff" in t ? null : t);
      } catch (e: any) {
        status(`error: ${e?.message ?? e}`);
      }
    }
    busy = false;
  }

  client.onMessage((m) => {
    if (m.from === NAME) return;
    status(`saw ${m.from} [${m.kind}]: ${m.text.slice(0, 70)}`);
    const take = lobby
      ? // my baton; the commentator's *result* (not its buildup narration), which
        // everyone reacts to; or — as host — a human dropping in
        m.next === NAME ||
        (m.kind === "commentator" && reportsResult(m.text)) ||
        (isStarter && m.kind === "human")
      : m.kind === "human" || m.kind === "commentator" || mentioned(m.text);
    if (take) {
      queue.push(m);
      void drain();
    }
  });

  client.join(ROOM, PASS);
  if (lobby) {
    status(`${NAME} joined "${ROOM}" lobby [${peers.join(", ")}]${isStarter ? " — host" : ""}.`);
    if (isStarter) {
      // let peers subscribe before opening
      setTimeout(() => {
        queue.push({ kickoff: true });
        void drain();
      }, 1500);
    }
  } else {
    status(`${NAME} joined "${ROOM}". reacting to humans + mentions.`);
  }

  process.on("SIGINT", async () => {
    client.close();
    await agent.close();
    process.exit(0);
  });
}
