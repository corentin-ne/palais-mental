/**
 * Catalog search. Every source is free and keyless; each category queries several in
 * parallel, then results are merged and de-duplicated (first source wins, so the
 * order below is also a quality ranking):
 *
 *  - movies      iTunes (posters, dates) · Wikipedia
 *  - series      TVmaze (posters, seasons, next episodes) · iTunes seasons
 *  - music       iTunes albums · Deezer · MusicBrainz + Cover Art Archive
 *  - books       Google Books · Open Library
 *  - videogames  Steam · Wikipedia
 *  - boardgames  Wikipedia
 *
 * Providers never throw: a failed or offline source returns nothing, and manual entry
 * is always offered.
 */
import { CATEGORIES, CategoryId, ItemSource } from './types';

export interface CatalogResult {
  key: string;
  category: CategoryId;
  title: string;
  creator?: string;
  year?: number;
  /** Full release date (ms) when the source knows it; in the future → awaited. */
  releaseDate?: number;
  coverUrl?: string;
  /** Series only. */
  season?: number;
  episodeCount?: number;
  tvmazeId?: number;
  source: ItemSource;
}

export type Fetcher = (url: string, signal?: AbortSignal) => Promise<unknown>;

const defaultFetch: Fetcher = async (url, signal) => {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ------------------------------------------------------------------ Helpers
export const yearOf = (s?: string | number) => {
  const m = String(s ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
};

/** Only complete dates (YYYY-MM-DD…) become release dates; a bare year stays a year. */
export const dateOf = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return undefined;
  const t = Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isFinite(t) ? t : undefined;
};

const https = (u?: string) => u?.replace(/^http:\/\//, 'https://');
const strip = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** iTunes serves any square size by rewriting the file name. */
const itunesArt = (url?: string) => url?.replace(/\/\d+x\d+bb\./, '/600x600bb.');

// ------------------------------------------------------------------ Parsers (pure, tested)
interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}
export function parseOpenLibrary(json: unknown): CatalogResult[] {
  const docs = ((json as { docs?: OpenLibraryDoc[] })?.docs ?? []).filter((d) => d?.key && d.title);
  return docs.map((d) => ({
    key: `ol:${d.key}`,
    category: 'books',
    title: d.title,
    creator: d.author_name?.[0],
    year: d.first_publish_year,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
    source: { provider: 'openlibrary', id: d.key },
  }));
}

interface GoogleVolume {
  id: string;
  volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; publishedDate?: string; imageLinks?: { thumbnail?: string; smallThumbnail?: string } };
}
export function parseGoogleBooks(json: unknown): CatalogResult[] {
  const items = (json as { items?: GoogleVolume[] })?.items ?? [];
  return items.flatMap((v): CatalogResult[] => {
    const info = v.volumeInfo;
    if (!v.id || !info?.title) return [];
    const thumb = https(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail)?.replace('&edge=curl', '');
    return [
      {
        key: `gb:${v.id}`,
        category: 'books',
        title: info.title,
        creator: info.authors?.[0],
        year: yearOf(info.publishedDate),
        releaseDate: dateOf(info.publishedDate),
        coverUrl: thumb?.replace(/zoom=\d/, 'zoom=1'),
        source: { provider: 'googlebooks', id: v.id },
      },
    ];
  });
}

interface ItunesEntry {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackCount?: number;
}
const SEASON_SUFFIX = /,?\s*(?:Season|Saison|Staffel|Temporada|Stagione)\s*(\d+)\s*$/i;

