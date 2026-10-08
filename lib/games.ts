/**
 * Video games, keyless: the Steam store (search, covers, release dates, descriptions) and
 * Wikidata for everything else: console exclusives, exact dates, platforms and series.
 */
import { SearchResult, getJson, norm, quiet, stripHtml, youtubeSearch } from './api';
import { persisted } from './cache';
import { steamCover } from './covers';
import { DAY, ExtraItem, ExtraLink, Fact, Score, ShelfExtras, wikidataFacts, wikidataRails } from './extras';
import { compact } from './format';
import { Game, GameSource } from './types';
import { cachedLabels, claimIds, claimString, commonsImage, entity, looseDate, qidBy, releaseOf, seriesClaim, wikiSummary } from './wikidata';

export type GameMeta = Omit<Game, 'hours' | 'percent' | 'touchedAt' | 'startedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'addedAt'>;

const STORE = 'https://store.steampowered.com/api';
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const enc = encodeURIComponent;
const steamLang = (lang: string) => (lang === 'fr' ? 'french' : 'english');
const steamCountry = (lang: string) => (lang === 'fr' ? 'FR' : 'US');

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
  const names = await cachedLabels([...platformIds, ...genreIds, ...devIds, ...(series ? [series.id] : [])], lang);
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

// ------------------------------------------------------------------ Extras
interface SteamAppFull extends SteamApp {
  publishers?: string[];
  is_free?: boolean;
  metacritic?: { score?: number; url?: string };
  recommendations?: { total?: number };
  categories?: { id?: number; description?: string }[];
  screenshots?: { path_thumbnail?: string; path_full?: string }[];
  price_overview?: { final_formatted?: string; discount_percent?: number; initial_formatted?: string };
  achievements?: { total?: number };
  controller_support?: string;
  required_age?: number | string;
  website?: string | null;
  dlc?: number[];
}

interface SteamReviews {
  query_summary?: { review_score?: number; review_score_desc?: string; total_positive?: number; total_reviews?: number };
}

/** CheapShark asks every client to name itself. */
const CHEAPSHARK_HEADERS = { 'User-Agent': 'PalaisMental/1.4 (https://github.com/corentin-ne/palais-mental)' };

/** Steam's review summary, scored 1 (overwhelmingly negative) to 9 (overwhelmingly positive). */
const REVIEW_KEYS = ['', 'overwhelminglyNegative', 'veryNegative', 'negative', 'mostlyNegative', 'mixed', 'mostlyPositive', 'positive', 'veryPositive', 'overwhelminglyPositive'];

/** Games a developer or publisher has on Steam, best sellers first; DLCs and soundtracks left out. */
async function steamBy(role: 'developer' | 'publisher', name: string, exclude: string, lang: string): Promise<ExtraItem[]> {
  const r = await getJson<{ items?: { name?: string; logo?: string }[] }>(
    `https://store.steampowered.com/search/results/?json=1&${role}=${enc(name)}&category1=998&cc=${steamCountry(lang)}&l=${steamLang(lang)}`,
  );
  const seen = new Set<string>();
  const out: ExtraItem[] = [];
  for (const i of r.items ?? []) {
    const app = i.logo?.match(/\/apps\/(\d+)\//)?.[1];
    if (!app || !i.name || app === exclude || /soundtrack|\bost\b|artbook|demo$|playtest|\bbundle\b|anthology|collection/i.test(i.name)) continue;
    const key = norm(i.name).replace(/ (definitive|enhanced|complete|goty|game of the year|remastered|deluxe|ultimate|gold) edition$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key: `steam-${app}`, href: `/game/steam-${app}`, title: i.name, poster: steamCover(app), kind: 'game' });
  }
  return out.slice(0, 18);
}

