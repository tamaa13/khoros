/**
 * In-process lobby — the "society of agents" inside the desktop app. Two on-device
 * agents back opposite sides of a real finished World Cup match and debate on their
 * own; then a house commentator drops the real result into the room and the agent
 * who called it takes its victory lap ("told you so").
 *
 * Unlike the CLI lobby (separate processes over a Bun WebSocket relay), this runs
 * every agent in one Node process and orchestrates the turns directly — no relay,
 * no Bun. Turns are sequential (awaited one at a time), so the SDK's one-job-per-
 * model rule is respected and the agents share the already-loaded models by id.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { Agent } from "../../agent/loop";
import { listFixtures, type Fixture } from "../../tools/football";

export interface LobbyMessage {
  from: string;
  kind: "agent" | "commentator" | "system";
  text: string;
  callback?: boolean; // this message is a "told you so"
}

interface Spec {
  name: string;
  emoji: string;
  backs: string; // the team this agent predicts to win
}

// Real result used if the live fixtures feed is unreachable (Canada beat South
// Africa 1-0 on 2026-06-28) — keeps the show working offline.
const FALLBACK: Fixture = {
  date: "2026-06-28",
  home: "Canada",
  away: "South Africa",
  homeScore: 1,
  awayScore: 0,
};

export class Lobby {
  private agents: { spec: Spec; agent: Agent }[] = [];
  private fixture: Fixture = FALLBACK;

  constructor(private readonly dataDir: string) {}

  /** Pick a real decided match and wake two agents backing opposite sides. */
  async init(onStatus: (s: string) => void = () => {}): Promise<void> {
    onStatus("checking real World Cup results…");
    this.fixture = await pickDecidedMatch();

    const specs: Spec[] = [
      { name: "Dewi", emoji: "🟢", backs: this.fixture.home },
      { name: "Rian", emoji: "🔵", backs: this.fixture.away },
    ];

    // Fresh memory each run so this debate's predictions drive the callback.
    rmSync(this.dataDir, { recursive: true, force: true });
    for (const spec of specs) {
      onStatus(`waking ${spec.name}…`);
      const agent = new Agent({
        bias: `Lo yakin BANGET ${spec.backs} bakal menang pertandingan ini. Tonjolin prediksimu dengan pede, santai, 1-2 kalimat.`,
        memoryFile: join(this.dataDir, `${spec.name}.json`),
      });
      await agent.init();
      this.agents.push({ spec, agent });
    }
  }

  /** Run the debate, then deliver the real result. Messages stream via `emit`. */
  async run(emit: (m: LobbyMessage) => void, turnsEach = 2): Promise<void> {
    const f = this.fixture;
    const [a, b] = this.agents;

    emit({
      from: "Khoros",
      kind: "system",
      text: `${a.spec.name} ${a.spec.emoji} (${a.spec.backs}) vs ${b.spec.name} ${b.spec.emoji} (${b.spec.backs}) — they argue, then the real result lands.`,
    });

    // Kickoff + alternating baton — the agents voice their takes.
    let stimulus = `Bentar lagi ${f.home} lawan ${f.away}. Menurut lo siapa yang menang, dan kenapa?`;
    const order = [a, b];
    for (let turn = 0; turn < turnsEach * 2; turn++) {
      const speaker = order[turn % 2]!;
      const { reply } = await speaker.agent.turn(stimulus, {
        learnPredictions: false,
        allowCallback: false,
        useTools: false,
      });
      emit({ from: speaker.spec.name, kind: "agent", text: reply });
      stimulus = `${speaker.spec.name}: ${reply}`;
    }

    // Pin each agent's call to its backed team, so the callback lands on the one
    // who was actually right — not on whatever the small model echoed mid-debate.
    await a.agent.memory.save(`${a.spec.backs} bakal menang lawan ${b.spec.backs}`, "prediction");
    await b.agent.memory.save(`${b.spec.backs} bakal menang lawan ${a.spec.backs}`, "prediction");

    // The house commentator drops the real, finished result — naming the winner so
    // recall locks onto the right prediction.
    const winner = (f.homeScore ?? 0) > (f.awayScore ?? 0) ? f.home : f.away;
    const result = `FULL TIME — ${f.home} ${f.homeScore}-${f.awayScore} ${f.away}. ${winner} menang! (real result, source: TheSportsDB)`;
    emit({ from: "Commentator", kind: "commentator", text: result });

    // Each agent reacts; only the one who actually called it gets the callback.
    for (const { spec, agent } of this.agents) {
      const { reply, callback } = await agent.turn(`Commentator: ${result}`, {
        learnPredictions: false,
        allowCallback: true,
        useTools: false,
      });
      emit({ from: spec.name, kind: "agent", text: reply, callback: Boolean(callback) });
    }
  }

  async close(): Promise<void> {
    // The models are shared by id with the main chat agent — unloading them here
    // would pull them out from under it. Just drop the agents; the memory files
    // already persisted, and the models stay loaded for the rest of the app.
    this.agents = [];
  }
}

/** First recent World Cup match with a decisive (non-draw) final score. */
async function pickDecidedMatch(): Promise<Fixture> {
  try {
    const recent = await listFixtures("recent", 12);
    const decided = recent.find(
      (f) => f.homeScore !== null && f.awayScore !== null && f.homeScore !== f.awayScore,
    );
    return decided ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}
