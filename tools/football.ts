/**
 * World Cup 2026 data. Fixtures + live scores come from ESPN's public soccer API
 * (no key, current + complete: every match per day, venues, live/finished scores).
 * Reference images for /imagine still come from TheSportsDB. Source disclosed;
 * broadcast video is never touched.
 */
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const KEY = process.env.THESPORTSDB_KEY ?? "3"; // free public test key (images only)
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

export interface Fixture {
  id?: string; // ESPN event id — stable per match, used to derive room topics
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

// ---- ESPN fixtures/scores ----
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
function shiftDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
async function espnEvents(datesParam: string): Promise<any[]> {
  const res = await fetch(`${ESPN}?dates=${datesParam}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  const data = await res.json();
  return data.events ?? [];
}
function toFixture(e: any): Fixture {
  const c = e.competitions?.[0] ?? {};
  const comps = c.competitors ?? [];
  const home = comps.find((x: any) => x.homeAway === "home") ?? comps[0] ?? {};
  const away = comps.find((x: any) => x.homeAway === "away") ?? comps[1] ?? {};
  const st = e.status?.type ?? {};
  const hasScore = st.state === "in" || st.completed === true; // "0" is meaningless pre-match
  const num = (v: any) => (v === null || v === "" || v === undefined ? null : Number(v));
  return {
    id: e.id ? String(e.id) : undefined,
    date: typeof e.date === "string" ? e.date.slice(0, 10) : "",
    time: typeof e.date === "string" ? e.date.slice(11, 16) || undefined : undefined,
    home: home.team?.displayName ?? "?",
    away: away.team?.displayName ?? "?",
    homeScore: hasScore ? num(home.score) : null,
    awayScore: hasScore ? num(away.score) : null,
    status: st.shortDetail ?? st.description ?? undefined,
    venue: c.venue?.fullName || undefined,
    city: c.venue?.address?.city || undefined,
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
  const now = new Date();
  const range =
    when === "recent"
      ? `${ymd(shiftDays(now, -18))}-${ymd(now)}`
      : `${ymd(now)}-${ymd(shiftDays(now, 18))}`;
  const events = await espnEvents(range);
  const wanted =
    when === "recent"
      ? events.filter((e) => e.status?.type?.completed === true)
      : events.filter((e) => e.status?.type?.state === "pre" || e.status?.type?.state === "in");
  const fx = wanted.map(toFixture);
  fx.sort((a, b) =>
    when === "recent" ? (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")) : (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
  );
  return fx.slice(0, limit);
}

/** Matches happening today (upcoming + just-finished) — the lobby's live rooms. */
export async function todayMatches(): Promise<Fixture[]> {
  try {
    const events = await espnEvents(ymd(new Date()));
    return events.map(toFixture);
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
 * Today's World Cup matches with their latest status/score from ESPN (finished,
 * live, or scheduled). Source disclosed; not a faked feed.
 */
export async function getLive(limit = 6): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const todays = (await espnEvents(ymd(new Date()))).map(toFixture).slice(0, limit);
    if (todays.length === 0) return `No World Cup matches scheduled today (${today}).`;
    return `Today's World Cup matches (${today}):\n${todays.map((f) => `- ${line(f)}`).join("\n")}`;
  } catch (e: any) {
    return `Couldn't fetch today's World Cup matches right now (${e?.message ?? e}).`;
  }
}
