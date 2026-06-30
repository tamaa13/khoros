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

const WIKI_UA = "KhorosApp/1.0 (World Cup watch-mate; s0nderlabs.hq@gmail.com)";

async function dl(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": WIKI_UA }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// Resolve a loose query to a Wikipedia page title (handles accents/aliases).
async function wikiTitle(query: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`,
      { headers: { "User-Agent": WIKI_UA }, signal: AbortSignal.timeout(12000) },
    );
    const j: any = await r.json().catch(() => []);
    return j?.[1]?.[0] ?? null;
  } catch {
    return null;
  }
}

// A real, current, CC-licensed PHOTO from Wikipedia (player pages have actual
// match photos in the national kit; team pages only have crests, so we skip
// those by requiring a .jpg lead image).
async function wikiRef(query: string): Promise<ImageRef | null> {
  try {
    const title = (await wikiTitle(`${query} footballer`)) ?? (await wikiTitle(query));
    if (!title) return null;
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { "User-Agent": WIKI_UA },
      signal: AbortSignal.timeout(12000),
    });
    const j: any = await r.json().catch(() => ({}));
    const thumb: string | undefined = j?.thumbnail?.source;
    if (!thumb || !/\.jpe?g/i.test(thumb)) return null; // real photo only, not a crest/SVG
    const big = thumb.replace(/\/\d+px-/, "/768px-"); // bump the thumb to a usable size
    const bytes = (await dl(big)) ?? (await dl(thumb));
    if (bytes) return { bytes, kind: "player", name: j.title ?? title, via: "wikimedia" };
  } catch {
    /* none */
  }
  return null;
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

/** A real reference image for img2img grounding. Players → Wikipedia (current,
 *  CC-licensed match photos in the national kit), falling back to TheSportsDB.
 *  Teams → TheSportsDB fanart (Wikipedia team pages are just crests). `preferTeam`
 *  routes "Brazil" to the team, not a player whose surname is "Brazill". */
export async function referenceImage(query: string, preferTeam = false): Promise<ImageRef | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const q = encodeURIComponent(trimmed);
  return preferTeam
    ? (await teamRef(q)) ?? (await wikiRef(trimmed)) ?? (await playerRef(q))
    : (await wikiRef(trimmed)) ?? (await playerRef(q)) ?? (await teamRef(q));
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

// ---- Live match room: real per-minute events + scoreboard (ESPN summary) ----
const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

// Flag emoji for the scoreboard (the WC field; falls back to a white flag).
const FLAG: Record<string, string> = {
  Brazil: "🇧🇷", Argentina: "🇦🇷", France: "🇫🇷", Spain: "🇪🇸", Germany: "🇩🇪",
  Portugal: "🇵🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪", Italy: "🇮🇹", Croatia: "🇭🇷",
  Japan: "🇯🇵", "South Korea": "🇰🇷", Mexico: "🇲🇽", "United States": "🇺🇸", USA: "🇺🇸",
  Canada: "🇨🇦", Morocco: "🇲🇦", Senegal: "🇸🇳", Uruguay: "🇺🇾", Colombia: "🇨🇴",
  Norway: "🇳🇴", Sweden: "🇸🇪", Ecuador: "🇪🇨", "Ivory Coast": "🇨🇮", "South Africa": "🇿🇦",
  Nigeria: "🇳🇬", Ghana: "🇬🇭", Australia: "🇦🇺", Switzerland: "🇨🇭", Denmark: "🇩🇰",
  Poland: "🇵🇱", Serbia: "🇷🇸", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Egypt: "🇪🇬", Qatar: "🇶🇦",
  "Saudi Arabia": "🇸🇦", Iran: "🇮🇷", Cameroon: "🇨🇲", Tunisia: "🇹🇳", Peru: "🇵🇪", Chile: "🇨🇱",
};
export function flagFor(team: string): string {
  return FLAG[team] ?? "🏳️";
}

export interface MatchEvent {
  minute: number; // numeric, for ordering
  clock: string; // "23'" as shown
  emoji: string;
  text: string;
  team?: string;
  key: boolean; // goal/card/penalty — the moments agents react to
}

function clockMinute(s?: string): number {
  const m = (s ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
// One classifier for keyEvents + commentary. Returns null for boring lines
// (throw-ins / idle possession). A real GOAL only when the text says "Goal!"
// (so shot attempts — "Attempt saved/missed/blocked" — are NOT counted as goals).
function tagEvent(text: string, type = ""): { emoji: string; key: boolean } | null {
  const s = `${text} ${type}`.toLowerCase();
  if (/^goal!/i.test(text.trim()) || /\bgoal\b\s*[!.]/.test(text.toLowerCase())) return { emoji: "⚽", key: true };
  if (/red card|sent off/.test(s)) return { emoji: "🟥", key: true };
  if (/yellow card|booked|caution/.test(s)) return { emoji: "🟨", key: true };
  if (/penalty (kick|awarded|conceded|missed|saved)/.test(s)) return { emoji: "🎯", key: true };
  if (/attempt|shot|header|effort|\bchance\b/.test(s)) return { emoji: "👟", key: false };
  if (/free kick/.test(s)) return { emoji: "🎯", key: false };
  if (/corner/.test(s)) return { emoji: "🚩", key: false };
  if (/save|denied|tipped/.test(s)) return { emoji: "🧤", key: false };
  if (/offside/.test(s)) return { emoji: "🚫", key: false };
  if (/substitut|replaces/.test(s)) return { emoji: "🔄", key: false };
  if (/kick.?off|first half|second half|full.?time|half.?time|begins|ends/.test(s)) return { emoji: "🏁", key: false };
  return null; // not interesting — drop it
}

export interface MatchRoomData {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number;
  awayScore: number;
  minute: string; // display, e.g. "67'" or "FT"
  kickoff: string; // local kickoff time (for pre-match)
  state: "pre" | "in" | "post";
  live: boolean;
  events: MatchEvent[]; // real, meaningful, minute-sorted
}

/** Full real timeline + live score for one match, from ESPN's summary endpoint. */
export async function matchRoom(eventId: string): Promise<MatchRoomData | null> {
  try {
    const res = await fetch(`${SUMMARY}?event=${eventId}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const d: any = await res.json();
    const comp = d.header?.competitions?.[0] ?? {};
    const cs = comp.competitors ?? [];
    const h = cs.find((x: any) => x.homeAway === "home") ?? cs[0] ?? {};
    const a = cs.find((x: any) => x.homeAway === "away") ?? cs[1] ?? {};
    const st = comp.status?.type ?? {};
    const home = h.team?.displayName ?? h.team?.name ?? "?";
    const away = a.team?.displayName ?? a.team?.name ?? "?";

    const events: MatchEvent[] = [];
    for (const k of d.keyEvents ?? []) {
      const type = k.type?.text ?? String(k.type?.id ?? "event");
      const who = (k.participants ?? []).map((p: any) => p.athlete?.displayName).filter(Boolean).join(", ");
      const team = k.team?.displayName ?? k.team?.abbreviation;
      const text = k.text || [who, type].filter(Boolean).join(" — ") || type;
      const tag = tagEvent(text, type) ?? { emoji: "🏁", key: false };
      events.push({ minute: clockMinute(k.clock?.displayValue), clock: k.clock?.displayValue ?? "", emoji: tag.emoji, text, team, key: tag.key });
    }
    const seen = new Set(events.map((e) => `${e.minute}|${e.text.slice(0, 30)}`));
    for (const c of d.commentary ?? []) {
      if (!c.text) continue;
      const tag = tagEvent(c.text);
      if (!tag) continue;
      const minute = clockMinute(c.time?.displayValue);
      const sig = `${minute}|${c.text.slice(0, 30)}`;
      if (seen.has(sig)) continue; // already have this from keyEvents
      seen.add(sig);
      events.push({ minute, clock: c.time?.displayValue ?? "", emoji: tag.emoji, text: c.text, key: tag.key });
    }
    events.sort((x, y) => x.minute - y.minute || (x.key === y.key ? 0 : x.key ? -1 : 1));

    const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v));
    const state: "pre" | "in" | "post" = st.state === "in" ? "in" : st.state === "post" || st.completed ? "post" : "pre";
    const cd = comp.date ?? d.header?.competitions?.[0]?.date;
    return {
      id: eventId,
      home, away, homeFlag: flagFor(home), awayFlag: flagFor(away),
      homeScore: num(h.score), awayScore: num(a.score),
      minute: state === "post" ? "FT" : st.shortDetail ?? st.detail ?? (state === "pre" ? "—" : ""),
      kickoff: typeof cd === "string" ? new Date(cd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      state, live: state === "in", events,
    };
  } catch {
    return null;
  }
}

