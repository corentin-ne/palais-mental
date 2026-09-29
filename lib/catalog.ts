/**
 * Catalog search. Every source is free and keyless; each category queries the sources
 * listed for it in config/catalog in parallel, then results are merged and de-duplicated
 * (first source wins; later sources fill missing covers and years).
 *
 * Identical requests made by several categories at once (IMDb, Jikan, Wikidata in the
 * "All" search) share one network call. Providers never throw: a failed or offline
 * source returns nothing, and manual entry is always offered.
 */
import { CATEGORIES, CategoryId, ItemSource } from './types';
import { CATALOG, CATALOG_SOURCES, SourceId } from '../config/catalog';

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

/** IMDb (Amazon) images resize through their file name suffix. */
export const imdbArt = (url?: string) => url?.replace(/\._V1_[^/]*\.(jpe?g|png)$/i, '._V1_QL75_UX600_.$1');

/** "Stoker, Bram" → "Bram Stoker" (Gutenberg and MyAnimeList list people surname first). */
export const personName = (s?: string) => {
  if (!s) return undefined;
  const m = s.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2]} ${m[1]}` : s;
};

/** Wikimedia Commons file name → a resized image URL. */
export const commonsImage = (file: string, width = 500) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;

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

export function parseItunesBooks(json: unknown): CatalogResult[] {
  const results = (json as { results?: ItunesEntry[] })?.results ?? [];
  return results.flatMap((r): CatalogResult[] =>
    r.trackId && r.trackName
      ? [
          {
            key: `it:b:${r.trackId}`,
            category: 'books',
            title: r.trackName,
            creator: r.artistName,
            year: yearOf(r.releaseDate),
            releaseDate: dateOf(r.releaseDate),
            coverUrl: itunesArt(r.artworkUrl100),
            source: { provider: 'itunes', id: `book:${r.trackId}` },
          },
        ]
      : [],
  );
}

interface ImdbSuggestion {
  id?: string;
  l?: string;
  qid?: string;
  s?: string;
  y?: number;
  i?: { imageUrl?: string };
}
const IMDB_KINDS: Record<'movies' | 'series' | 'videogames', string[]> = {
  movies: ['movie', 'tvMovie', 'video', 'short'],
  series: ['tvSeries', 'tvMiniSeries'],
  videogames: ['videoGame'],
};
export function parseImdb(json: unknown, category: 'movies' | 'series' | 'videogames'): CatalogResult[] {
  const rows = (json as { d?: ImdbSuggestion[] })?.d ?? [];
  return rows.flatMap((r): CatalogResult[] => {
    if (!r?.id?.startsWith('tt') || !r.l || !IMDB_KINDS[category].includes(r.qid ?? '')) return [];
    return [
      {
        key: `im:${r.id}`,
        category,
        title: r.l,
        // `s` lists the leading cast; for games it is often the studio.
        creator: category === 'videogames' ? undefined : r.s?.split(',')[0]?.trim() || undefined,
        year: r.y,
        coverUrl: imdbArt(r.i?.imageUrl),
        season: category === 'series' ? 1 : undefined,
        source: { provider: 'imdb', id: r.id },
      },
    ];
  });
}

interface JikanEntry {
  mal_id: number;
  title: string;
  title_english?: string | null;
  type?: string | null;
  episodes?: number | null;
  year?: number | null;
  aired?: { from?: string | null } | null;
  published?: { from?: string | null } | null;
  studios?: { name?: string }[];
  authors?: { name?: string }[];
  images?: { jpg?: { large_image_url?: string; image_url?: string }; webp?: { large_image_url?: string } };
}
/** MyAnimeList through Jikan: anime → films or series, manga and light novels → books. */
export function parseJikan(json: unknown, category: 'movies' | 'series' | 'books'): CatalogResult[] {
  const rows = (json as { data?: JikanEntry[] })?.data ?? [];
  return rows.flatMap((r): CatalogResult[] => {
    if (!r?.mal_id || !r.title) return [];
    const type = r.type ?? '';
    if (category === 'movies' && type !== 'Movie') return [];
    if (category === 'series' && !['TV', 'ONA', 'OVA'].includes(type)) return [];
    const from = (category === 'books' ? r.published?.from : r.aired?.from) ?? undefined;
    return [
      {
        key: `mal:${category}:${r.mal_id}`,
        category,
        title: r.title_english || r.title,
        creator: category === 'books' ? personName(r.authors?.[0]?.name) : r.studios?.[0]?.name,
        year: r.year ?? yearOf(from),
        releaseDate: dateOf(from),
        coverUrl: r.images?.jpg?.large_image_url ?? r.images?.webp?.large_image_url ?? r.images?.jpg?.image_url,
        season: category === 'series' ? 1 : undefined,
        episodeCount: category === 'series' ? r.episodes ?? undefined : undefined,
        source: { provider: 'jikan', id: `${category === 'books' ? 'manga' : 'anime'}:${r.mal_id}` },
      },
    ];
  });
}

interface GogProduct {
  id?: string | number;
  title?: string;
  releaseDate?: string;
  developers?: string[];
  coverVertical?: string;
  coverHorizontal?: string;
}
export function parseGog(json: unknown): CatalogResult[] {
  const products = (json as { products?: GogProduct[] })?.products ?? [];
  return products.flatMap((p): CatalogResult[] =>
    p?.id && p.title
      ? [
          {
            key: `gog:${p.id}`,
            category: 'videogames',
            title: p.title,
            creator: p.developers?.[0],
            year: yearOf(p.releaseDate),
            coverUrl: https(p.coverVertical ?? p.coverHorizontal),
            source: { provider: 'gog', id: String(p.id) },
          },
        ]
      : [],
  );
}

interface GutenbergBook {
  id: number;
  title: string;
  authors?: { name?: string }[];
  formats?: Record<string, string>;
}
export function parseGutendex(json: unknown): CatalogResult[] {
  const results = (json as { results?: GutenbergBook[] })?.results ?? [];
  return results.flatMap((b): CatalogResult[] =>
    b?.id && b.title
      ? [
          {
            key: `pg:${b.id}`,
            category: 'books',
            title: b.title.split(/[;:]\s/)[0],
            creator: personName(b.authors?.[0]?.name),
            coverUrl: https(b.formats?.['image/jpeg']),
            source: { provider: 'gutendex', id: String(b.id) },
          },
        ]
      : [],
  );
}

interface BggItem {
  objectid?: string | number;
  name?: string;
  yearpublished?: number | string;
  subtype?: string;
}
/** BoardGameGeek's own search suggestions; artwork is fetched per game afterwards. */
export function parseBggSearch(json: unknown): CatalogResult[] {
  const items = (json as { items?: BggItem[] })?.items ?? [];
  return items.flatMap((i): CatalogResult[] =>
    i?.objectid && i.name && (!i.subtype || i.subtype === 'boardgame')
      ? [
          {
            key: `bgg:${i.objectid}`,
            category: 'boardgames',
            title: i.name,
            year: yearOf(i.yearpublished),
            source: { provider: 'bgg', id: String(i.objectid) },
          },
        ]
      : [],
  );
}

export function parseBggImage(json: unknown): string | undefined {
  const item = (json as { item?: { imageurl?: string; images?: { original?: string; square200?: string } } })?.item;
  return https(item?.imageurl ?? item?.images?.original ?? item?.images?.square200);
}

interface WikidataSearchHit {
  id: string;
  label?: string;
  description?: string;
}
/** Which Wikidata descriptions count as each kind of work (English and French). */
export const WIKIDATA_KINDS: Record<CategoryId, RegExp> = {
  movies: /\b(film|movie)\b/i,
  series: /(television|tv|web) (series|show)|série (télévisée|tv)|sitcom|anime series/i,
  music: /\balbum\b/i,
  books: /\b(novel|book|novella|manga|comic|poetry|roman|livre|essai|bande dessinée)\b/i,
  videogames: /video ?game|jeu vidéo/i,
  boardgames: /board game|card game|tabletop|jeu de société|jeu de cartes/i,
};
export function parseWikidataSearch(json: unknown, category: CategoryId): WikidataSearchHit[] {
  const hits = (json as { search?: WikidataSearchHit[] })?.search ?? [];
  return hits.filter((h) => h?.id && h.label && WIKIDATA_KINDS[category].test(h.description ?? ''));
}

type WikidataClaims = Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
const claimValue = (claims: WikidataClaims | undefined, prop: string) => claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;

/** Poster (P3383), image (P18), cover art (P6802) or logo (P154), in that order. */
export function wikidataImage(claims?: WikidataClaims): string | undefined {
  for (const prop of ['P3383', 'P18', 'P6802', 'P154']) {
    const v = claimValue(claims, prop);
    if (typeof v === 'string' && v) return commonsImage(v);
  }
  return undefined;
}

export function parseWikidataEntities(json: unknown, hits: WikidataSearchHit[], category: CategoryId): CatalogResult[] {
  const entities = (json as { entities?: Record<string, { claims?: WikidataClaims }> })?.entities ?? {};
  return hits.map((h) => {
    const claims = entities[h.id]?.claims;
    const date = claimValue(claims, 'P577') as { time?: string } | undefined;
    const iso = date?.time?.replace(/^\+/, '');
    return {
      key: `wd:${h.id}`,
      category,
      title: h.label!,
      year: yearOf(iso) ?? yearOf(h.description),
      coverUrl: wikidataImage(claims),
      source: { provider: 'wikidata' as const, id: h.id },
    };
  });
}

// ------------------------------------------------------------------ Merge
/** Keep the first occurrence of each work (normalized title + first word of the creator). */
export function mergeResults(lists: CatalogResult[][], limit: number = CATALOG.perCategory): CatalogResult[] {
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
const LIMIT = CATALOG.perSource;
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

const imdb = (category: 'movies' | 'series' | 'videogames'): Provider =>
  safe(async (q, { f, signal }) => {
    const first = q.toLocaleLowerCase().match(/[a-z0-9]/)?.[0] ?? 'x';
    return parseImdb(await f(`https://v3.sg.media-imdb.com/suggestion/${first}/${enc(q.toLocaleLowerCase())}.json`, signal), category);
  });

