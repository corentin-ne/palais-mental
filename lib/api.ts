/**
 * Metadata sources. Series come from TVmaze (keyless: episodes, air times, artwork, cast).
 * Films come from TMDB when a key is set in Settings, otherwise from keyless sources merged
 * together: IMDb suggestions (posters), iTunes (release dates, synopses) and Wikidata +
 * Wikipedia (exact release dates, runtime, director, summary).
 *
 * Every request is cached in memory for a few minutes and fetchers never throw for a
 * single failed source: a search returns what the other sources found.
 */
import { Episode, MediaKind, Movie, MovieSource, Show } from './types';

// ------------------------------------------------------------------ Fetch + cache
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<T>;
  const value = fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  cache.set(url, { at: Date.now(), value });
  value.catch(() => cache.delete(url));
  return value as Promise<T>;
}

/** Plain text (RSS, CSV) with the same in-memory cache. */
export function getText(url: string, init?: RequestInit): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<string>;
  const value = fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
  cache.set(url, { at: Date.now(), value });
  value.catch(() => cache.delete(url));
  return value;
}

/** JSON without caching (POST bodies, paged account lists). */
export async function postJson<T = any>(url: string, body: string, headers: Record<string, string>): Promise<T> {
  const r = await fetch(url, { method: 'POST', body, headers: { Accept: 'application/json', ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const quiet = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

const enc = encodeURIComponent;
export const yearOf = (s?: string | number | null) => {
  const m = String(s ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
};
/** Only full dates become release dates; noon UTC keeps the same calendar day everywhere. */
export const dateOf = (s?: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return undefined;
  const t = Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isFinite(t) ? t : undefined;
};
export const stripHtml = (s?: string | null) =>
  s
    ? s
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim() || undefined
    : undefined;
const https = (u?: string | null) => u?.replace(/^http:\/\//, 'https://') ?? undefined;
export const norm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ------------------------------------------------------------------ Search results
export interface SearchResult {
  kind: MediaKind;
  /** Show: TVmaze id. Film, book, game: their id. */
  id: string;
  title: string;
  year?: number;
  poster?: string;
  subtitle?: string;
  releaseDate?: number;
}

// ------------------------------------------------------------------ TVmaze
const TVMAZE = 'https://api.tvmaze.com';

interface TvmazeShow {
  id: number;
  name: string;
  premiered?: string | null;
  status?: string;
  genres?: string[];
  runtime?: number | null;
  averageRuntime?: number | null;
  summary?: string | null;
  weight?: number;
  image?: { medium?: string; original?: string } | null;
  network?: { name?: string } | null;
  webChannel?: { name?: string } | null;
  externals?: { imdb?: string | null } | null;
  _embedded?: { episodes?: TvmazeEpisode[]; cast?: TvmazeCast[]; images?: TvmazeImage[] };
}
interface TvmazeEpisode {
  id: number;
  name?: string;
  season: number;
  number: number | null;
  type?: string;
  airstamp?: string | null;
  runtime?: number | null;
  image?: { medium?: string; original?: string } | null;
  summary?: string | null;
}
interface TvmazeCast {
  person?: { name?: string; image?: { medium?: string } | null };
  character?: { name?: string };
}
interface TvmazeImage {
  type?: string;
  main?: boolean;
  resolutions?: { original?: { url?: string; width?: number }; medium?: { url?: string } };
}

function showResult(s: TvmazeShow): SearchResult {
  return {
    kind: 'show',
    id: String(s.id),
    title: s.name,
    year: yearOf(s.premiered),
    poster: https(s.image?.medium ?? s.image?.original),
    subtitle: s.network?.name ?? s.webChannel?.name ?? undefined,
  };
}

export async function searchShows(q: string): Promise<SearchResult[]> {
  const rows = await quiet(getJson<{ show: TvmazeShow }[]>(`${TVMAZE}/search/shows?q=${enc(q)}`), []);
  return rows.filter((r) => r?.show?.id && r.show.name).map((r) => showResult(r.show));
}

/** Shows on air today, most followed first: a starting point before typing anything. */
export async function popularShows(): Promise<SearchResult[]> {
  const day = new Date().toISOString().slice(0, 10);
  const [tv, web] = await Promise.all([
    quiet(getJson<{ show?: TvmazeShow }[]>(`${TVMAZE}/schedule?country=US&date=${day}`), []),
    quiet(getJson<{ _embedded?: { show?: TvmazeShow } }[]>(`${TVMAZE}/schedule/web?date=${day}`), []),
  ]);
  const shows = new Map<number, TvmazeShow>();
  for (const s of [...tv.map((e) => e.show), ...web.map((e) => e._embedded?.show)]) if (s?.id && s.image) shows.set(s.id, s);
  return [...shows.values()]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 18)
    .map(showResult);
}

export interface ShowDetails {
  show: Omit<Show, 'watched' | 'addedAt' | 'droppedAt'>;
  cast: { name: string; character?: string; image?: string }[];
  /** Episode id → synopsis, shown in the episode list but never stored. */
  synopsis: Record<number, string>;
}

function pickImage(images: TvmazeImage[] | undefined, type: string) {
  const list = (images ?? []).filter((i) => i.type === type && i.resolutions?.original?.url);
  const best = list.find((i) => i.main) ?? list.sort((a, b) => (b.resolutions?.original?.width ?? 0) - (a.resolutions?.original?.width ?? 0))[0];
  return https(best?.resolutions?.original?.url);
}

export async function fetchShow(tvmazeId: number, tmdbKey?: string): Promise<ShowDetails> {
  const [s, images] = await Promise.all([
    getJson<TvmazeShow>(`${TVMAZE}/shows/${tvmazeId}?embed[]=episodes&embed[]=cast`),
    quiet(getJson<TvmazeImage[]>(`${TVMAZE}/shows/${tvmazeId}/images`), []),
  ]);
  const raw = (s._embedded?.episodes ?? []).filter((e) => e.number != null && e.season > 0 && e.type !== 'insignificant_special');
  const episodes: Episode[] = raw.map((e) => ({
    id: e.id,
    season: e.season,
    number: e.number as number,
    name: e.name ?? '',
    airstamp: e.airstamp ? Date.parse(e.airstamp) || undefined : undefined,
    runtime: e.runtime ?? undefined,
    image: https(e.image?.medium),
  }));
  const synopsis: Record<number, string> = {};
  for (const e of raw) {
    const text = stripHtml(e.summary);
    if (text) synopsis[e.id] = text;
  }
  let backdrop = pickImage(images, 'background');
  const imdbId = s.externals?.imdb ?? undefined;
  if (!backdrop && tmdbKey && imdbId) backdrop = await quiet(tmdbBackdropFor(imdbId, tmdbKey), undefined);
  return {
    show: {
      id: String(s.id),
      tvmazeId: s.id,
      title: s.name,
      poster: pickImage(images, 'poster') ?? https(s.image?.original ?? s.image?.medium),
      backdrop,
      year: yearOf(s.premiered),
      network: s.network?.name ?? s.webChannel?.name ?? undefined,
      status: s.status,
      genres: s.genres ?? [],
      summary: stripHtml(s.summary),
      runtime: s.averageRuntime ?? s.runtime ?? undefined,
      imdbId,
      episodes,
      syncedAt: Date.now(),
    },
    cast: (s._embedded?.cast ?? [])
      .filter((c) => c.person?.name)
      .slice(0, 16)
      .map((c) => ({ name: c.person!.name!, character: c.character?.name, image: https(c.person?.image?.medium) })),
    synopsis,
  };
}

// ------------------------------------------------------------------ TMDB (optional key)
const TMDB = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/';

export function tmdb<T = any>(path: string, key: string, lang = 'en'): Promise<T> {
  const bearer = key.length > 40;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TMDB}${path}${sep}language=${lang}${bearer ? '' : `&api_key=${enc(key)}`}`;
  return getJson<T>(url, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
}
export const tmdbImg = (path?: string | null, size = 'w500') => (path ? `${TMDB_IMG}${size}${path}` : undefined);

interface TmdbMovie {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  runtime?: number | null;
  imdb_id?: string | null;
  genres?: { name: string }[];
  credits?: { crew?: { job?: string; name?: string }[]; cast?: { name?: string; character?: string; profile_path?: string | null }[] };
}

const tmdbResult = (m: TmdbMovie): SearchResult => ({
  kind: 'movie',
  id: `tmdb-${m.id}`,
  title: m.title,
  year: yearOf(m.release_date),
  releaseDate: dateOf(m.release_date),
  poster: tmdbImg(m.poster_path, 'w342'),
});

async function tmdbBackdropFor(imdbId: string, key: string) {
  const r = await tmdb<{ tv_results?: TmdbMovie[]; movie_results?: TmdbMovie[] }>(`/find/${imdbId}?external_source=imdb_id`, key);
  const hit = r.tv_results?.[0] ?? r.movie_results?.[0];
  return tmdbImg(hit?.backdrop_path, 'w1280');
}

/** Checks a key by asking TMDB for its configuration. */
export async function validateTmdbKey(key: string) {
  try {
    await tmdb('/configuration', key.trim());
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ Keyless film sources
interface ImdbSuggestion {
  id?: string;
  l?: string;
  y?: number;
  qid?: string;
  s?: string;
  i?: { imageUrl?: string };
}
/** IMDb (Amazon) images resize through their file name. */
const imdbArt = (url?: string) => url?.replace(/\._V1_[^/]*\.(jpe?g|png)$/i, '._V1_QL75_UX500_.$1');

async function imdbSearch(q: string): Promise<SearchResult[]> {
  const first = norm(q).replace(/\s/g, '').charAt(0) || 'x';
  const json = await getJson<{ d?: ImdbSuggestion[] }>(`https://v3.sg.media-imdb.com/suggestion/${first}/${enc(q.toLocaleLowerCase())}.json`);
  return (json.d ?? [])
    .filter((d) => d.id?.startsWith('tt') && d.l && (d.qid === 'movie' || d.qid === 'tvMovie'))
    .map((d) => ({ kind: 'movie' as const, id: `imdb-${d.id}`, title: d.l!, year: d.y, poster: imdbArt(d.i?.imageUrl), subtitle: d.s }));
}

interface ItunesMovie {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  longDescription?: string;
  trackTimeMillis?: number;
}
const itunesArt = (url?: string, size = '600x900') => url?.replace(/\/\d+x\d+bb\./, `/${size}bb.`);

async function itunesSearch(q: string, country: string): Promise<(SearchResult & { raw: ItunesMovie })[]> {
  const json = await getJson<{ results?: ItunesMovie[] }>(
    `https://itunes.apple.com/search?term=${enc(q)}&media=movie&entity=movie&limit=15&country=${country}`,
  );
  return (json.results ?? [])
    .filter((r) => r.trackId && r.trackName)
    .map((r) => ({
      kind: 'movie' as const,
      id: `itunes-${r.trackId}`,
      title: r.trackName!,
      year: yearOf(r.releaseDate),
      releaseDate: dateOf(r.releaseDate),
      poster: itunesArt(r.artworkUrl100),
      subtitle: r.artistName,
      raw: r,
    }));
}

export async function searchMovies(q: string, opts: { tmdbKey?: string; lang: string }): Promise<SearchResult[]> {
  if (opts.tmdbKey) {
    const r = await quiet(tmdb<{ results?: TmdbMovie[] }>(`/search/movie?query=${enc(q)}&include_adult=false`, opts.tmdbKey, opts.lang), null);
    if (r) return (r.results ?? []).slice(0, 20).map(tmdbResult);
  }
  const country = opts.lang === 'fr' ? 'fr' : 'us';
  const [imdb, itunes] = await Promise.all([quiet(imdbSearch(q), []), quiet(itunesSearch(q, country), [])]);
  // IMDb leads (it knows upcoming films); iTunes fills release dates and adds what IMDb missed.
  const out: SearchResult[] = [...imdb];
  for (const it of itunes) {
    const twin = out.find((r) => norm(r.title) === norm(it.title) && (!r.year || !it.year || Math.abs(r.year - it.year) <= 1));
    if (twin) {
      twin.releaseDate ??= it.releaseDate;
      twin.poster ??= it.poster;
    } else out.push({ kind: 'movie', id: it.id, title: it.title, year: it.year, releaseDate: it.releaseDate, poster: it.poster, subtitle: it.subtitle });
  }
  return out.slice(0, 20);
}

/** Films people are watching now: TMDB trending, else the iTunes top chart. */
export async function popularMovies(opts: { tmdbKey?: string; lang: string }): Promise<SearchResult[]> {
  if (opts.tmdbKey) {
    const r = await quiet(tmdb<{ results?: TmdbMovie[] }>('/trending/movie/week', opts.tmdbKey, opts.lang), null);
    if (r) return (r.results ?? []).slice(0, 18).map(tmdbResult);
  }
  const country = opts.lang === 'fr' ? 'fr' : 'us';
  const feed = await quiet(getJson<any>(`https://itunes.apple.com/${country}/rss/topmovies/limit=18/json`), null);
  const entries: any[] = feed?.feed?.entry ?? [];
  return entries.flatMap((e): SearchResult[] => {
    const id = e?.id?.attributes?.['im:id'];
    const title = e?.['im:name']?.label;
    if (!id || !title) return [];
    const images: any[] = e['im:image'] ?? [];
    return [
      {
        kind: 'movie',
        id: `itunes-${id}`,
        title,
        year: yearOf(e['im:releaseDate']?.label),
        releaseDate: dateOf(e['im:releaseDate']?.label),
        poster: itunesArt(images[images.length - 1]?.label),
      },
    ];
  });
}

// ------------------------------------------------------------------ Wikidata enrichment
type Claims = Record<string, { mainsnak?: { datavalue?: { value?: any } } }[]>;

async function wikidataByImdb(imdbId: string, lang: string) {
  const base = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
  const search = await getJson<any>(`${base}&action=query&list=search&srsearch=haswbstatement:P345=${imdbId}&srlimit=1`);
  const qid: string | undefined = search?.query?.search?.[0]?.title;
  if (!qid) return undefined;
  const ent = await getJson<any>(`${base}&action=wbgetentities&ids=${qid}&props=claims|sitelinks&sitefilter=${lang}wiki|enwiki`);
  const e = ent?.entities?.[qid];
  const claims: Claims = e?.claims ?? {};
  const dates = (claims.P577 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v) => v?.time && v.precision >= 11)
    .map((v) => dateOf(String(v.time).replace(/^\+/, '').slice(0, 10)))
    .filter((d): d is number => !!d)
    .sort((a, b) => a - b);
  const minutes = Number(claims.P2047?.[0]?.mainsnak?.datavalue?.value?.amount);
  const directorId: string | undefined = claims.P57?.[0]?.mainsnak?.datavalue?.value?.id;
  let director: string | undefined;
  if (directorId) {
    const d = await quiet(getJson<any>(`${base}&action=wbgetentities&ids=${directorId}&props=labels&languages=${lang}|en`), null);
    const labels = d?.entities?.[directorId]?.labels;
    director = labels?.[lang]?.value ?? labels?.en?.value;
  }
  const site = e?.sitelinks?.[`${lang}wiki`] ? { lang, title: e.sitelinks[`${lang}wiki`].title } : e?.sitelinks?.enwiki ? { lang: 'en', title: e.sitelinks.enwiki.title } : undefined;
  let overview: string | undefined;
  if (site) {
    const sum = await quiet(getJson<any>(`https://${site.lang}.wikipedia.org/api/rest_v1/page/summary/${enc(site.title.replace(/ /g, '_'))}`), null);
    overview = sum?.extract;
  }
  return { releaseDate: dates[0], runtime: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined, director, overview };
}

// ------------------------------------------------------------------ Film details
export interface MovieDetails {
  movie: Omit<Movie, 'watchedAt' | 'addedAt'>;
  cast: { name: string; character?: string; image?: string }[];
}

export function parseMovieId(id: string): { source: MovieSource; sourceId: string } | undefined {
  const m = id.match(/^(tmdb|imdb|itunes)-(.+)$/);
  return m ? { source: m[1] as MovieSource, sourceId: m[2] } : undefined;
}

export async function fetchMovie(id: string, opts: { tmdbKey?: string; lang: string; hint?: SearchResult }): Promise<MovieDetails> {
  const parsed = parseMovieId(id);
  if (!parsed) throw new Error('Unknown film');
  const { source, sourceId } = parsed;
  const base = { id, source, sourceId, syncedAt: Date.now() };

  if (source === 'tmdb') {
    if (!opts.tmdbKey) throw new Error('TMDB key missing');
    const m = await tmdb<TmdbMovie>(`/movie/${sourceId}?append_to_response=credits`, opts.tmdbKey, opts.lang);
    return {
      movie: {
        ...base,
        title: m.title,
        poster: tmdbImg(m.poster_path),
        backdrop: tmdbImg(m.backdrop_path, 'w1280'),
        year: yearOf(m.release_date),
        releaseDate: dateOf(m.release_date),
        runtime: m.runtime ?? undefined,
        overview: m.overview || undefined,
        genres: (m.genres ?? []).map((g) => g.name),
        director: m.credits?.crew?.find((c) => c.job === 'Director')?.name,
        imdbId: m.imdb_id ?? undefined,
      },
      cast: (m.credits?.cast ?? [])
        .filter((c) => c.name)
        .slice(0, 16)
        .map((c) => ({ name: c.name!, character: c.character, image: tmdbImg(c.profile_path, 'w185') })),
    };
  }

  if (source === 'itunes') {
    const json = await getJson<{ results?: ItunesMovie[] }>(`https://itunes.apple.com/lookup?id=${sourceId}&country=${opts.lang === 'fr' ? 'fr' : 'us'}`);
    const r = json.results?.[0];
    if (!r?.trackName) throw new Error('Not found');
    return {
      movie: {
        ...base,
        title: r.trackName,
        poster: itunesArt(r.artworkUrl100),
        backdrop: itunesArt(r.artworkUrl100, '1200x1800'),
        year: yearOf(r.releaseDate),
        releaseDate: dateOf(r.releaseDate),
        runtime: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60_000) : undefined,
        overview: r.longDescription,
        genres: r.primaryGenreName ? [r.primaryGenreName] : [],
        director: r.artistName,
      },
      cast: [],
    };
  }

  // IMDb id: the suggestion gives title, year and poster; Wikidata and Wikipedia the rest.
  const hint = opts.hint ?? (await quiet(imdbSearch(sourceId), [])).find((r) => r.id === id);
  const wiki = await quiet(wikidataByImdb(sourceId, opts.lang), undefined);
  const releaseDate = wiki?.releaseDate ?? hint?.releaseDate;
  return {
    movie: {
      ...base,
      title: hint?.title ?? sourceId,
      poster: hint?.poster,
      year: yearOf(releaseDate ? new Date(releaseDate).toISOString() : undefined) ?? hint?.year,
      releaseDate,
      runtime: wiki?.runtime,
      overview: wiki?.overview,
      genres: [],
      director: wiki?.director,
      imdbId: sourceId,
    },
    cast: (hint?.subtitle ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
  };
}

// ------------------------------------------------------------------ Extras: trailer, where to watch, more like this
export interface Provider {
  name: string;
  logo?: string;
}
export interface Extras {
  /** YouTube video id of the official trailer (TMDB), else undefined: the page offers a search. */
  trailerKey?: string;
  providers: { stream: Provider[]; rent: Provider[]; buy: Provider[]; link?: string };
  similar: SearchResult[];
}
const NO_EXTRAS: Extras = { providers: { stream: [], rent: [], buy: [] }, similar: [] };

/** Viewing region from the interface language (FR → France, else US). */
export const regionOf = (lang: string) => (lang === 'fr' ? 'FR' : 'US');

interface TmdbVideo {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
}
interface TmdbProviders {
  results?: Record<string, { link?: string; flatrate?: { provider_name: string; logo_path?: string }[]; rent?: { provider_name: string; logo_path?: string }[]; buy?: { provider_name: string; logo_path?: string }[] }>;
}

function pickTrailer(videos?: TmdbVideo[]) {
  const yt = (videos ?? []).filter((v) => v.site === 'YouTube' && v.key);
  return (yt.find((v) => v.type === 'Trailer' && v.official) ?? yt.find((v) => v.type === 'Trailer') ?? yt.find((v) => v.type === 'Teaser') ?? yt[0])?.key;
}

function providersOf(json: TmdbProviders | undefined, region: string): Extras['providers'] {
  const r = json?.results?.[region];
  const map = (list?: { provider_name: string; logo_path?: string }[]) => (list ?? []).slice(0, 8).map((p) => ({ name: p.provider_name, logo: tmdbImg(p.logo_path, 'w92') }));
  return { stream: map(r?.flatrate), rent: map(r?.rent), buy: map(r?.buy), link: r?.link };
}

async function tmdbIdFor(kind: 'movie' | 'tv', imdbId: string, key: string) {
  const r = await tmdb<{ tv_results?: { id: number }[]; movie_results?: { id: number }[] }>(`/find/${imdbId}?external_source=imdb_id`, key);
  return (kind === 'tv' ? r.tv_results : r.movie_results)?.[0]?.id;
}

/** Trailer, streaming services and similar films. Needs a TMDB key; without one the page shows search links. */
export async function fetchMovieExtras(movie: { source: MovieSource; sourceId: string; imdbId?: string }, opts: { tmdbKey?: string; lang: string }): Promise<Extras> {
  if (!opts.tmdbKey) return NO_EXTRAS;
  try {
    const id = movie.source === 'tmdb' ? movie.sourceId : movie.imdbId ? await tmdbIdFor('movie', movie.imdbId, opts.tmdbKey) : undefined;
    if (!id) return NO_EXTRAS;
    const m = await tmdb<{ videos?: { results?: TmdbVideo[] }; 'watch/providers'?: TmdbProviders; recommendations?: { results?: TmdbMovie[] } }>(
      `/movie/${id}?append_to_response=videos,watch/providers,recommendations&include_video_language=${opts.lang},en`,
      opts.tmdbKey,
      opts.lang,
    );
    return {
      trailerKey: pickTrailer(m.videos?.results),
      providers: providersOf(m['watch/providers'], regionOf(opts.lang)),
      similar: (m.recommendations?.results ?? []).filter((r) => r.poster_path).slice(0, 16).map(tmdbResult),
    };
  } catch {
    return NO_EXTRAS;
  }
}

/** Same for a show, found on TMDB through its IMDb id. Similar shows carry their name: they open through TVmaze. */
export async function fetchShowExtras(imdbId: string | undefined, opts: { tmdbKey?: string; lang: string }): Promise<Extras> {
  if (!opts.tmdbKey || !imdbId) return NO_EXTRAS;
  try {
    const id = await tmdbIdFor('tv', imdbId, opts.tmdbKey);
    if (!id) return NO_EXTRAS;
    const s = await tmdb<{ videos?: { results?: TmdbVideo[] }; 'watch/providers'?: TmdbProviders; recommendations?: { results?: { id: number; name: string; first_air_date?: string; poster_path?: string | null }[] } }>(
      `/tv/${id}?append_to_response=videos,watch/providers,recommendations&include_video_language=${opts.lang},en`,
      opts.tmdbKey,
      opts.lang,
    );
    return {
      trailerKey: pickTrailer(s.videos?.results),
      providers: providersOf(s['watch/providers'], regionOf(opts.lang)),
      similar: (s.recommendations?.results ?? [])
        .filter((r) => r.poster_path)
        .slice(0, 16)
        .map((r) => ({ kind: 'show' as const, id: `name:${r.name}`, title: r.name, year: yearOf(r.first_air_date), poster: tmdbImg(r.poster_path, 'w342') })),
    };
  } catch {
    return NO_EXTRAS;
  }
}

/** TVmaze id for a show known only by name (recommendations from TMDB). */
export async function tvmazeIdByName(name: string) {
  const s = await quiet(getJson<{ id?: number }>(`${TVMAZE}/singlesearch/shows?q=${enc(name)}`), null);
  return s?.id;
}

export const youtubeSearch = (title: string, year?: number) => `https://www.youtube.com/results?search_query=${enc(`${title} ${year ?? ''} trailer`.trim())}`;
export const youtubeWatch = (key: string) => `https://www.youtube.com/watch?v=${key}`;
export const justWatchSearch = (title: string, lang: string) => `https://www.justwatch.com/${lang === 'fr' ? 'fr/recherche' : 'us/search'}?q=${enc(title)}`;
export const imdbPage = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;

/** One IMDb title (film or show) by its tt id: title, year and poster, keyless. */
export async function imdbTitle(imdbId: string): Promise<SearchResult | undefined> {
  const json = await quiet(getJson<{ d?: ImdbSuggestion[] }>(`https://v3.sg.media-imdb.com/suggestion/t/${enc(imdbId)}.json`), null);
  const d = json?.d?.find((x) => x.id === imdbId);
  return d?.l ? { kind: 'movie', id: `imdb-${imdbId}`, title: d.l, year: d.y, poster: imdbArt(d.i?.imageUrl), subtitle: d.s } : undefined;
}

/** TVmaze id of a show known by its IMDb id. */
export async function tvmazeIdByImdb(imdbId: string) {
  const s = await quiet(getJson<{ id?: number }>(`${TVMAZE}/lookup/shows?imdb=${enc(imdbId)}`), null);
  return s?.id;
}