export interface RoomChoice {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  state: "pre" | "in" | "post";
  kickoff?: string; // local time for upcoming matches
  detail: string; // ESPN short status
  live: boolean;
}

/** The rooms a user can open: today's matches (live / upcoming / finished) plus
 *  a replay of the most recent decided match. Real ESPN data, nothing faked. */
export async function availableRooms(): Promise<RoomChoice[]> {
  const out: RoomChoice[] = [];
  try {
    const today = await espnEvents(ymd(new Date()));
    for (const e of today) {
      const f = toFixture(e);
      if (!f.id) continue;
      const s = e.status?.type?.state;
      out.push({
        id: f.id,
        home: f.home,
        away: f.away,
        homeFlag: flagFor(f.home),
        awayFlag: flagFor(f.away),
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        state: s === "in" ? "in" : s === "post" ? "post" : "pre",
        kickoff: typeof e.date === "string" ? new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : f.time,
        detail: f.status ?? "",
        live: s === "in",
      });
    }
  } catch {
    /* none today */
  }
  // Always offer a replay of the last finished match (so there's something to watch).
  const last = await lastDecidedMatch();
  if (last?.id && !out.some((r) => r.id === last.id)) {
    out.push({
      id: last.id,
      home: last.home,
      away: last.away,
      homeFlag: flagFor(last.home),
      awayFlag: flagFor(last.away),
      homeScore: last.homeScore,
      awayScore: last.awayScore,
      state: "post",
      detail: "replay",
      live: false,
    });
  }
  return out;
}

/** Pick the room's match: a live one if any, else the most recent decided match. */
export async function liveOrLatestMatch(): Promise<{ id: string; live: boolean } | null> {
  try {
    // Live now? scan a window around today for state==="in".
    const now = new Date();
    const wide = await espnEvents(`${ymd(shiftDays(now, -2))}-${ymd(shiftDays(now, 2))}`);
    const liveEv = wide.find((e) => e.status?.type?.state === "in");
    if (liveEv?.id) return { id: String(liveEv.id), live: true };
  } catch {
    /* fall through to replay */
  }
  const last = await lastDecidedMatch();
  return last?.id ? { id: last.id, live: false } : null;
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