const jikan = (category: 'movies' | 'series' | 'books'): Provider =>
  safe(async (q, { f, signal }) =>
    parseJikan(await f(`https://api.jikan.moe/v4/${category === 'books' ? 'manga' : 'anime'}?q=${enc(q)}&limit=${LIMIT}&sfw=true`, signal), category),
  );

const wikidata = (category: CategoryId): Provider =>
  safe(async (q, { lang, f, signal }) => {
    const base = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
    const hits = parseWikidataSearch(
      await f(`${base}&action=wbsearchentities&search=${enc(q)}&language=${lang}&uselang=${lang}&type=item&limit=20`, signal),
      category,
    ).slice(0, 6);
    if (!hits.length) return [];
    const ids = hits.map((h) => h.id).join('|');
    return parseWikidataEntities(await f(`${base}&action=wbgetentities&ids=${ids}&props=claims`, signal), hits, category);
  });

const bgg: Provider = safe(async (q, { f, signal }) => {
  const games = parseBggSearch(
    await f(`https://boardgamegeek.com/search/boardgame?nosession=1&showcount=${LIMIT}&q=${enc(q)}`, signal),
  );
  // Artwork for the first few, in parallel; a missing image never drops the game.
  await Promise.all(
    games.slice(0, 6).map(async (g) => {
      try {
        g.coverUrl = parseBggImage(await f(`https://api.geekdo.com/api/geekitems?objecttype=thing&objectid=${g.source.id}`, signal));
      } catch {
        // keep the game without artwork
      }
    }),
  );
  return games;
});

