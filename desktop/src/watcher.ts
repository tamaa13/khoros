/**
 * "Watch it for me" — the user can't watch a match, so their agent does.
 *
 * The agent arms a background watcher on the fixture (real ESPN data, the same
 * source the match rooms use), follows it to full time, writes a recap in its
 * own voice, saves it to memory, and delivers it to the My Agent chat. Also
 * powers on-demand recaps of matches that already ended.
 *
 * Watches survive app restarts (persisted in settings and re-armed on boot).
 */
import { Agent } from "../../agent/loop";
import { listFixtures, matchRoom, todayMatches, type Fixture, type MatchRoomData } from "../../tools/football";

export interface WatchEntry {
  id: string;
  home: string;
  away: string;
}

// User-language (incl. Indonesian) names → the names ESPN uses.
const ALIAS: Record<string, string> = {
  prancis: "france", perancis: "france", kroasia: "croatia", jerman: "germany",
  spanyol: "spain", inggris: "england", belanda: "netherlands", portugal: "portugal",
  amerika: "united states", as: "united states", usa: "united states",
  meksiko: "mexico", jepang: "japan", "korea selatan": "south korea", korea: "korea",
  maroko: "morocco", "pantai gading": "ivory coast", swedia: "sweden",
  norwegia: "norway", belgia: "belgium", brasil: "brazil", brazil: "brazil",
  argentina: "argentina", italia: "italy", swiss: "switzerland", denmark: "denmark",
  polandia: "poland", mesir: "egypt", senegal: "senegal", uruguay: "uruguay",
  kolombia: "colombia", ekuador: "ecuador", nigeria: "nigeria", ghana: "ghana",
  australia: "australia", kanada: "canada", qatar: "qatar", iran: "iran",
  kamerun: "cameroon", tunisia: "tunisia", chili: "chile", peru: "peru",
  "afrika selatan": "south africa", serbia: "serbia", wales: "wales", skotlandia: "scotland",
};

// intent/filler words that leak into "X vs Y" captures ("watch France", "Sweden for me")
const STOP = /\b(watch|nonton|tonton\w*|tolong|dong|deh|nanti|besok|kemarin|match|pertandingan|game|laga|buat|untuk|gua|gue|saya|aku|for|me|the|a|si|tim|team|please|hasil|result|recap|rekap|rangkum\w*|ringkas\w*|summar\w*)\b/gi;

/** Pull team names out of free text ("tontonin portugal vs kroasia nanti"). */
export function extractTeams(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  // known names: Indonesian aliases AND the English names themselves,
  // multi-word first so "pantai gading" doesn't half-match
  const known = [...new Set([...Object.keys(ALIAS), ...Object.values(ALIAS)])].sort((a, b) => b.length - a.length);
  for (const name of known) {
    if (t.includes(` ${name} `)) found.add(ALIAS[name] ?? name);
  }
  // an explicit "X vs Y" catches teams the dictionary doesn't know
  const vs = text.match(/([\w'’. -]{3,28}?)\s+(?:vs\.?|versus|lawan|melawan)\s+([\w'’. -]{3,28})/i);
  if (vs) {
    for (const raw of [vs[1]!, vs[2]!]) {
      const name = raw.toLowerCase().replace(STOP, " ").replace(/\s+/g, " ").trim();
      if (name.length >= 3) found.add(ALIAS[name] ?? name);
    }
  }
  return [...found].slice(0, 2);
}

function teamHit(fixtureTeam: string, wanted: string): boolean {
  const a = fixtureTeam.toLowerCase();
  return a.includes(wanted) || wanted.includes(a);
}

/** Find the fixture the user means. `prefer` orders the search by intent:
 *  a recap looks at finished matches first, a watch looks forward first. */
export async function findFixture(teams: string[], prefer: "upcoming" | "recent" = "upcoming"): Promise<Fixture | null> {
  if (teams.length === 0) return null;
  const [today, upcoming, recent] = await Promise.all([todayMatches(), listFixtures("upcoming", 30), listFixtures("recent", 30)]);
  const pools = prefer === "recent" ? [recent, today, upcoming] : [today, upcoming, recent];
  for (const pool of pools) {
    const hit = pool.find((f) => f.id && teams.every((w) => teamHit(f.home, w) || teamHit(f.away, w)));
    if (hit) return hit;
  }
  return null;
}

