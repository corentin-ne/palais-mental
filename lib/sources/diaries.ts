/**
 * Diary sites for films and series: Letterboxd (public RSS feed, export CSVs), IMDb (export CSVs)
 * and Serializd (a public profile read the way the website reads it, or an export file).
 */
import { getText, norm, quiet } from '../api';
import { parseCsv } from '../csv';
import { ExternalEntry, HttpError, dateMs, enc, rating10, sleep, xmlTag } from './common';
import { usernameFrom } from './username';

// ------------------------------------------------------------------ Letterboxd
/** Letterboxd: the public RSS feed (latest diary entries). */
export async function readLetterboxd(user: string): Promise<ExternalEntry[]> {
  const url = `https://letterboxd.com/${enc(user.trim())}/rss/`;
  // Letterboxd sits behind Cloudflare: ask like a browser, and once more if the first call drops.
  const headers = { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
  const xml = await getText(url, { headers }).catch(async (err) => {
    if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
    await sleep(2000);
    return getText(url, { headers });
  });
  if (!xml.includes('<rss')) throw new HttpError(403);
  const out: ExternalEntry[] = [];
  for (const item of xml.split('<item>').slice(1)) {
    const title = xmlTag(item, 'letterboxd:filmTitle');
    if (!title) continue;
    const year = Number(xmlTag(item, 'letterboxd:filmYear')) || undefined;
    out.push({
      key: letterboxdKey(title, year),
      kind: 'movie',
      titles: [title],
      year,
      tmdbId: xmlTag(item, 'tmdb:movieId'),
      status: 'watched',
      watchedAt: dateMs(xmlTag(item, 'letterboxd:watchedDate')),
      rating: rating10(xmlTag(item, 'letterboxd:memberRating'), 2),
    });
  }
  return out;
}
const letterboxdKey = (title: string, year?: number) => `letterboxd:${norm(title)}|${year ?? ''}`;

const NOT_PROFILES = new Set(['film', 'films', 'tag', 'journal', 'list', 'lists', 'members', 'people', 'actor', 'director', 'crew', 'studio', 'search', 'activity', 'reviews', 'year', 'decade', 'genre', 'country', 'language', 'showdown', 'hq', 'about', 'pro', 'settings']);

/** A boxd.it share link (what the Letterboxd app copies) opens on the profile: its name is the first part of the path. */
export async function letterboxdShortLink(link: string) {
  // The profile page itself may be refused (Cloudflare): only the address it lands on matters.
  const r = await fetch(/^https?:\/\//i.test(link) ? link : `https://${link}`);
  if (!/letterboxd\.com\//i.test(r.url)) throw new HttpError(r.ok ? 404 : r.status);
  const name = usernameFrom('letterboxd', r.url);
  // Share links also open films, lists, tags or articles: only a profile gives a username.
  if (!name || NOT_PROFILES.has(name.toLowerCase())) throw new HttpError(404);
  return name;
}

// ------------------------------------------------------------------ Serializd
/** A Serializd diary row, from the site's JSON or an export file: one show, a season or an episode. */
interface DiaryRow {
  showId?: string;
  title: string;
  season?: number;
  episode?: number;
  at?: number;
  rating?: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const seasonFromName = (v: unknown) => (typeof v === 'string' ? Number(v.match(/(\d+)/)?.[1]) || undefined : undefined);

/** Groups diary rows by show: one entry with every season and episode logged. */
function serializdEntries(rows: DiaryRow[]): ExternalEntry[] {
  const byShow = new Map<string, ExternalEntry>();
  for (const r of rows) {
    if (!r.title) continue;
    const key = `serializd:${r.showId ?? norm(r.title)}`;
    let e = byShow.get(key);
    if (!e) {
      e = { key, kind: 'show', titles: [r.title], tmdbId: r.showId, status: 'planned', episodes: [], seasons: [] };
      byShow.set(key, e);
    }
    if (r.season && r.episode) e.episodes!.push({ season: r.season, number: r.episode, at: r.at });
    else if (r.season) e.seasons!.push({ season: r.season, at: r.at });
    // A rating on the show itself (no season) is the show's rating.
    if (r.rating && !r.season) e.rating ??= r.rating;
    if (r.episode || r.season) e.status = 'watching';
    e.watchedAt = Math.max(e.watchedAt ?? 0, r.at ?? 0) || undefined;
  }
  for (const e of byShow.values()) e.progress = e.episodes!.length + e.seasons!.length * 1000;
  return [...byShow.values()];
}

/** Reads one diary item whatever the field names (the site's JSON or an export). */
function diaryRow(x: any): DiaryRow | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const title = x.showName ?? x.show_name ?? x.showTitle ?? x.show?.name ?? x.Show ?? x['Show Name'] ?? x['Show'] ?? x.Title ?? x.title ?? x.name;
  if (typeof title !== 'string' || !title.trim()) return undefined;
  const seasons: any[] = x.showSeasons ?? x.show?.seasons ?? [];
  const seasonId = x.seasonId ?? x.season_id;
  const season =
    num(x.seasonNumber ?? x.season_number ?? x.Season ?? x['Season Number']) ??
    num(seasons.find((s) => s?.id === seasonId)?.seasonNumber ?? seasons.find((s) => s?.id === seasonId)?.season_number) ??
    seasonFromName(x.seasonName ?? x['Season Name']);
  const episode = num(x.episodeNumber ?? x.episode_number ?? x.Episode ?? x['Episode Number']);
  const date = x.backdate ?? x.watchedDate ?? x.dateWatched ?? x['Watched Date'] ?? x['Date Watched'] ?? x.dateAdded ?? x.date_added ?? x.Date ?? x.date;
  const at = typeof date === 'number' ? (date < 1e12 ? date * 1000 : date) : typeof date === 'string' ? Date.parse(date) || undefined : undefined;
  // Serializd stores ratings out of 10 (half stars as odd numbers).
  const rating = rating10(x.rating ?? x.Rating ?? x['Your Rating']);
  const showId = x.showId ?? x.show_id ?? x.tmdbId ?? x['TMDB ID'] ?? x.show?.id;
  return { title: title.trim(), showId: showId != null && showId !== '' ? String(showId) : undefined, season, episode, at, rating };
}

// The API is served from Render (www.serializd.com sits behind Cloudflare and refuses apps).
const SERIALIZD = 'https://serializd.onrender.com/api';
const SERIALIZD_HEADERS = { Accept: 'application/json', 'X-Requested-With': 'serializd_vercel', Origin: 'https://www.serializd.com', Referer: 'https://www.serializd.com/' };

/** GET with retries: the Render host sleeps when idle and the first calls can fail while it wakes. */
async function serializdGet(path: string): Promise<any> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${SERIALIZD}${path}`, { headers: SERIALIZD_HEADERS });
      if (r.status === 404) throw new HttpError(404);
      if (r.ok) return await r.json();
      last = new HttpError(r.status);
      if (r.status < 500 && r.status !== 429) throw last;
    } catch (err) {
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      last = err;
    }
    await sleep(3000 * (attempt + 1));
  }
  throw last;
}

/** Every page of a paged Serializd list (`totalPages`), items under `key`. */
async function serializdPages(path: (page: number) => string, key: string, max = 80) {
  const out: any[] = [];
  for (let page = 1; page <= max; page++) {
    const json = await serializdGet(path(page));
    const items: any[] = json?.[key] ?? [];
    out.push(...items);
    const pages = Number(json?.totalPages);
    if (!items.length || !Number.isFinite(pages) || page >= pages) break;
    await sleep(350);
  }
  return out;
}

/** Season ids → numbers for one show (`/show/{tmdbId}` lists them). */
async function serializdSeasons(showId: number | string): Promise<Map<number, number>> {
  const json = await quiet(serializdGet(`/show/${showId}`), null);
  const map = new Map<number, number>();
  for (const s of json?.seasons ?? []) if (Number.isFinite(s?.id) && Number.isFinite(s?.seasonNumber)) map.set(s.id, s.seasonNumber);
  return map;
}

/**
 * Serializd: a public profile, read the way the website reads it. The diary gives each
 * episode or season logged with its date and rating; "watched" gives whole seasons marked as
 * seen; "watching" and the watchlist add shows to follow.
 */
export async function readSerializd(user: string): Promise<ExternalEntry[]> {
  const u = enc(user.trim());
  const diary = await serializdPages((p) => `/user/${u}/diary?page=${p}`, 'reviews');
  const [watched, watching, watchlist] = await Promise.all([
    quiet(serializdPages((p) => `/user/${u}/watchedpage_v2/${p}?sort_by=date_added_desc`, 'items'), []),
    quiet(serializdPages((p) => `/user/${u}/currently_watching_page/${p}?sort_by=date_added_desc`, 'items'), []),
    quiet(serializdPages((p) => `/user/${u}/watchlistpage_v2/${p}?sort_by=date_added_desc`, 'items'), []),
  ]);

  const rows: DiaryRow[] = diary.map(diaryRow).filter((r): r is DiaryRow => !!r);
  // Watched seasons come as Serializd season ids: one show lookup each turns them into numbers.
  for (const it of watched) {
    const ids: number[] = Array.isArray(it?.seasonIds) ? it.seasonIds : [];
    if (!it?.showId || !it.showName) continue;
    const at = Date.parse(it.dateAdded) || undefined;
    if (!ids.length) {
      rows.push({ title: it.showName, showId: String(it.showId), at });
      continue;
    }
    const map = await serializdSeasons(it.showId);
    for (const id of ids) {
      const season = map.get(id);
      if (season && season > 0) rows.push({ title: it.showName, showId: String(it.showId), season, at });
    }
    await sleep(250);
  }
  const entries = serializdEntries(rows);
  const known = new Set(entries.map((e) => e.key));
  // Shows only followed or watchlisted: added, nothing ticked.
  for (const it of [...watching, ...watchlist]) {
    if (!it?.showId || !it.showName) continue;
    const key = `serializd:${it.showId}`;
    if (known.has(key)) continue;
    known.add(key);
    entries.push({ key, kind: 'show', titles: [it.showName], tmdbId: String(it.showId), status: 'planned', episodes: [], seasons: [] });
  }
  return entries;
}

/** A Serializd export (or any TV diary file): JSON or CSV with show, season and episode columns. */
function readSerializdFile(name: string, text: string): ExternalEntry[] {
  const trimmed = text.trim();
  let items: any[] = [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      items = Array.isArray(json) ? json : (json.reviews ?? json.diary ?? json.items ?? json.logs ?? json.data ?? []);
    } catch {
      return [];
    }
  } else {
    items = parseCsv(text);
    const cols = Object.keys(items[0] ?? {}).map((c) => c.toLowerCase());
    const hasShow = cols.some((c) => /show/.test(c)) || (/serializd/i.test(name) && cols.some((c) => /title|name/.test(c)));
    if (!hasShow) return [];
  }
  return serializdEntries(items.map(diaryRow).filter((r): r is DiaryRow => !!r));
}

// ------------------------------------------------------------------ Export files
/**
 * Letterboxd (diary, watched, ratings, watchlist .csv from the export zip), IMDb (ratings,
 * watchlist, list .csv), else a Serializd export or any TV diary (JSON or CSV).
 */
export function readDiaryFile(name: string, text: string): ExternalEntry[] {
  if (/^\s*[[{]/.test(text)) return readSerializdFile(name, text);
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const watchlist = /watchlist/i.test(name);

  if (cols.includes('Letterboxd URI') && cols.includes('Name')) {
    return rows
      .filter((r) => r.Name)
      .map((r) => {
        const year = Number(r.Year) || undefined;
        return {
          key: letterboxdKey(r.Name, year),
          kind: 'movie' as const,
          titles: [r.Name],
          year,
          status: watchlist ? ('planned' as const) : ('watched' as const),
          watchedAt: watchlist ? undefined : dateMs(r['Watched Date'] || r.Date),
          rating: rating10(r.Rating, 2),
        };
      });
  }

  if (cols.includes('Const') && cols.includes('Title Type')) {
    const out: ExternalEntry[] = [];
    for (const r of rows) {
      const type = (r['Title Type'] ?? '').toLowerCase().replace(/\s+/g, '');
      const kind = ['movie', 'tvmovie', 'video'].includes(type) ? 'movie' : ['tvseries', 'tvminiseries'].includes(type) ? 'show' : undefined;
      if (!kind || !/^tt\d+$/.test(r.Const ?? '')) continue;
      const rated = rating10(r['Your Rating']);
      out.push({
        key: `imdb:${r.Const}`,
        kind,
        titles: [r.Title, r['Original Title']].filter(Boolean),
        year: Number(r.Year) || undefined,
        imdbId: r.Const,
        // A rated series isn't a series watched to the end: it is only added.
        status: kind === 'movie' && rated && !watchlist ? 'watched' : 'planned',
        watchedAt: dateMs(r['Date Rated']),
        rating: rated,
      });
    }
    return out;
  }
  return readSerializdFile(name, text);
}