const tvmaze: Provider = safe(async (q, { f, signal }) => parseTvmaze(await f(`https://api.tvmaze.com/search/shows?q=${enc(q)}`, signal)));
const deezer: Provider = safe(async (q, { f, signal }) =>
  parseDeezer(await f(`https://api.deezer.com/search/album?q=${enc(q)}&limit=${LIMIT}`, signal)),
);
const musicbrainz: Provider = safe(async (q, { f, signal }) =>
  parseMusicBrainz(await f(`https://musicbrainz.org/ws/2/release-group?query=${enc(q)}&fmt=json&limit=${LIMIT}`, signal)),
);
const googlebooks: Provider = safe(async (q, { lang, f, signal }) =>
  parseGoogleBooks(await f(`https://www.googleapis.com/books/v1/volumes?q=${enc(q)}&maxResults=${LIMIT}&printType=books&langRestrict=${lang}`, signal)),
);
const openlibrary: Provider = safe(async (q, { f, signal }) =>
  parseOpenLibrary(
    await f(`https://openlibrary.org/search.json?q=${enc(q)}&limit=${LIMIT}&fields=key,title,author_name,first_publish_year,cover_i`, signal),
  ),
);
const applebooks: Provider = safe(async (q, { country, f, signal }) =>
  parseItunesBooks(await f(`https://itunes.apple.com/search?term=${enc(q)}&media=ebook&limit=${LIMIT}&country=${country}`, signal)),
);
const gutendex: Provider = safe(async (q, { f, signal }) => parseGutendex(await f(`https://gutendex.com/books/?search=${enc(q)}`, signal)));
const steam: Provider = safe(async (q, { lang, f, signal }) =>
  parseSteam(
    await f(`https://store.steampowered.com/api/storesearch/?term=${enc(q)}&l=${lang === 'fr' ? 'french' : 'english'}&cc=${lang === 'fr' ? 'FR' : 'US'}`, signal),
  ),
);
const gog: Provider = safe(async (q, { f, signal }) =>
  parseGog(await f(`https://catalog.gog.com/v1/catalog?limit=${LIMIT}&query=like:${enc(q)}&order=desc:score&productType=in:game,pack`, signal)),
);

