/**
 * Video games, keyless: the Steam store (search, covers, release dates, descriptions) and
 * Wikidata for everything else: console exclusives, exact dates, platforms and series.
 */
import { SearchResult, getJson, norm, quiet, stripHtml } from './api';
import { Game, GameSource } from './types';
import { claimIds, claimString, commonsImage, entity, labels, looseDate, qidBy, releaseOf, seriesClaim, wikiSummary } from './wikidata';

export type GameMeta = Omit<Game, 'hours' | 'percent' | 'touchedAt' | 'startedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'addedAt'>;

const STORE = 'https://store.steampowered.com/api';
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const enc = encodeURIComponent;
const steamLang = (lang: string) => (lang === 'fr' ? 'french' : 'english');
const steamCountry = (lang: string) => (lang === 'fr' ? 'FR' : 'US');
/** Steam's 2:3 library capsule. */
export const steamCover = (appId: string | number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

export function parseGameId(id: string): { source: GameSource; sourceId: string } | undefined {
  const m = id.match(/^(steam|wd)-(.+)$/);
  return m ? { source: m[1] as GameSource, sourceId: m[2] } : undefined;
}

// ------------------------------------------------------------------ Search
interface SteamItem {
  id?: number;
  name?: string;
  type?: string | number;
}

const steamResult = (i: SteamItem): SearchResult => ({ kind: 'game', id: `steam-${i.id}`, title: i.name!, poster: steamCover(i.id!) });

/** Video games among Wikidata's matches for a title, with their Steam id when they have one. */
async function wikidataGames(q: string, lang: string) {
  const r = await getJson<any>(`${WD}&action=wbsearchentities&search=${enc(q)}&language=${lang}&uselang=${lang}&type=item&limit=25`);
  const hits: { id: string; label: string; description?: string }[] = (r?.search ?? []).filter((h: any) => /video ?game|jeu vidéo/i.test(h?.description ?? '')).slice(0, 12);
  if (!hits.length) return [];
  const ents = await quiet(getJson<any>(`${WD}&action=wbgetentities&ids=${hits.map((h) => h.id).join('|')}&props=claims`), null);
  return hits.map((h) => {
    const claims = ents?.entities?.[h.id]?.claims ?? {};
    const release = releaseOf(claims);
    return { id: h.id, title: h.label, steamId: claimString(claims, 'P1733'), year: release.year, releaseDate: release.date, image: claimString(claims, 'P18') };
  });
}

export async function searchGames(q: string, lang: string): Promise<SearchResult[]> {
  const [steam, wd] = await Promise.all([
    quiet(getJson<{ items?: SteamItem[] }>(`${STORE}/storesearch/?term=${enc(q)}&l=${steamLang(lang)}&cc=${steamCountry(lang)}`), { items: [] }),
    quiet(wikidataGames(q, lang), []),
  ]);
  const out = (steam.items ?? []).filter((i) => i.id && i.name && (i.type == null || i.type === 'app')).map(steamResult);
  for (const w of wd) {
    const twin = out.find((o) => (w.steamId && o.id === `steam-${w.steamId}`) || norm(o.title) === norm(w.title));
    if (twin) {
      twin.year ??= w.year;
      twin.releaseDate ??= w.releaseDate;
    } else
      out.push({
        kind: 'game',
        id: w.steamId ? `steam-${w.steamId}` : `wd-${w.id}`,
        title: w.title,
        year: w.year,
        releaseDate: w.releaseDate,
        poster: w.steamId ? steamCover(w.steamId) : commonsImage(w.image, 300),
      });
  }
  return out.slice(0, 24);
}

/** Top sellers and the most awaited games on Steam. */
export async function popularGames(lang: string): Promise<{ top: SearchResult[]; soon: SearchResult[] }> {
  const r = await quiet(getJson<any>(`${STORE}/featuredcategories?l=${steamLang(lang)}&cc=${steamCountry(lang)}`), null);
  const pick = (items?: SteamItem[]) => {
    const seen = new Set<number>();
    return (items ?? []).filter((i) => i.id && i.name && !seen.has(i.id) && seen.add(i.id) && !/steam deck|soundtrack/i.test(i.name)).slice(0, 16).map(steamResult);
  };
  return { top: pick(r?.top_sellers?.items), soon: pick(r?.coming_soon?.items) };
}

// ------------------------------------------------------------------ Details
export interface GameDetails {
  game: GameMeta;
  /** A Wikidata entry with a Steam page opens there instead. */
  redirect?: string;
}

interface SteamApp {
  name?: string;
  short_description?: string;
  header_image?: string;
  developers?: string[];
  genres?: { description?: string }[];
  release_date?: { coming_soon?: boolean; date?: string };
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
}

/** Platforms, genres, developer and series from Wikidata. */
async function wikidataBits(qid: string | undefined, lang: string) {
  if (!qid) return undefined;
  const e = await quiet(entity(qid, lang), undefined);
  if (!e) return undefined;
  const series = seriesClaim(e.claims);
  const platformIds = claimIds(e.claims, 'P400').slice(0, 8);
  const genreIds = claimIds(e.claims, 'P136').slice(0, 4);
  const devIds = claimIds(e.claims, 'P178').slice(0, 2);
  const names = await labels([...platformIds, ...genreIds, ...devIds, ...(series ? [series.id] : [])], lang);
  return {
    entity: e,
    release: releaseOf(e.claims),
    platforms: platformIds.map((p) => names[p]).filter(Boolean),
    genres: genreIds.map((g) => names[g]).filter(Boolean),
    developer: devIds.map((d) => names[d]).filter(Boolean).join(', ') || undefined,
    series: series && names[series.id] ? { name: names[series.id], ordinal: series.ordinal } : undefined,
    image: claimString(e.claims, 'P18'),
  };
}

export async function fetchGame(id: string, lang: string): Promise<GameDetails> {
  const parsed = parseGameId(id);
  if (!parsed) throw new Error('Unknown game');
  const { source, sourceId } = parsed;
  const base = { id, source, sourceId, syncedAt: Date.now() };

  if (source === 'steam') {
    const [json, qid] = await Promise.all([
      getJson<Record<string, { success?: boolean; data?: SteamApp }>>(`${STORE}/appdetails?appids=${sourceId}&l=${steamLang(lang)}&cc=${steamCountry(lang)}`),
      qidBy('P1733', sourceId),
    ]);
    const app = json?.[sourceId]?.data;
    if (!json?.[sourceId]?.success || !app?.name) throw new Error('Not found');
    const wiki = await wikidataBits(qid, lang);
    const steamDate = looseDate(app.release_date?.date);
    const os = app.platforms ? (['windows', 'mac', 'linux'] as const).filter((p) => app.platforms![p]).map((p) => ({ windows: 'PC', mac: 'Mac', linux: 'Linux' })[p]) : [];
    // Steam is the store's own date; Wikidata fills it while Steam says "Coming soon".
    const releaseDate = steamDate.date ?? wiki?.release.date;
    return {
      game: {
        ...base,
        title: app.name,
        cover: steamCover(sourceId),
        backdrop: app.header_image,
        year: steamDate.year ?? wiki?.release.year,
        releaseDate,
        developer: app.developers?.slice(0, 2).join(', ') ?? wiki?.developer,
        platforms: wiki?.platforms.length ? wiki.platforms : os,
        genres: (app.genres ?? []).map((g) => g.description).filter((g): g is string => !!g).slice(0, 4),
        overview: stripHtml(app.short_description) ?? (wiki ? await wikiSummary(wiki.entity, lang) : undefined),
        steamId: sourceId,
        wikidataId: qid,
        series: wiki?.series,
      },
    };
  }

  const wiki = await wikidataBits(sourceId, lang);
  if (!wiki) throw new Error('Not found');
  const steamId = claimString(wiki.entity.claims, 'P1733');
  if (steamId && /^\d+$/.test(steamId)) return { redirect: `steam-${steamId}`, game: { ...base, title: wiki.entity.label ?? sourceId, platforms: [], genres: [] } };
  return {
    game: {
      ...base,
      title: wiki.entity.label ?? sourceId,
      cover: commonsImage(wiki.image),
      year: wiki.release.year,
      releaseDate: wiki.release.date,
      developer: wiki.developer,
      platforms: wiki.platforms,
      genres: wiki.genres,
      overview: (await wikiSummary(wiki.entity, lang)) ?? wiki.entity.description,
      wikidataId: sourceId,
      series: wiki.series,
    },
  };
}

export function gamePage(g: Pick<Game, 'steamId' | 'sourceId' | 'wikidataId'>) {
  if (g.steamId) return `https://store.steampowered.com/app/${g.steamId}/`;
  return `https://www.wikidata.org/wiki/${g.wikidataId ?? g.sourceId}`;
}
