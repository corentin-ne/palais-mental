/**
 * Catalog search: finds real titles with their artwork so logging is "type a few
 * letters, tap the right cover". Every provider is keyless and public:
 *  - books                 → Open Library
 *  - movies, series, music → iTunes Search API (posters, seasons with episode counts, album art)
 *  - board & video games   → Wikipedia (page image + short description)
 * Providers never throw: a failed or offline source simply returns no results, and the
 * log flow always offers manual entry.
 */
import { CATEGORIES, CategoryId, ItemSource } from './types';

export interface CatalogResult {
  key: string;
  category: CategoryId;
  title: string;
  creator?: string;
  year?: number;
  coverUrl?: string;
  /** Series only. */
  season?: number;
  episodeCount?: number;
  source: ItemSource;
}

type Fetcher = (url: string, signal?: AbortSignal) => Promise<unknown>;

const defaultFetch: Fetcher = async (url, signal) => {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const yearOf = (s?: string) => {
  const m = s?.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
};

/** iTunes serves any square size by rewriting the file name. */
const itunesArt = (url?: string) => url?.replace(/\/\d+x\d+bb\./, '/600x600bb.');

// ------------------------------------------------------------------ Parsers (pure, testable)
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

interface ItunesEntry {
  wrapperType?: string;
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
          // The show, not the season, is the collection item: seasons of one show share an id.
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
        coverUrl: itunesArt(r.artworkUrl100),
        source: { provider: 'itunes', id: `album:${r.collectionId}` },
      },
    ];
  });
}

interface WikiPage {
  pageid: number;
  title: string;
  index?: number;
  description?: string;
  thumbnail?: { source: string };
}
/** Wikipedia titles carry disambiguators: "Hades (video game)" → "Hades". */
const WIKI_PAREN = /\s*\((?:[^)]*(?:game|jeu)[^)]*|\d{4})\)\s*$/i;

export function parseWikipedia(json: unknown, category: 'videogames' | 'boardgames', lang: string): CatalogResult[] {
  const pages = Object.values((json as { query?: { pages?: Record<string, WikiPage> } })?.query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => ({
      key: `wp:${lang}:${p.pageid}`,
      category,
      title: p.title.replace(WIKI_PAREN, ''),
      creator: undefined,
      year: yearOf(p.description),
      coverUrl: p.thumbnail?.source,
      source: { provider: 'wikipedia' as const, id: `${lang}:${p.pageid}` },
    }));
}

// ------------------------------------------------------------------ Providers
const LIMIT = 12;

function itunesUrl(q: string, category: 'movies' | 'series' | 'music', country: string) {
  const params = {
    movies: 'media=movie&entity=movie',
    series: 'media=tvShow&entity=tvSeason',
    music: 'media=music&entity=album',
  }[category];
  return `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&${params}&limit=${LIMIT}&country=${country}`;
}

function wikiUrl(q: string, category: 'videogames' | 'boardgames', lang: string) {
  const hint = {
    videogames: lang === 'fr' ? 'jeu vidéo' : 'video game',
    boardgames: lang === 'fr' ? 'jeu de société' : 'board game',
  }[category];
  const search = encodeURIComponent(`${q} ${hint}`);
  return (
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search` +
    `&gsrsearch=${search}&gsrlimit=${LIMIT}&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=500`
  );
}

export async function searchCategory(
  category: CategoryId,
  query: string,
  opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher } = { lang: 'en' },
): Promise<CatalogResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const f = opts.fetcher ?? defaultFetch;
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const country = lang === 'fr' ? 'FR' : 'US';
  try {
    switch (category) {
      case 'books':
        return parseOpenLibrary(
          await f(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${LIMIT}&fields=key,title,author_name,first_publish_year,cover_i`,
            opts.signal,
          ),
        );
      case 'movies':
      case 'series':
      case 'music':
        return parseItunes(await f(itunesUrl(q, category, country), opts.signal), category);
      case 'videogames':
      case 'boardgames':
        return parseWikipedia(await f(wikiUrl(q, category, lang), opts.signal), category, lang);
    }
  } catch {
    return [];
  }
}

/** Every category at once, a few results each, for the "All" search. */
export async function searchAll(query: string, opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher }) {
  const groups = await Promise.all(CATEGORIES.map((c) => searchCategory(c, query, opts)));
  return CATEGORIES.map((c, i) => ({ category: c, results: groups[i].slice(0, 4) })).filter((g) => g.results.length);
}