const WIKI_HINTS: Record<CategoryId, { en: string; fr: string }> = {
  movies: { en: 'film', fr: 'film' },
  series: { en: 'television series', fr: 'série télévisée' },
  music: { en: 'album', fr: 'album' },
  books: { en: 'novel', fr: 'roman' },
  videogames: { en: 'video game', fr: 'jeu vidéo' },
  boardgames: { en: 'board game', fr: 'jeu de société' },
};

/** Each source for a given collection, or undefined where a source has nothing for it. */
function sourceFor(id: SourceId, category: CategoryId): Provider | undefined {
  switch (id) {
    case 'itunes':
      return category === 'movies'
        ? itunes('movies', 'media=movie&entity=movie')
        : category === 'series'
          ? itunes('series', 'media=tvShow&entity=tvSeason')
          : category === 'music'
            ? itunes('music', 'media=music&entity=album')
            : undefined;
    case 'imdb':
      return category === 'movies' || category === 'series' || category === 'videogames' ? imdb(category) : undefined;
    case 'jikan':
      return category === 'movies' || category === 'series' || category === 'books' ? jikan(category) : undefined;
    case 'wikidata':
      return wikidata(category);
    case 'wikipedia':
      return wiki(category, WIKI_HINTS[category]);
    case 'tvmaze':
      return category === 'series' ? tvmaze : undefined;
    case 'deezer':
      return category === 'music' ? deezer : undefined;
    case 'musicbrainz':
      return category === 'music' ? musicbrainz : undefined;
    case 'googlebooks':
      return category === 'books' ? googlebooks : undefined;
    case 'openlibrary':
      return category === 'books' ? openlibrary : undefined;
    case 'applebooks':
      return category === 'books' ? applebooks : undefined;
    case 'gutendex':
      return category === 'books' ? gutendex : undefined;
    case 'steam':
      return category === 'videogames' ? steam : undefined;
    case 'gog':
      return category === 'videogames' ? gog : undefined;
    case 'bgg':
      return category === 'boardgames' ? bgg : undefined;
  }
}

