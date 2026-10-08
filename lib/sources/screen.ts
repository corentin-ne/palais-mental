/**
 * Films and series from more places: Trakt (public profile, with a client id you create on
 * trakt.tv), Kitsu (public anime library), your own Plex, Jellyfin or Emby server, and the
 * files TV Time, Netflix and Trakt let you download.
 */
import { norm } from '../api';
import { parseCsv } from '../csv';
import { seasonHint } from './seasons';
import { ExternalEntry, HttpError, MissingSetup, Status, anyDate, column, enc, fetchJson, keyOf, rating10, serverBase, sleep } from './common';

// ------------------------------------------------------------------ Trakt
const TRAKT = 'https://api.trakt.tv';

interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
  tvdb?: number | null;
}
interface TraktItem {
  movie?: { title?: string; year?: number; ids?: TraktIds };
  show?: { title?: string; year?: number; ids?: TraktIds };
  last_watched_at?: string;
  watched_at?: string;
  rated_at?: string;
  listed_at?: string;
  rating?: number;
  plays?: number;
  seasons?: { number: number; episodes?: { number: number; last_watched_at?: string }[] }[];
  /** History rows (export files): one episode each. */
  episode?: { season?: number; number?: number };
  type?: string;
}

/**
 * Trakt rows (API answers or the JSON files of a Trakt export) folded into one entry per title:
 * watched films and episodes with their dates, ratings, and the watchlist as titles to add.
 */
export function traktEntries(items: TraktItem[]): ExternalEntry[] {
  const out = new Map<string, ExternalEntry>();
  for (const it of items) {
    const media = it.movie ?? it.show;
    const kind = it.movie ? 'movie' : it.show ? 'show' : undefined;
    if (!media?.title || !kind) continue;
    const ids = media.ids ?? {};
    const key = `trakt:${kind}:${ids.trakt ?? ids.slug ?? norm(media.title)}`;
    const e: ExternalEntry = out.get(key) ?? {
      key,
      kind,
      titles: [media.title],
      year: media.year,
      imdbId: ids.imdb ?? undefined,
      tmdbId: ids.tmdb ? String(ids.tmdb) : undefined,
      tvdbId: ids.tvdb ? String(ids.tvdb) : undefined,
      status: 'planned',
      ...(kind === 'show' ? { episodes: [] } : {}),
    };
    const at = anyDate(it.last_watched_at ?? it.watched_at);
    if (it.rating) e.rating ??= rating10(it.rating);
    if (kind === 'movie' && (it.plays || it.last_watched_at || it.watched_at)) {
      e.status = 'watched';
      e.watchedAt = Math.max(e.watchedAt ?? 0, at ?? 0) || undefined;
    }
    for (const s of it.seasons ?? [])
      for (const ep of s.episodes ?? []) e.episodes!.push({ season: s.number, number: ep.number, at: anyDate(ep.last_watched_at) });
    if (it.episode?.season != null && it.episode.number != null) e.episodes!.push({ season: it.episode.season, number: it.episode.number, at });
    if (kind === 'show' && e.episodes!.length) {
      e.status = 'watching';
      e.progress = e.episodes!.length;
    }
    out.set(key, e);
  }
  return [...out.values()];
}

