/**
 * House commentator — the chorus. It loads its own LLM, picks a real World Cup
 * match, and narrates it into a relay room as a few punchy beats; the agents in
 * the room react. Honest about its data: with no realtime feed on the free tier,
 * --replay narrates a real *finished* match (real score) as a live-style replay.
 *
 *   bun net/relay.ts
 *   bun commentator.ts --replay        # narrate the latest finished match
 *   bun commentator.ts                 # preview the next upcoming match
 *   bun commentator.ts --replay --voice
 */
import "./quiet"; // before @qvac/sdk
import { completion, loadModel, unloadModel } from "@qvac/sdk";
import { LLM_CTX_SIZE, MODELS } from "./config";
import { RoomClient } from "./net/client";
import { Voice } from "./agent/voice";
import { listFixtures, type Fixture } from "./tools/football";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const RELAY = arg("--relay", process.env.KHOROS_RELAY ?? "ws://localhost:8787")!;
const ROOM = arg("--room", "wc")!;
const PASS = arg("--pass", process.env.KHOROS_ROOM_PASS ?? "worldcup2026")!;
const BEAT_DELAY = Number(arg("--delay", "5000"));
const replay = process.argv.includes("--replay");
const useVoice = process.argv.includes("--voice");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const status = (s: string) => process.stderr.write(`\x1b[2m${s}\x1b[0m\n`);

function clean(s: string): string {
  return s
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\*[^*\n]{1,40}\*/g, "")
    .trim();
}

const PERSONA =
  "You are the house commentator for the 2026 FIFA World Cup — energetic, vivid, concise. Reply with ONE punchy sentence for the moment described. No markdown, no emoji, no lists.";

async function commentate(modelId: string, situation: string): Promise<string> {
  const run = completion({
    modelId,
    history: [
      { role: "system", content: PERSONA },
      { role: "user", content: situation },
    ],
    stream: false,
  });
  const final: any = await run.final;
  return clean(final?.content ?? final?.raw?.fullText ?? final?.text ?? "");
}

function winner(f: Fixture): string | null {
  if (f.homeScore == null || f.awayScore == null || f.homeScore === f.awayScore) return null;
  return f.homeScore > f.awayScore ? f.home : f.away;
}

async function pickMatch(): Promise<Fixture | undefined> {
  if (replay) {
    const recent = await listFixtures("recent", 6);
    return recent.find((f) => f.homeScore != null && f.awayScore != null) ?? recent[0];
  }
  return (await listFixtures("upcoming", 6))[0];
}

function beats(f: Fixture): string[] {
  const where = f.venue ? ` at ${f.venue}${f.city ? `, ${f.city}` : ""}` : "";
  if (replay && f.homeScore != null && f.awayScore != null) {
    const w = winner(f);
    const verdict = w
      ? `${w} won it ${Math.max(f.homeScore, f.awayScore)}-${Math.min(f.homeScore, f.awayScore)}`
      : `it finished ${f.homeScore}-${f.awayScore}, all square`;
    return [
      `Set the scene: ${f.home} versus ${f.away}${where} at the 2026 World Cup. One hyped sentence.`,
      `Kickoff between ${f.home} and ${f.away}. One vivid sentence.`,
      `FULL TIME — state it clearly and dramatically: ${f.home} ${f.homeScore}-${f.awayScore} ${f.away}, ${verdict}. One sentence that names the winner.`,
    ];
  }
  const when = f.date ? ` on ${f.date}${f.time ? ` at ${f.time}` : ""}` : "";
  return [
    `Hype the upcoming fixture ${f.home} versus ${f.away}${where}${when}. One electric sentence.`,
    `What to watch for in ${f.home} vs ${f.away}. One sentence.`,
  ];
}

const match = await pickMatch();
if (!match) {
  status("no World Cup match available to commentate right now");
  process.exit(1);
}

status("commentator loading…");
const modelId = await loadModel({ modelSrc: MODELS.llm, modelConfig: { ctx_size: LLM_CTX_SIZE } });
const voice = useVoice ? new Voice() : undefined;
if (voice) await voice.init();

const client = new RoomClient(RELAY, "Commentator", "commentator");
await client.connect();
client.join(ROOM, PASS);
status(`commentating ${replay ? "(replay)" : "(preview)"}: ${match.home} vs ${match.away}`);

if (replay) {
  client.post(`Replaying a real World Cup match for you — ${match.home} vs ${match.away} from ${match.date}. Here we go.`);
  await sleep(BEAT_DELAY);
}

for (const situation of beats(match)) {
  const line = await commentate(modelId, situation);
  if (!line) continue;
  status(`Commentator › ${line}`);
  client.post(line);
  if (voice) await voice.speak(line);
  await sleep(BEAT_DELAY);
}

await sleep(2000); // let agents finish reacting to the final beat
client.close();
await voice?.close();
await unloadModel({ modelId });
process.exit(0);