export function parseItunes(json: unknown, category: 'movies' | 'series' | 'music'): CatalogResult[] {
  const results = (json as { results?: ItunesEntry[] })?.results ?? [];
  return results.flatMap((r): CatalogResult[] => {
    if (category === 'movies') {
      if (!r.trackId || !r.trackName) return [];
      return [
        {
          key: `it:m:${r.trackId}`,
          category,
          title: r.trackName,
          creator: r.artistName,
          year: yearOf(r.releaseDate),
          releaseDate: dateOf(r.releaseDate),
          coverUrl: itunesArt(r.artworkUrl100),
          source: { provider: 'itunes', id: `movie:${r.trackId}` },
        },
      ];
    }
    if (!r.collectionId || !r.collectionName) return [];
    if (category === 'series') {
      const m = r.collectionName.match(SEASON_SUFFIX);
      const title = r.collectionName.replace(SEASON_SUFFIX, '').trim();
      return [
        {
          key: `it:s:${r.collectionId}`,
          category,
          title,
          creator: r.artistName,
          year: yearOf(r.releaseDate),
          coverUrl: itunesArt(r.artworkUrl100),
          season: m ? Number(m[1]) : 1,
          episodeCount: r.trackCount,
          source: { provider: 'itunes', id: `show:${title.toLocaleLowerCase()}` },
        },
      ];
    }
    return [
      {
        key: `it:a:${r.collectionId}`,
        category,
        title: r.collectionName,
        creator: r.artistName,
        year: yearOf(r.releaseDate),
        releaseDate: dateOf(r.releaseDate),
        coverUrl: itunesArt(r.artworkUrl100),
        source: { provider: 'itunes', id: `album:${r.collectionId}` },
      },
    ];
  });
}

interface TvmazeShow {
  id: number;
  name: string;
  premiered?: string | null;
  image?: { medium?: string; original?: string } | null;
  network?: { name?: string } | null;
  webChannel?: { name?: string } | null;
}
export function parseTvmaze(json: unknown): CatalogResult[] {
  const rows = Array.isArray(json) ? (json as { show?: TvmazeShow }[]) : [];
  return rows.flatMap(({ show }): CatalogResult[] => {
    if (!show?.id || !show.name) return [];
    return [
      {
        key: `tm:${show.id}`,
        category: 'series',
        title: show.name,
        creator: show.network?.name ?? show.webChannel?.name ?? undefined,
        year: yearOf(show.premiered ?? undefined),
        releaseDate: dateOf(show.premiered ?? undefined),
        coverUrl: https(show.image?.original ?? show.image?.medium),
        season: 1,
        tvmazeId: show.id,
        source: { provider: 'tvmaze', id: String(show.id) },
      },
    ];
  });
}

interface DeezerAlbum {
  id: number;
  title: string;
  artist?: { name?: string };
  cover_xl?: string;
  cover_big?: string;
}
export function parseDeezer(json: unknown): CatalogResult[] {
  const data = (json as { data?: DeezerAlbum[] })?.data ?? [];
  return data
    .filter((a) => a?.id && a.title)
    .map((a) => ({
      key: `dz:${a.id}`,
      category: 'music' as const,
      title: a.title,
      creator: a.artist?.name,
      coverUrl: a.cover_xl ?? a.cover_big,
      source: { provider: 'deezer' as const, id: String(a.id) },
    }));
}

interface MbReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: { name?: string }[];
  'primary-type'?: string;
}
export function parseMusicBrainz(json: unknown): CatalogResult[] {
  const groups = (json as { 'release-groups'?: MbReleaseGroup[] })?.['release-groups'] ?? [];
  return groups
    .filter((g) => g?.id && g.title && (!g['primary-type'] || ['Album', 'EP'].includes(g['primary-type'])))
    .map((g) => ({
      key: `mb:${g.id}`,
      category: 'music' as const,
      title: g.title,
      creator: g['artist-credit']?.[0]?.name,
      year: yearOf(g['first-release-date']),
      releaseDate: dateOf(g['first-release-date']),
      coverUrl: `https://coverartarchive.org/release-group/${g.id}/front-500`,
      source: { provider: 'musicbrainz' as const, id: g.id },
    }));
}

