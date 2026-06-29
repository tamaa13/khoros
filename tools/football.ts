/**
 * World Cup 2026 data via TheSportsDB (free tier, no signup — facts only, never
 * logos/badges). The free test key works out of the box; set THESPORTSDB_KEY to
 * use your own. Source must be disclosed; broadcast video is never touched.
 */
const KEY = process.env.THESPORTSDB_KEY ?? "3"; // free public test key
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;
const WC_LEAGUE_ID = "4429"; // "FIFA World Cup" in TheSportsDB

export interface Fixture {
  date: string;
  time?: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status?: string;
  venue?: string;
  city?: string;
}

async function fetchEvents(path: string): Promise<any[]> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`TheSportsDB HTTP ${res.status}`);
  const data = await res.json();
  return data.events ?? [];
}

function toFixture(e: any): Fixture {
  const num = (v: any) => (v === null || v === "" || v === undefined ? null : Number(v));
  return {
    date: e.dateEvent,
    time: typeof e.strTime === "string" ? e.strTime.slice(0, 5) : undefined,
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    homeScore: num(e.intHomeScore),
    awayScore: num(e.intAwayScore),
    status: e.strStatus,
    venue: e.strVenue || undefined,
    city: e.strCity || undefined,
  };
}

function line(f: Fixture): string {
  const played = f.homeScore !== null && f.awayScore !== null;
  const matchup = played
    ? `${f.home} ${f.homeScore}-${f.awayScore} ${f.away}`
    : `${f.home} vs ${f.away}`;
  const when = f.status && f.status !== "NS" ? ` [${f.status}]` : f.time ? ` ${f.time}` : "";
  const where = f.city ? ` — ${f.city}` : "";
  return `${f.date} ${matchup}${when}${where}`;
}

/** Upcoming World Cup matches or recent results, as a short readable list. */
export async function getFixtures(
  when: "upcoming" | "recent" = "upcoming",
  limit = 6,
): Promise<string> {
  const path =
    when === "recent"
      ? `eventspastleague.php?id=${WC_LEAGUE_ID}`
      : `eventsnextleague.php?id=${WC_LEAGUE_ID}`;
  try {
    const fixtures = (await fetchEvents(path)).map(toFixture).slice(0, limit);
    if (fixtures.length === 0) return `No ${when} World Cup matches found right now.`;
    const label = when === "recent" ? "Recent World Cup results" : "Upcoming World Cup matches";
    return `${label}:\n${fixtures.map((f) => `- ${line(f)}`).join("\n")}`;
  } catch (e: any) {
    return `Couldn't fetch World Cup fixtures right now (${e?.message ?? e}).`;
  }
}

/**
 * Today's World Cup matches and their latest status/score. The free TheSportsDB
 * tier has no realtime livescore feed, so "live" here is today's fixtures with
 * the latest known result — honest about its source rather than faking a feed.
 */
export async function getLive(limit = 6): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [past, next] = await Promise.all([
      fetchEvents(`eventspastleague.php?id=${WC_LEAGUE_ID}`).catch(() => []),
      fetchEvents(`eventsnextleague.php?id=${WC_LEAGUE_ID}`).catch(() => []),
    ]);
    const todays = [...past, ...next]
      .filter((e) => e.dateEvent === today)
      .map(toFixture)
      .slice(0, limit);
    if (todays.length === 0) return `No World Cup matches scheduled today (${today}).`;
    return `Today's World Cup matches (${today}):\n${todays.map((f) => `- ${line(f)}`).join("\n")}`;
  } catch (e: any) {
    return `Couldn't fetch today's World Cup matches right now (${e?.message ?? e}).`;
  }
}