export async function readTrakt(user: string, clientId?: string): Promise<ExternalEntry[]> {
  if (!clientId) throw new MissingSetup('token');
  const headers = { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': clientId.trim() };
  const u = enc(user.trim());
  // The profile itself first: a 404 means no such user, a 401 a private profile.
  await fetchJson(`${TRAKT}/users/${u}`, { headers });
  const paths = ['watched/movies', 'watched/shows', 'ratings/movies', 'ratings/shows', 'watchlist/movies', 'watchlist/shows'];
  const lists: TraktItem[][] = [];
  for (const p of paths) {
    lists.push(await fetchJson<TraktItem[]>(`${TRAKT}/users/${u}/${p}`, { headers }).catch(() => []));
    await sleep(250);
  }
  return traktEntries(lists.flat());
}

// ------------------------------------------------------------------ Kitsu
const KITSU = 'https://kitsu.io/api/edge';

export async function readKitsu(user: string): Promise<ExternalEntry[]> {
  const name = user.trim();
  // Kitsu speaks JSON:API and refuses a plain JSON Accept header.
  const headers = { Accept: 'application/vnd.api+json' };
  const bySlug = await fetchJson<any>(`${KITSU}/users?filter[slug]=${enc(name)}&fields[users]=id`, { headers });
  const found = bySlug?.data?.[0] ?? (await fetchJson<any>(`${KITSU}/users?filter[name]=${enc(name)}&fields[users]=id`, { headers }))?.data?.[0];
  if (!found?.id) throw new HttpError(404);
  const STATUS: Record<string, Status> = { current: 'watching', on_hold: 'watching', completed: 'watched', planned: 'planned', dropped: 'dropped' };
  const out: ExternalEntry[] = [];
  let url: string | undefined =
    `${KITSU}/library-entries?filter[userId]=${found.id}&filter[kind]=anime&include=anime` +
    '&fields[anime]=canonicalTitle,titles,subtype,episodeCount,startDate&fields[libraryEntries]=status,progress,ratingTwenty,finishedAt,progressedAt,anime&page[limit]=500';
  for (let page = 0; url && page < 20; page++) {
    const json: any = await fetchJson(url, { headers });
    const anime = new Map<string, any>((json?.included ?? []).map((a: any) => [a.id, a.attributes]));
    for (const e of json?.data ?? []) {
      const a = anime.get(e?.relationships?.anime?.data?.id);
      const st = STATUS[e?.attributes?.status];
      const kind = a?.subtype === 'movie' ? 'movie' : ['TV', 'ONA'].includes(a?.subtype) ? 'show' : undefined;
      if (!a || !st || !kind) continue;
      out.push({
        key: `kitsu:${e.relationships.anime.data.id}`,
        kind,
        titles: [...new Set([a.titles?.en, a.titles?.en_us, a.canonicalTitle, a.titles?.en_jp].filter((t: unknown): t is string => typeof t === 'string' && !!t.trim()))],
        year: Number(String(a.startDate ?? '').slice(0, 4)) || undefined,
        status: st,
        progress: Number(e.attributes.progress) || 0,
        total: Number(a.episodeCount) || undefined,
        watchedAt: anyDate(e.attributes.finishedAt ?? e.attributes.progressedAt),
        rating: rating10(e.attributes.ratingTwenty, 0.5),
      });
    }
    url = json?.links?.next;
    if (url) await sleep(400);
  }
  return out;
}

// ------------------------------------------------------------------ Plex
interface PlexGuid {
  id?: string;
}
const guid = (list: PlexGuid[] | undefined, scheme: string) => list?.map((g) => g.id ?? '').find((id) => id.startsWith(`${scheme}://`))?.slice(scheme.length + 3);

/**
 * Your Plex server (its address and your X-Plex-Token): films you watched, and in every show
 * you started, the episodes you watched, with dates and ratings.
 */
export async function readPlex(server?: string, token?: string): Promise<ExternalEntry[]> {
  const base = serverBase(server);
  if (!base) throw new MissingSetup('server');
  if (!token) throw new MissingSetup('token');
  const get = (path: string) => fetchJson<any>(`${base}${path}${path.includes('?') ? '&' : '?'}X-Plex-Token=${enc(token.trim())}`);
  const sections: any[] = (await get('/library/sections'))?.MediaContainer?.Directory ?? [];
  const out: ExternalEntry[] = [];
  for (const sec of sections) {
    if (sec.type === 'movie') {
      const films: any[] = (await get(`/library/sections/${sec.key}/all?type=1&includeGuids=1`))?.MediaContainer?.Metadata ?? [];
      for (const m of films) {
        if (!m.viewCount && !m.userRating) continue;
        out.push({
          key: `plex:${guid(m.Guid, 'imdb') ?? keyOf('m', m.title, m.year)}`,
          kind: 'movie',
          titles: [m.title, m.originalTitle].filter(Boolean),
          year: m.year,
          imdbId: guid(m.Guid, 'imdb'),
          tmdbId: guid(m.Guid, 'tmdb'),
          status: m.viewCount ? 'watched' : 'planned',
          watchedAt: m.lastViewedAt ? m.lastViewedAt * 1000 : undefined,
          rating: rating10(m.userRating),
        });
      }
    } else if (sec.type === 'show') {
      const shows: any[] = (await get(`/library/sections/${sec.key}/all?type=2&includeGuids=1`))?.MediaContainer?.Metadata ?? [];
      const episodes: any[] = (await get(`/library/sections/${sec.key}/all?type=4`))?.MediaContainer?.Metadata ?? [];
      const seen = new Map<string, { season: number; number: number; at?: number }[]>();
      for (const ep of episodes) {
        if (!ep.viewCount || ep.parentIndex == null || ep.index == null) continue;
        const list = seen.get(String(ep.grandparentRatingKey)) ?? [];
        list.push({ season: ep.parentIndex, number: ep.index, at: ep.lastViewedAt ? ep.lastViewedAt * 1000 : undefined });
        seen.set(String(ep.grandparentRatingKey), list);
      }
      for (const s of shows) {
        const eps = seen.get(String(s.ratingKey));
        if (!eps?.length && !s.userRating) continue;
        out.push({
          key: `plex:${guid(s.Guid, 'imdb') ?? keyOf('s', s.title, s.year)}`,
          kind: 'show',
          titles: [s.title, s.originalTitle].filter(Boolean),
          year: s.year,
          imdbId: guid(s.Guid, 'imdb'),
          tmdbId: guid(s.Guid, 'tmdb'),
          tvdbId: guid(s.Guid, 'tvdb'),
          status: eps?.length ? 'watching' : 'planned',
          episodes: eps ?? [],
          progress: eps?.length ?? 0,
          rating: rating10(s.userRating),
        });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ Jellyfin and Emby
/**
 * Your Jellyfin or Emby server (address and an API key from its dashboard): played films and
 * episodes for one user (the username you give, else the first). Emby is tried under /emby too.
 */
export async function readJellyfin(server?: string, token?: string, user?: string, service = 'jellyfin'): Promise<ExternalEntry[]> {
  let base = serverBase(server);
  if (!base) throw new MissingSetup('server');
  if (!token) throw new MissingSetup('token');
  const headers = { 'X-Emby-Token': token.trim() };
  let users: any[];
  try {
    users = await fetchJson<any[]>(`${base}/Users`, { headers });
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 404) || /\/emby$/i.test(base)) throw err;
    base = `${base}/emby`;
    users = await fetchJson<any[]>(`${base}/Users`, { headers });
  }
  const who = (user?.trim() && users.find((u) => norm(u?.Name ?? '') === norm(user))) || users[0];
  if (!who?.Id) throw new HttpError(404);
  const items = (q: string) => fetchJson<any>(`${base}/Users/${who.Id}/Items?Recursive=true&${q}`, { headers }).then((r) => (r?.Items ?? []) as any[]);
  const [films, series, episodes] = await Promise.all([
    items('IncludeItemTypes=Movie&Filters=IsPlayed&Fields=ProviderIds,ProductionYear'),
    items('IncludeItemTypes=Series&Fields=ProviderIds,ProductionYear'),
    items('IncludeItemTypes=Episode&Filters=IsPlayed&Fields=ProviderIds'),
  ]);
  const out: ExternalEntry[] = films.map((m) => ({
    key: `${service}:${m.ProviderIds?.Imdb ?? keyOf('m', m.Name, m.ProductionYear)}`,
    kind: 'movie' as const,
    titles: [m.Name, m.OriginalTitle].filter(Boolean),
    year: m.ProductionYear,
    imdbId: m.ProviderIds?.Imdb,
    tmdbId: m.ProviderIds?.Tmdb,
    status: 'watched' as const,
    watchedAt: anyDate(m.UserData?.LastPlayedDate),
    rating: rating10(m.UserData?.Rating),
  }));
  const bySeries = new Map<string, { season: number; number: number; at?: number }[]>();
  for (const ep of episodes) {
    if (ep.ParentIndexNumber == null || ep.IndexNumber == null || !ep.SeriesId) continue;
    const list = bySeries.get(ep.SeriesId) ?? [];
    list.push({ season: ep.ParentIndexNumber, number: ep.IndexNumber, at: anyDate(ep.UserData?.LastPlayedDate) });
    bySeries.set(ep.SeriesId, list);
  }
  for (const s of series) {
    const eps = bySeries.get(s.Id);
    if (!eps?.length) continue;
    out.push({
      key: `${service}:${s.ProviderIds?.Imdb ?? keyOf('s', s.Name, s.ProductionYear)}`,
      kind: 'show',
      titles: [s.Name, s.OriginalTitle].filter(Boolean),
      year: s.ProductionYear,
      imdbId: s.ProviderIds?.Imdb,
      tmdbId: s.ProviderIds?.Tmdb,
      tvdbId: s.ProviderIds?.Tvdb,
      status: 'watching',
      episodes: eps,
      progress: eps.length,
    });
  }
  return out;
}

// ------------------------------------------------------------------ Export files
/**
 * TV Time's data export (GDPR request): episodes seen with show, season and number, followed
 * shows, and films. Column names vary between export versions, so they are matched loosely.
 */
export function readTvTimeRows(rows: Record<string, string>[]): ExternalEntry[] {
  const out = new Map<string, ExternalEntry>();
  for (const r of rows) {
    const show = column(r, /^(tv_show_name|series_name|show_name|tv show name|series)$/i);
    const movie = column(r, /^(movie_name|movie_title|film_name)$/i) ?? (/movie/i.test(column(r, /^(entity_type|type)$/i) ?? '') ? column(r, /^(name|title)$/i) : undefined);
    const at = anyDate(column(r, /^(created_at|watched_at|seen_at|date)$/i));
    if (movie && !show) {
      const key = keyOf('tvtime', movie);
      out.set(key, { key, kind: 'movie', titles: [movie], status: 'watched', watchedAt: at });
      continue;
    }
    if (!show) continue;
    const key = keyOf('tvtime', show);
    const e = out.get(key) ?? { key, kind: 'show' as const, titles: [show], status: 'planned' as Status, episodes: [] };
    const season = Number(column(r, /^(episode_season_number|season_number|season)$/i));
    const number = Number(column(r, /^(episode_number|number|episode)$/i));
    if (season >= 0 && number > 0) {
      e.episodes!.push({ season, number, at });
      e.status = 'watching';
      e.progress = e.episodes!.length;
    }
    if (/^(true|1)$/i.test(column(r, /^archived$/i) ?? '')) e.status = e.episodes!.length ? e.status : 'dropped';
    out.set(key, e);
  }
  return [...out.values()];
}

const SEASON_PART = /^(season|saison|temporada|staffel|stagione|series|part|partie|parte|teil|book|livre|volume|chapter|limited series|mini-?s[ée]rie|miniseries)\b/i;

/**
 * Netflix's viewing history (Account › Viewing activity › Download all): "Title, Date" rows such
 * as "Dark: Season 1: Secrets". Series rows become episodes found by name; the rest are films.
 */
export function readNetflixRows(rows: Record<string, string>[]): ExternalEntry[] {
  const dates = rows.map((r) => r.Date ?? '');
  // US accounts write 1/31/24, most others 31/01/2024: a first number above 12 settles it.
  const dayFirst = dates.some((d) => Number(d.split(/[/.-]/)[0]) > 12);
  const out = new Map<string, ExternalEntry>();
  for (const r of rows) {
    const title = (r.Title ?? '').trim();
    if (!title) continue;
    const at = anyDate(r.Date, dayFirst);
    const parts = title.split(': ');
    const seasonAt = parts.findIndex((p, i) => i > 0 && SEASON_PART.test(p));
    if (seasonAt > 0) {
      const show = parts.slice(0, seasonAt).join(': ');
      const season = seasonHint(parts[seasonAt]) ?? (Number(parts[seasonAt].match(/\d+/)?.[0]) || undefined);
      const name = parts.slice(seasonAt + 1).join(': ');
      const key = keyOf('netflix', show);
      const e = out.get(key) ?? { key, kind: 'show' as const, titles: [show], status: 'watching' as Status, episodeNames: [] };
      if (name) e.episodeNames!.push({ season, name, at });
      e.watchedAt = Math.max(e.watchedAt ?? 0, at ?? 0) || undefined;
      out.set(key, e);
    } else if (parts.length === 2 && !/^(episode|épisode|chapter|chapitre)\s*\d+/i.test(parts[1])) {
      // "Film: Subtitle" reads as a film; "Show: Episode 3" as a show without seasons.
      const key = keyOf('netflix', title);
      out.set(key, { key, kind: 'movie', titles: [title, parts[0]], status: 'watched', watchedAt: at });
    } else if (parts.length >= 2) {
      const show = parts[0];
      const key = keyOf('netflix', show);
      const e = out.get(key) ?? { key, kind: 'show' as const, titles: [show], status: 'watching' as Status, episodeNames: [] };
      e.episodeNames!.push({ name: parts.slice(1).join(': '), at });
      out.set(key, e);
    } else {
      const key = keyOf('netflix', title);
      out.set(key, { key, kind: 'movie', titles: [title], status: 'watched', watchedAt: at });
    }
  }
  return [...out.values()];
}

/** Which of these files it is, from its columns or JSON shape. Undefined: not a screen file. */
export function readScreenFile(name: string, text: string): ExternalEntry[] | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      const items: any[] = Array.isArray(json) ? json : [];
      if (items.some((x) => x && typeof x === 'object' && (x.movie || x.show))) return traktEntries(items);
    } catch {
      return undefined;
    }
    return undefined;
  }
  const rows = parseCsv(text);
  if (!rows.length) return undefined;
  const cols = Object.keys(rows[0]).map((c) => c.trim().toLowerCase());
  if (cols.length <= 3 && cols.includes('title') && cols.includes('date') && (/netflix|viewing/i.test(name) || cols.length === 2)) return readNetflixRows(rows);
  if (cols.some((c) => /tv_show_name|episode_season_number|series_name/.test(c)) || /tvtime|tv_time|seen_episode|followed_tv_show|tracking-prod/i.test(name)) return readTvTimeRows(rows);
  return undefined;
}