interface SteamItem {
  id: number;
  name: string;
  tiny_image?: string;
}
export function parseSteam(json: unknown): CatalogResult[] {
  const items = (json as { items?: SteamItem[] })?.items ?? [];
  return items
    .filter((i) => i?.id && i.name)
    .map((i) => ({
      key: `st:${i.id}`,
      category: 'videogames' as const,
      title: i.name,
      // Portrait library capsule: the box-art shape the palace expects.
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${i.id}/library_600x900.jpg`,
      source: { provider: 'steam' as const, id: String(i.id) },
    }));
}

interface WikiPage {
  pageid: number;
  title: string;
  index?: number;
  description?: string;
  thumbnail?: { source: string };
}
/** Wikipedia titles carry disambiguators: "Hades (video game)" → "Hades". */
const WIKI_PAREN = /\s*\((?:[^)]*(?:game|jeu|film|movie)[^)]*|\d{4})\)\s*$/i;

export function parseWikipedia(json: unknown, category: CategoryId, lang: string): CatalogResult[] {
  const pages = Object.values((json as { query?: { pages?: Record<string, WikiPage> } })?.query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => ({
      key: `wp:${lang}:${p.pageid}`,
      category,
      title: p.title.replace(WIKI_PAREN, ''),
      year: yearOf(p.description),
      coverUrl: p.thumbnail?.source,
      source: { provider: 'wikipedia' as const, id: `${lang}:${p.pageid}` },
    }));
}

// ------------------------------------------------------------------ Merge
/** Keep the first occurrence of each work (normalized title + first word of the creator). */
export function mergeResults(lists: CatalogResult[][], limit = 14): CatalogResult[] {
  const seen = new Map<string, CatalogResult>();
  const byTitle = new Map<string, CatalogResult>();
  for (const list of lists) {
    for (const r of list) {
      const t = strip(r.title);
      const c = strip(r.creator ?? '').split(' ')[0];
      const key = `${t}|${c}`;
      const loose = byTitle.get(t);
      // Same title from a later source: fill gaps (cover, year, dates) instead of duplicating.
      if (seen.has(key) || (loose && (!r.creator || !loose.creator))) {
        const keep = seen.get(key) ?? loose!;
        keep.coverUrl ??= r.coverUrl;
        keep.year ??= r.year;
        keep.releaseDate ??= r.releaseDate;
        keep.creator ??= r.creator;
        keep.episodeCount ??= r.episodeCount;
        continue;
      }
      const copy = { ...r };
      seen.set(key, copy);
      if (!byTitle.has(t)) byTitle.set(t, copy);
    }
  }
  return [...seen.values()].slice(0, limit);
}

// ------------------------------------------------------------------ Providers
const LIMIT = 10;
const enc = encodeURIComponent;

function wikiUrl(q: string, hint: string, lang: string) {
  return (
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search` +
    `&gsrsearch=${enc(`${q} ${hint}`)}&gsrlimit=${LIMIT}&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=500`
  );
}

type Provider = (q: string, ctx: { lang: 'en' | 'fr'; country: string; f: Fetcher; signal?: AbortSignal }) => Promise<CatalogResult[]>;

const safe = (p: Provider): Provider => async (q, ctx) => {
  try {
    return await p(q, ctx);
  } catch {
    return [];
  }
};

const itunes = (category: 'movies' | 'series' | 'music', params: string): Provider =>
  safe(async (q, { country, f, signal }) =>
    parseItunes(await f(`https://itunes.apple.com/search?term=${enc(q)}&${params}&limit=${LIMIT}&country=${country}`, signal), category),
  );

const wiki = (category: CategoryId, hints: { en: string; fr: string }): Provider =>
  safe(async (q, { lang, f, signal }) => parseWikipedia(await f(wikiUrl(q, hints[lang], lang), signal), category, lang));

export const PROVIDERS: Record<CategoryId, Provider[]> = {
  movies: [itunes('movies', 'media=movie&entity=movie'), wiki('movies', { en: 'film', fr: 'film' })],
  series: [
    safe(async (q, { f, signal }) => parseTvmaze(await f(`https://api.tvmaze.com/search/shows?q=${enc(q)}`, signal))),
    itunes('series', 'media=tvShow&entity=tvSeason'),
  ],
  music: [
    itunes('music', 'media=music&entity=album'),
    safe(async (q, { f, signal }) => parseDeezer(await f(`https://api.deezer.com/search/album?q=${enc(q)}&limit=${LIMIT}`, signal))),
    safe(async (q, { f, signal }) =>
      parseMusicBrainz(await f(`https://musicbrainz.org/ws/2/release-group?query=${enc(q)}&fmt=json&limit=${LIMIT}`, signal)),
    ),
  ],
  books: [
    safe(async (q, { lang, f, signal }) =>
      parseGoogleBooks(
        await f(`https://www.googleapis.com/books/v1/volumes?q=${enc(q)}&maxResults=${LIMIT}&printType=books&langRestrict=${lang}`, signal),
      ),
    ),
    safe(async (q, { f, signal }) =>
      parseOpenLibrary(
        await f(`https://openlibrary.org/search.json?q=${enc(q)}&limit=${LIMIT}&fields=key,title,author_name,first_publish_year,cover_i`, signal),
      ),
    ),
  ],
  videogames: [
    safe(async (q, { lang, f, signal }) =>
      parseSteam(await f(`https://store.steampowered.com/api/storesearch/?term=${enc(q)}&l=${lang === 'fr' ? 'french' : 'english'}&cc=${lang === 'fr' ? 'FR' : 'US'}`, signal)),
    ),
    wiki('videogames', { en: 'video game', fr: 'jeu vidéo' }),
  ],
  boardgames: [wiki('boardgames', { en: 'board game', fr: 'jeu de société' })],
};

export async function searchCategory(
  category: CategoryId,
  query: string,
  opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher; limit?: number } = { lang: 'en' },
): Promise<CatalogResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const lang = opts.lang.startsWith('fr') ? 'fr' : 'en';
  const ctx = { lang, country: lang === 'fr' ? 'FR' : 'US', f: opts.fetcher ?? defaultFetch, signal: opts.signal } as const;
  const lists = await Promise.all(PROVIDERS[category].map((p) => p(q, ctx)));
  return mergeResults(lists, opts.limit);
}

