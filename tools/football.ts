/**
 * World Cup 2026 data via TheSportsDB (free tier, no signup — facts only, never
 * logos/badges). The free test key works out of the box; set THESPORTSDB_KEY to
 * use your own. Source must be disclosed; broadcast video is never touched.
 */
const KEY = process.env.THESPORTSDB_KEY ?? "3"; // free public test key
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;
const WC_LEAGUE_ID = "4429"; // "FIFA World Cup" in TheSportsDB

export interface Fixture {
  id?: string; // TheSportsDB idEvent — stable per match, used to derive room topics
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

async function dl(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export interface ImageRef {
  bytes: Buffer;
  kind: "player" | "team";
  name: string;
  via: string; // which image field grounded it
}

async function playerRef(q: string): Promise<ImageRef | null> {
  try {
    const r = await fetch(`${BASE}/searchplayers.php?p=${q}`, { signal: AbortSignal.timeout(15000) });
    const p = (await r.json().catch(() => ({} as any)))?.player?.[0];
    // Prefer the JPEG thumb (RGB) over the cutout (RGBA PNG) — sdcpp wants RGB.
    const url = p?.strThumb || p?.strRender || p?.strCutout;
    if (url) {
      const b = await dl(url);
      if (b) return { bytes: b, kind: "player", name: p.strPlayer, via: p.strThumb ? "thumb" : "render" };
    }
  } catch {
    /* none */
  }
  return null;
}
async function teamRef(q: string): Promise<ImageRef | null> {
  try {
    const r = await fetch(`${BASE}/searchteams.php?t=${q}`, { signal: AbortSignal.timeout(15000) });
    const t = (await r.json().catch(() => ({} as any)))?.teams?.[0];
    const url = t?.strFanart1 || t?.strEquipment || t?.strBadge;
    if (url) {
      const b = await dl(url);
      if (b) return { bytes: b, kind: "team", name: t.strTeam, via: t?.strFanart1 ? "fanart" : t?.strEquipment ? "jersey" : "badge" };
    }
  } catch {
    /* none */
  }
  return null;
}

/** A real reference image (player cutout = real face+kit, or team fanart/jersey)
 *  from TheSportsDB, for img2img grounding. `preferTeam` searches the team first
 *  (so "Brazil" → the team, not a player whose surname is "Brazill"). */
export async function referenceImage(query: string, preferTeam = false): Promise<ImageRef | null> {
  const q = encodeURIComponent(query.trim());
  if (!q) return null;
  return preferTeam ? (await teamRef(q)) ?? (await playerRef(q)) : (await playerRef(q)) ?? (await teamRef(q));
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
    id: e.idEvent ? String(e.idEvent) : undefined,
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
/** Structured upcoming fixtures or recent results — used by the commentator. */
export async function listFixtures(
  when: "upcoming" | "recent" = "upcoming",
  limit = 6,
): Promise<Fixture[]> {
  const path =
    when === "recent"
      ? `eventspastleague.php?id=${WC_LEAGUE_ID}`
      : `eventsnextleague.php?id=${WC_LEAGUE_ID}`;
  return (await fetchEvents(path)).map(toFixture).slice(0, limit);
}

/** Matches happening today (upcoming + just-finished) — the lobby's live rooms. */
export async function todayMatches(): Promise<Fixture[]> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [up, recent] = await Promise.all([listFixtures("upcoming", 16), listFixtures("recent", 16)]);
    const byId = new Map<string, Fixture>();
    for (const f of [...up, ...recent]) {
      if (f.date === today) byId.set(f.id ?? `${f.home}-${f.away}`, f);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

/** The most recent finished match with a decisive (non-draw) score — the Replay Room pick. */
export async function lastDecidedMatch(): Promise<Fixture | null> {
  try {
    const recent = await listFixtures("recent", 16);
    const decided = recent.find(
      (f) => f.homeScore !== null && f.awayScore !== null && f.homeScore !== f.awayScore,
    );
    return decided ?? null;
  } catch {
    return null;
  }
}

export async function getFixtures(
  when: "upcoming" | "recent" = "upcoming",
  limit = 6,
): Promise<string> {
  try {
    const fixtures = await listFixtures(when, limit);
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