/** What the store page says beyond the basics: scores, price, features, screenshots, links. */
function steamPart(app: SteamAppFull, appId: string, lang: string): ShelfExtras {
  const scores: Score[] = [];
  if (app.metacritic?.score)
    scores.push({ key: 'metacritic', value: String(app.metacritic.score), url: app.metacritic.url, tone: app.metacritic.score >= 75 ? 'good' : app.metacritic.score >= 50 ? 'mixed' : 'bad' });
  if (app.is_free) scores.push({ key: 'free', value: lang === 'fr' ? 'Gratuit' : 'Free', url: `https://store.steampowered.com/app/${appId}/`, tone: 'good' });
  else if (app.price_overview?.final_formatted)
    scores.push({
      key: app.price_overview.discount_percent ? 'sale' : 'price',
      value: app.price_overview.final_formatted,
      params: { discount: app.price_overview.discount_percent ?? 0, was: app.price_overview.initial_formatted ?? '' },
      url: `https://store.steampowered.com/app/${appId}/`,
      tone: app.price_overview.discount_percent ? 'good' : undefined,
    });
  const facts: Fact[] = [];
  const publishers = (app.publishers ?? []).filter(Boolean).slice(0, 2).join(', ');
  if (publishers) facts.push({ key: 'publisher', value: publishers });
  if (app.achievements?.total) facts.push({ key: 'achievements', value: String(app.achievements.total) });
  if (app.dlc?.length) facts.push({ key: 'dlc', value: String(app.dlc.length) });
  const age = Number(app.required_age);
  if (age > 0) facts.push({ key: 'age', value: `${age}+` });
  if (app.controller_support === 'full') facts.push({ key: 'controller', value: '✓' });
  const features = (app.categories ?? [])
    .map((c) => c.description)
    .filter((d): d is string => !!d && !/steam (trading cards|cloud|leaderboards)|stats|family sharing|remote play on (phone|tablet)|in-app|valve anti-cheat|includes level editor|captions/i.test(d))
    .slice(0, 10);
  const links: ExtraLink[] = [];
  if (app.website) links.push({ label: lang === 'fr' ? 'Site officiel' : 'Website', url: app.website, icon: 'link' });
  if (app.metacritic?.url) links.push({ label: 'Metacritic', url: app.metacritic.url, icon: 'star' });
  links.push({ label: 'SteamDB', url: `https://steamdb.info/app/${appId}/`, icon: 'globe' });
  return {
    scores,
    facts,
    tags: features.length ? [{ key: 'features', items: features }] : [],
    links,
    screenshots: (app.screenshots ?? [])
      .filter((s) => s.path_thumbnail && s.path_full)
      .slice(0, 12)
      .map((s) => ({ thumb: s.path_thumbnail!, full: s.path_full! })),
  };
}

/**
 * Everything around a game, part by part as each source answers: the Steam store (Metacritic,
 * price, features, screenshots), Steam reviews, ProtonDB (Linux and Steam Deck), CheapShark
 * (best price across stores), more from its developer and publisher, and Wikidata's facts,
 * awards and adaptations.
 */