/** Every category at once, a few results each, for the "All" search. */
export async function searchAll(query: string, opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher }) {
  const groups = await Promise.all(CATEGORIES.map((c) => searchCategory(c, query, { ...opts, limit: 4 })));
  return CATEGORIES.map((c, i) => ({ category: c, results: groups[i] })).filter((g) => g.results.length);
}

// ------------------------------------------------------------------ Series details (TVmaze)
export interface TvmazeSeason {
  number: number;
  episodeOrder: number | null;
}
export function parseTvmazeSeasons(json: unknown): TvmazeSeason[] {
  return (Array.isArray(json) ? (json as TvmazeSeason[]) : []).filter((s) => typeof s?.number === 'number');
}

export async function fetchSeasons(tvmazeId: number, fetcher: Fetcher = defaultFetch): Promise<TvmazeSeason[]> {
  try {
    return parseTvmazeSeasons(await fetcher(`https://api.tvmaze.com/shows/${tvmazeId}/seasons`));
  } catch {
    return [];
  }
}

export interface NextEpisode {
  date: number;
  season: number;
  number: number;
  name?: string;
}
export function parseNextEpisode(json: unknown): NextEpisode | undefined {
  const ep = (json as { _embedded?: { nextepisode?: { airstamp?: string; season?: number; number?: number; name?: string } } })?._embedded
    ?.nextepisode;
  const date = ep?.airstamp ? Date.parse(ep.airstamp) : NaN;
  if (!ep || !Number.isFinite(date) || typeof ep.season !== 'number' || typeof ep.number !== 'number') return undefined;
  return { date, season: ep.season, number: ep.number, name: ep.name };
}

export async function fetchNextEpisode(tvmazeId: number, fetcher: Fetcher = defaultFetch) {
  try {
    return parseNextEpisode(await fetcher(`https://api.tvmaze.com/shows/${tvmazeId}?embed=nextepisode`));
  } catch {
    return undefined;
  }
}

/** Find a TVmaze id for a series added from another source, so it can still be followed. */
export async function lookupTvmazeId(title: string, fetcher: Fetcher = defaultFetch) {
  try {
    const show = (await fetcher(`https://api.tvmaze.com/singlesearch/shows?q=${enc(title)}`)) as { id?: number };
    return typeof show?.id === 'number' ? show.id : undefined;
  } catch {
    return undefined;
  }
}