/** Turn a finished match's real data into compact facts for the agent to retell. */
function matchFacts(room: MatchRoomData): string {
  const goals = room.events.filter((e) => e.emoji === "⚽" && e.key).map((e) => `${e.clock} ${e.text.replace(/^Goal!\s*/i, "")}`);
  const reds = room.events.filter((e) => e.emoji === "🟥").map((e) => `${e.clock} ${e.text}`);
  const parts = [`Final: ${room.home} ${room.homeScore}–${room.awayScore} ${room.away}.`];
  parts.push(goals.length ? `Goals: ${goals.join(" | ")}` : "No goals.");
  if (reds.length) parts.push(`Red cards: ${reds.join(" | ")}`);
  return parts.join("\n");
}

/** One agent-voiced recap of a FINISHED match (also the on-demand recap path). */
export async function recapMatch(agent: Agent, fixtureId: string, forUser = true): Promise<string | null> {
  const room = await matchRoom(fixtureId);
  if (!room || room.state !== "post") return null;
  const facts = matchFacts(room);
  const { reply } = await agent.turn(
    `You watched ${room.home} vs ${room.away} for me. Here's what actually happened (real data):\n${facts}\n\nGive me the recap like a friend who watched it — short, vivid, 3-4 sentences max, mention the score and the moments that mattered.`,
    { learnPredictions: false, allowCallback: false, useTools: false, ephemeral: true },
  );
  if (forUser) await agent.memory.save(`Watched ${room.home} ${room.homeScore}–${room.awayScore} ${room.away} for the user. ${facts.replace(/\n/g, " ")}`, "fact").catch(() => {});
  return reply;
}

const PRE_POLL = 3 * 60_000; // not started: check every 3 min
const LIVE_POLL = 60_000; // in play: every minute

export interface WatcherSocial {
  /** agents present in the relay room, incl. our own */
  peers: () => number;
  /** drop one line into the room (never hijacks the rotation) */
  chime: (text: string) => void;
}

export class MatchWatcher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private seenEvents = -1; // -1 = haven't observed yet (don't react to history)
  private lastChime = 0;

  constructor(
    readonly entry: WatchEntry,
    private readonly agent: Agent,
    private readonly notify: (text: string) => void,
    private readonly done: (id: string) => void,
    private readonly social?: WatcherSocial,
  ) {}

  start(): void {
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    try {
      const room = await matchRoom(this.entry.id);
      if (!room) return this.schedule(PRE_POLL);
      if (room.state === "post") {
        if (this.seenEvents >= 0) await this.react(room, true); // closing line to the room
        const recap = await recapMatch(this.agent, this.entry.id);
        if (recap) this.notify(recap);
        this.done(this.entry.id);
        return;
      }
      if (room.state === "in") {
        if (this.seenEvents < 0) this.seenEvents = room.events.length; // join point: only react to what happens FROM NOW
        else await this.react(room, false);
        this.seenEvents = room.events.length;
      }
      this.schedule(room.state === "in" ? LIVE_POLL : PRE_POLL);
    } catch {
      this.schedule(PRE_POLL); // transient network hiccup — keep watching
    }
  }

  /** Selective room presence: while watching FOR the user, hang in the relay
   *  room and react to the big moments — but only when other agents are
   *  actually there to hear it, and with human pacing (significance × how long
   *  we've been quiet). An empty room gets silence, not a monologue. */
  private async react(room: MatchRoomData, fullTime: boolean): Promise<void> {
    if (!this.social || this.social.peers() < 2) return;
    let moment: string | null = null;
    let weight = 0;
    if (fullTime) {
      moment = `Full time: ${room.home} ${room.homeScore}-${room.awayScore} ${room.away}.`;
      weight = 0.9;
    } else {
      for (const e of room.events.slice(Math.max(0, this.seenEvents))) {
        const w = e.emoji === "⚽" && e.key ? 0.9 : e.emoji === "🟥" ? 0.75 : e.emoji === "🎯" ? 0.6 : 0;
        if (w > weight) {
          weight = w;
          moment = `${e.clock} ${e.text}`;
        }
      }
    }
    if (!moment) return;
    const recharged = Math.min(1, (Date.now() - this.lastChime) / 120_000); // room chat: slower cadence than a live crew
    if (Math.random() > weight * (0.3 + 0.7 * recharged)) return;
    const { reply } = await this.agent.turn(
      `You're watching ${room.home} vs ${room.away} (${room.homeScore}-${room.awayScore}) for your user, hanging out with other agents in the room. Just happened: ${moment} One short, casual reaction line in English.`,
      { learnPredictions: false, allowCallback: false, useTools: false, ephemeral: true },
    );
    this.lastChime = Date.now();
    this.social.chime(reply);
  }
}
