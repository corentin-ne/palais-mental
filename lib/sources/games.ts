/**
 * Games from Steam (your wishlist from a public profile; with a free Steam Web API key, also
 * every game you played and for how long), RetroAchievements (with its free web API key), and
 * export files (HowLongToBeat, Grouvee, Backloggd, Playnite, GOG Galaxy exporters…).
 */
import { parseCsv } from '../csv';
import { ExternalEntry, HttpError, MissingSetup, Status, anyDate, column, enc, fetchJson, fetchText, keyOf, rating10, sleep, xmlTag } from './common';

// ------------------------------------------------------------------ Steam
const API = 'https://api.steampowered.com';

/** The 64-bit id behind a vanity name or profile link; numbers pass through. */
export async function steamId64(input: string, key?: string) {
  const v = input.trim();
  const fromLink = v.match(/profiles\/(\d{17})/)?.[1] ?? (/^\d{17}$/.test(v) ? v : undefined);
  if (fromLink) return fromLink;
  const vanity = v.match(/\/id\/([^/?#]+)/)?.[1] ?? v;
  if (key) {
    const r = await fetchJson<any>(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${enc(key)}&vanityurl=${enc(vanity)}`).catch(() => null);
    if (r?.response?.steamid) return String(r.response.steamid);
  }
  const xml = await fetchText(`https://steamcommunity.com/id/${enc(vanity)}/?xml=1`);
  const id = xmlTag(xml, 'steamID64');
  if (!id) throw new HttpError(404);
  return id;
}

/** Played at least this long: owned games never started stay out of the library. */
const PLAYED_MINUTES = 60;

export async function readSteam(user: string, key?: string): Promise<ExternalEntry[]> {
  const id = await steamId64(user, key?.trim() || undefined);
  const out: ExternalEntry[] = [];
  if (key?.trim()) {
    const r = await fetchJson<any>(`${API}/IPlayerService/GetOwnedGames/v1/?key=${enc(key.trim())}&steamid=${id}&include_appinfo=1&include_played_free_games=1`);
    for (const g of r?.response?.games ?? []) {
      if (!g?.appid || !g.name || (g.playtime_forever ?? 0) < PLAYED_MINUTES) continue;
      out.push({
        key: `steam:${g.appid}`,
        kind: 'game',
        titles: [g.name],
        steamId: String(g.appid),
        status: 'watching',
        hours: Math.round((g.playtime_forever / 60) * 2) / 2,
        watchedAt: g.rtime_last_played ? g.rtime_last_played * 1000 : undefined,
      });
    }
  }
  // The wishlist needs no key, only a public profile.
  const wish = await fetchJson<any>(`${API}/IWishlistService/GetWishlist/v1/?steamid=${id}`).catch(() => null);
  const owned = new Set(out.map((e) => e.steamId));
  for (const w of wish?.response?.items ?? []) {
    if (!w?.appid || owned.has(String(w.appid))) continue;
    out.push({ key: `steam:${w.appid}`, kind: 'game', titles: [`Steam ${w.appid}`], steamId: String(w.appid), status: 'planned' });
  }
  return out;
}

// ------------------------------------------------------------------ RetroAchievements
/** RetroAchievements: games you earned achievements in, beaten and mastered ones as finished. */
export async function readRetroAchievements(user: string, key?: string): Promise<ExternalEntry[]> {
  if (!key) throw new MissingSetup('token');
  const out: ExternalEntry[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const r = await fetchJson<any>(`https://retroachievements.org/API/API_GetUserCompletionProgress.php?u=${enc(user.trim())}&y=${enc(key.trim())}&c=500&o=${offset}`);
    const results: any[] = r?.Results ?? [];
    for (const g of results) {
      if (!g?.Title || !g.GameID) continue;
      const done = /beaten|completed|mastered/i.test(g.HighestAwardKind ?? '');
      out.push({
        key: `retroachievements:${g.GameID}`,
        kind: 'game',
        // "~Hack~ Title" and "Title [Subset - …]" are variants: the plain title finds the game.
        titles: [String(g.Title).replace(/^~[^~]+~\s*/, '').replace(/\s*\[.*\]$/, '').replace(/\s*\|.*$/, ''), g.Title],
        platform: g.ConsoleName,
        status: done ? 'watched' : 'watching',
        percent: g.MaxPossible ? Math.round(((g.NumAwarded ?? 0) / g.MaxPossible) * 100) : undefined,
        watchedAt: anyDate(g.HighestAwardDate ?? g.MostRecentAwardedDate),
      });
    }
    if (results.length < 500) break;
    await sleep(500);
  }
  return out;
}

// ------------------------------------------------------------------ Export files
const truthy = (v?: string) => !!v && !/^(|0|no|false|non|-)$/i.test(v.trim());

/** "12.5", "12:30" (h:mm), "12:30:00"; columns in minutes or seconds say so in their name. */
function hoursOf(v: string | undefined, unit: 'h' | 'm' | 's') {
  if (!v?.trim()) return undefined;
  const clock = v.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  const n = clock ? Number(clock[1]) + Number(clock[2]) / 60 : Number(v.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const h = clock ? n : unit === 'm' ? n / 60 : unit === 's' ? n / 3600 : n;
  return Math.round(h * 2) / 2 || undefined;
}

/**
 * A list of games from any tracker's export: a title column, and whatever it has of status
 * (a column, or HowLongToBeat's Playing / Backlog / Completed / Retired flags), playtime,
 * platform, rating and Steam app id.
 */
export function readGamesFile(name: string, text: string): ExternalEntry[] | undefined {
  if (/^\s*[[{]/.test(text)) return undefined;
  const rows = parseCsv(text);
  if (!rows.length) return undefined;
  const cols = Object.keys(rows[0]).map((c) => c.trim().toLowerCase());
  const hasTitle = cols.some((c) => /^(title|name|game|game title|game name|nom|titre)$/.test(c));
  const gamey =
    cols.some((c) => /platform|plateforme|playtime|play time|hours played|time played|steam.?app.?id|^appid$|console|backlog|main story|completionist/.test(c)) ||
    /game|jeux|hltb|howlongtobeat|backloggd|grouvee|playnite|gog|steam|exophase|igdb/i.test(name);
  if (!hasTitle || !gamey) return undefined;
  const playCol = cols.find((c) => /playtime|play time|hours played|time played|^hours$|^progress$/.test(c));
  const unit: 'h' | 'm' | 's' = playCol && /second|\(s\)|secs/.test(playCol) ? 's' : playCol && /minute|\(m\)|mins/.test(playCol) ? 'm' : 'h';
  // Ratings come out of 5, 10 or 100: the largest one in the file tells.
  const ratings = rows.map((r) => Number(column(r, /^(rating|my rating|score|review score|stars|note)$/i))).filter((n) => Number.isFinite(n) && n > 0);
  const top = Math.max(0, ...ratings);
  const scale = top > 10 ? 0.1 : top <= 5 ? 2 : 1;
  const out: ExternalEntry[] = [];
  for (const r of rows) {
    const title = column(r, /^(title|name|game|game title|game name|nom|titre)$/i)?.trim();
    if (!title) continue;
    const text = (column(r, /^(status|shelf|shelves|list|lists|completion status|statut|state)$/i) ?? '').toLowerCase();
    const flag = (re: RegExp) => truthy(column(r, re));
    let status: Status = 'planned';
    if (/abandon|dropped|retired|shelved|stopped|quit/.test(text) || flag(/^retired$/i)) status = 'dropped';
    else if (/complet|beaten|finished|played|mastered|100%|termin|fini/.test(text) || flag(/^(completed|beaten|finished)$/i)) status = 'watched';
    else if (/playing|in progress|en cours|started|current/.test(text) || flag(/^playing$/i)) status = 'watching';
    const hours = hoursOf(playCol ? column(r, new RegExp(`^${playCol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) : undefined, unit);
    if (status === 'planned' && hours && hours >= 1) status = 'watching';
    const steamId = column(r, /^(steam.?app.?id|appid|steam id)$/i)?.match(/^\d+$/)?.[0];
    out.push({
      key: steamId ? `steam:${steamId}` : keyOf('games', title, column(r, /platform|plateforme|console/i)),
      kind: 'game',
      titles: [title],
      steamId,
      platform: column(r, /^(platform|platforms|plateforme|console)$/i),
      status,
      hours,
      watchedAt: anyDate(column(r, /^(completed on|date completed|finished|completion date|date finished|last played|last activity)$/i)),
      rating: rating10(column(r, /^(rating|my rating|score|review score|stars|note)$/i), scale),
    });
  }
  return out;
}