export const PROVIDERS = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATALOG_SOURCES[c].map((id) => sourceFor(id, c)).filter((p): p is Provider => !!p)]),
) as Record<CategoryId, Provider[]>;

// ------------------------------------------------------------------ Shared requests
const CACHE_TTL = CATALOG.cacheTtl;
const responseCache = new Map<string, { at: number; value: Promise<unknown> }>();

/**
 * Requests are cached briefly by URL, so the same call made by several categories (the
 * "All" search) or by a retyped query goes out once. Failures are not kept. Aborting one
 * caller never cancels a request another caller is still waiting on.
 */
function sharedFetch(f: Fetcher): Fetcher {
  return (url, signal) => {
    const now = Date.now();
    let hit = responseCache.get(url);
    if (!hit || now - hit.at > CACHE_TTL) {
      const value = f(url);
      value.catch(() => responseCache.delete(url));
      hit = { at: now, value };
      responseCache.set(url, hit);
      if (responseCache.size > 200) responseCache.delete(responseCache.keys().next().value!);
    }
    if (!signal) return hit.value;
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'));
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      hit!.value.then(resolve, reject);
    });
  };
}

export async function searchCategory(
  category: CategoryId,
  query: string,
  opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher; limit?: number } = { lang: 'en' },
): Promise<CatalogResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const lang = opts.lang.startsWith('fr') ? 'fr' : 'en';
  const ctx = { lang, country: lang === 'fr' ? 'FR' : 'US', f: opts.fetcher ?? sharedFetch(defaultFetch), signal: opts.signal } as const;
  const lists = await Promise.all(PROVIDERS[category].map((p) => p(q, ctx)));
  return mergeResults(lists, opts.limit);
}

/** Every category at once, a few results each, for the "All" search. */
export async function searchAll(query: string, opts: { lang: string; signal?: AbortSignal; fetcher?: Fetcher }) {
  const groups = await Promise.all(CATEGORIES.map((c) => searchCategory(c, query, { ...opts, limit: CATALOG.perCategoryInAll })));
  return CATEGORIES.map((c, i) => ({ category: c, results: groups[i] })).filter((g) => g.results.length);
}

// ------------------------------------------------------------------ Covers
/** Best artwork match for a title: same normalized title first, then a creator match. */
export function pickCover(results: CatalogResult[], title: string, creator?: string): string | undefined {
  const t = strip(title);
  const c = strip(creator ?? '').split(' ')[0];
  const withCover = results.filter((r) => r.coverUrl);
  const exact = withCover.filter((r) => strip(r.title) === t);
  const close = exact.length ? exact : withCover.filter((r) => strip(r.title).startsWith(t) || t.startsWith(strip(r.title)));
  const best = (c && close.find((r) => strip(r.creator ?? '').includes(c))) || close[0];
  return best?.coverUrl;
}

/** Every distinct artwork found for a title, best matches first (for choosing a cover by hand). */
export function rankCovers(results: CatalogResult[], title: string): string[] {
  const t = strip(title);
  const score = (r: CatalogResult) => {
    const rt = strip(r.title);
    return rt === t ? 0 : rt.startsWith(t) || t.startsWith(rt) ? 1 : 2;
  };
  const urls = results
    .filter((r) => r.coverUrl)
    .map((r, i) => ({ url: r.coverUrl!, s: score(r), i }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((r) => r.url);
  return [...new Set(urls)];
}

export async function findCoverCandidates(category: CategoryId, title: string, opts: { lang: string; fetcher?: Fetcher } = { lang: 'en' }) {
  return rankCovers(await searchCategory(category, title, { ...opts, limit: 30 }), title).slice(0, 16);
}

/** Look up artwork for an object that has none (added by hand, or from a source without images). */
export async function findCover(
  category: CategoryId,
  title: string,
  creator?: string,
  opts: { lang: string; fetcher?: Fetcher } = { lang: 'en' },
): Promise<string | undefined> {
  const results = await searchCategory(category, title, { ...opts, limit: 30 });
  return pickCover(results, title, creator);
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
