/**
 * Khoros CLI — talk to your on-device World Cup watch-mate.
 *
 *   bun cli.ts            text only
 *   bun cli.ts --voice    also speak replies (needs ffmpeg)
 *
 * Commands: /memories  list what the agent remembers
 *           /recall <q> show what a query would recall
 *           /quit       exit
 */
import "./quiet"; // must be first — sets QVAC_LOG_LEVEL before the SDK loads
import { createInterface } from "node:readline";
import { Agent } from "./agent/loop";

const useVoice = process.argv.includes("--voice");

// Status lines go to stderr (dimmed) so stdout stays a clean conversation.
const status = (s: string) => process.stderr.write(`\x1b[2m${s}\x1b[0m\n`);

const agent = new Agent();

console.log("Khoros — your on-device World Cup watch-mate. Everything runs locally.\n");
await agent.init({ voice: useVoice, onStatus: status });
status(`ready${useVoice ? " (voice on)" : ""}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  status("closing…");
  await agent.close();
  process.exit(0);
}
// Ctrl-C ends the input stream; the loop below then drains and shuts down.
process.on("SIGINT", () => rl.close());

// Returns true when the user asked to quit.
async function handle(line: string): Promise<boolean> {
  const text = line.trim();
  if (!text) return false;

  if (text === "/quit" || text === "/exit") return true;

  if (text === "/memories") {
    const all = agent.memory.all();
    if (all.length === 0) status("(no memories yet)");
    for (const m of all) console.log(`  · [${m.kind}] ${m.text}`);
    return false;
  }

  if (text.startsWith("/recall ")) {
    const hits = await agent.memory.recall(text.slice("/recall ".length));
    if (hits.length === 0) status("(nothing recalled)");
    for (const h of hits) console.log(`  · ${h.score.toFixed(2)} [${h.entry.kind}] ${h.entry.text}`);
    return false;
  }

  const { reply, prediction, callback } = await agent.turn(text);
  console.log(`\nkhoros › ${reply}\n`);
  if (callback) status(`↩ called back: ${callback}`);
  if (prediction) status(`remembered: ${prediction}`);
  return false;
}

// Async iteration serializes turns: each line is fully handled before the next
// is pulled, and the loop only ends once input is exhausted (EOF or /quit).
rl.setPrompt("you › ");
rl.prompt();
for await (const line of rl) {
  let quit = false;
  try {
    quit = await handle(line);
  } catch (e: any) {
    status(`error: ${e?.message ?? e}`);
  }
  if (quit) break;
  if (!shuttingDown) rl.prompt();
}
await shutdown();