export async function loadGameExtras(game: Pick<Game, 'title' | 'steamId' | 'wikidataId' | 'developer'>, lang: string, emit: (part: ShelfExtras) => void) {
  const long = 7 * DAY;
  const noItems = (v: ExtraItem[]) => !v.length;
  const parts: Promise<unknown>[] = [];
  const steam = game.steamId;
  emit({
    links: [
      { label: lang === 'fr' ? 'Bande-annonce' : 'Trailer', url: youtubeSearch(game.title), icon: 'play' },
      { label: 'HowLongToBeat', url: `https://howlongtobeat.com/?q=${enc(game.title)}`, icon: 'clock' },
    ],
  });

  if (game.wikidataId) {
    const qid = game.wikidataId;
    parts.push(quiet(persisted(`wdfacts:${qid}:${lang}`, 3 * DAY, () => wikidataFacts(qid, 'game', lang)), {}).then(emit));
    // Without a Steam page, Wikidata also lists the developer's other games (consoles included).
    parts.push(quiet(wikidataRails(qid, 'game', lang, !steam), []).then((rails) => emit({ rails })));
  }

  if (steam) {
    parts.push(
      quiet(getJson<Record<string, { data?: SteamAppFull }>>(`${STORE}/appdetails?appids=${steam}&l=${steamLang(lang)}&cc=${steamCountry(lang)}`), null).then((json) => {
        const app = json?.[steam]?.data;
        if (!app) return;
        emit(steamPart(app, steam, lang));
        const developer = app.developers?.[0];
        const publisher = app.publishers?.[0];
        const more: Promise<unknown>[] = [];
        if (developer)
          more.push(
            quiet(persisted(`steamdev:${developer}:${lang}`, long, () => steamBy('developer', developer, steam, lang), noItems), []).then((items) =>
              emit({ rails: [{ key: 'developer', title: 'developer', params: { name: developer }, items }] }),
            ),
          );
        if (publisher && publisher !== developer)
          more.push(
            quiet(persisted(`steampub:${publisher}:${lang}`, long, () => steamBy('publisher', publisher, steam, lang), noItems), []).then((items) =>
              emit({ rails: [{ key: 'publisher', title: 'publisher', params: { name: publisher }, items }] }),
            ),
          );
        return Promise.all(more);
      }),
    );
    parts.push(
      quiet(
        persisted(`steamreviews:${steam}`, DAY, () => getJson<SteamReviews>(`https://store.steampowered.com/appreviews/${steam}?json=1&language=all&purchase_type=all&num_per_page=0`)),
        {} as SteamReviews,
      ).then((r) => {
        const q = r.query_summary;
        if (!q?.total_reviews || !q.review_score) return;
        const pct = Math.round(((q.total_positive ?? 0) / q.total_reviews) * 100);
        emit({
          scores: [
            {
              key: `steam.${REVIEW_KEYS[q.review_score] || 'mixed'}`,
              value: `${pct} %`,
              params: { count: compact(q.total_reviews) },
              url: `https://store.steampowered.com/app/${steam}/#app_reviews_hash`,
              tone: q.review_score >= 7 ? 'good' : q.review_score >= 5 ? 'mixed' : 'bad',
            },
          ],
        });
      }),
    );
    parts.push(
      quiet(persisted(`protondb:${steam}`, long, () => getJson<{ tier?: string; total?: number }>(`https://www.protondb.com/api/v1/reports/summaries/${steam}.json`)), {} as { tier?: string; total?: number }).then((p) => {
        if (!p.tier || p.tier === 'pending') return;
        emit({
          scores: [
            {
              key: 'protondb',
              value: p.tier.charAt(0).toUpperCase() + p.tier.slice(1),
              params: { count: compact(p.total ?? 0) },
              url: `https://www.protondb.com/app/${steam}`,
              tone: /platinum|gold/.test(p.tier) ? 'good' : /silver|bronze/.test(p.tier) ? 'mixed' : 'bad',
            },
          ],
        });
      }),
    );
    parts.push(
      quiet(
        persisted(`cheapshark:${steam}`, 6 * 3_600_000, () => getJson<{ cheapest?: string; cheapestDealID?: string }[]>(`https://www.cheapshark.com/api/1.0/games?steamAppID=${steam}`, { headers: CHEAPSHARK_HEADERS })),
        [],
      ).then((list) => {
        const deal = Array.isArray(list) ? list[0] : undefined;
        if (!deal?.cheapest || !deal.cheapestDealID) return;
        emit({ scores: [{ key: 'bestPrice', value: `$${deal.cheapest}`, url: `https://www.cheapshark.com/redirect?dealID=${deal.cheapestDealID}` }] });
      }),
    );
  } else if (game.developer && !game.wikidataId) {
    const developer = game.developer.split(', ')[0];
    parts.push(
      quiet(persisted(`steamdev:${developer}:${lang}`, long, () => steamBy('developer', developer, '', lang), noItems), []).then((items) =>
        emit({ rails: [{ key: 'developer', title: 'developer', params: { name: developer }, items: items.filter((i) => norm(i.title) !== norm(game.title)) }] }),
      ),
    );
  }
  await Promise.all(parts);
}
