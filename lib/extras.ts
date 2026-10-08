/**
 * What a book or game page shows beyond the basics, from free keyless sources: scores, facts,
 * people, screenshots, links and rails of related titles (same author, developer or publisher,
 * adaptations, what it is based on). Each source fills its part as soon as it answers.
 *
 * Wikidata gives the facts every page shares (awards, characters, settings, publisher, engine…)
 * and the adaptations, in both directions: the films and series made from a book, the book a
 * game is based on.
 */
import { imdbTitle } from './api';
import { persisted } from './cache';
import { isbnCover, steamCover } from './covers';
import { BOOK_TYPES, GAME_TYPES, seriesHref } from './series';
import { Entity, cachedLabels, claimIds, claimValues, entity, sparql } from './wikidata';
import type { MediaKind } from './types';

export const DAY = 86_400_000;

/** A big number with what it counts: "4.4 ★ · 119 ratings", "97 % · Very positive". */
export interface Score {
  /** i18n key under `extras.score.` for the caption. */
  key: string;
  value: string;
  /** Interpolated into the caption. */
  params?: Record<string, string | number>;
  url?: string;
  tone?: 'good' | 'mixed' | 'bad';
}

/** A labelled line: "Publisher — Gallimard". */
export interface Fact {
  /** i18n key under `extras.fact.`. */
  key: string;
  value: string;
}

/** Named chips: awards, characters, places, Steam features. */
export interface TagGroup {
  /** i18n key under `extras.tags.`. */
  key: string;
  items: string[];
}

export interface ExtraLink {
  label: string;
  url: string;
  icon?: 'globe' | 'play' | 'star' | 'clock' | 'library' | 'link';
}

export interface Person {
  name: string;
  /** Lifespan or role. */
  role?: string;
  image?: string;
}

export interface ExtraItem {
  key: string;
  href: string;
  title: string;
  poster?: string;
  kind: MediaKind;
  caption?: string;
}

export interface ExtraRail {
  /** Also the order rails come in (see RAIL_ORDER). */
  key: string;
  /** i18n key under `extras.rail.` with its parameters ("More by {{name}}"). */
  title: string;
  params?: Record<string, string>;
  items: ExtraItem[];
}

export interface ShelfExtras {
  scores?: Score[];
  facts?: Fact[];
  tags?: TagGroup[];
  links?: ExtraLink[];
  people?: Person[];
  screenshots?: { thumb: string; full: string }[];
  rails?: ExtraRail[];
  /** Entries of the series from Open Library, for books Wikidata doesn't place in one. */
  series?: { name: string; items: ExtraItem[] };
}

/** Rails sorted this way whatever answers first. */
export const RAIL_ORDER = ['author', 'developer', 'adaptations', 'basedOn', 'publisher', 'similar'];

/** Parts merge: lists from different sources add up, rails replace by key. */
export function mergeExtras(prev: ShelfExtras, patch: ShelfExtras): ShelfExtras {
  const next: ShelfExtras = { ...prev, ...patch };
  for (const k of ['scores', 'facts', 'tags', 'links', 'screenshots'] as const) {
    if (prev[k] && patch[k]) (next as any)[k] = [...(prev[k] as any[]), ...(patch[k] as any[])];
  }
  if (prev.facts && patch.facts) next.facts = uniqueBy([...prev.facts, ...patch.facts], (f) => f.key);
  if (prev.links && patch.links) next.links = uniqueBy([...prev.links, ...patch.links], (l) => l.label);
  if (prev.tags && patch.tags) next.tags = uniqueBy([...prev.tags, ...patch.tags], (g) => g.key);
  if (prev.people && patch.people) next.people = uniqueBy([...prev.people, ...patch.people], (p) => p.name);
  if (prev.rails || patch.rails) {
    const rails = new Map((prev.rails ?? []).map((r) => [r.key, r]));
    for (const r of patch.rails ?? []) if (r.items.length) rails.set(r.key, r);
    next.rails = [...rails.values()].sort((a, b) => RAIL_ORDER.indexOf(a.key) - RAIL_ORDER.indexOf(b.key));
  }
  return next;
}

export function uniqueBy<T>(list: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = key(x).toLocaleLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Rail entries no other rail on the page has yet (a sequel also by the same author shows once). */
export function dropSeen(items: ExtraItem[], seen: Set<string>) {
  return items.filter((i) => !seen.has(i.key) && !seen.has(i.href));
}

// ------------------------------------------------------------------ Wikidata facts
const BOOK_FACTS = { P123: 'publisher', P407: 'language', P1433: 'publishedIn', P110: 'illustrator', P655: 'translator' } as const;
const GAME_FACTS = { P123: 'publisher', P408: 'engine', P404: 'modes', P57: 'director', P86: 'composer', P162: 'producer', P50: 'writer', P8345: 'franchise', P852: 'esrb', P908: 'pegi' } as const;
const BOOK_TAGS = { P166: 'awards', P674: 'characters', P840: 'places', P921: 'subjects', P135: 'movement' } as const;
const GAME_TAGS = { P166: 'awards', P674: 'characters', P840: 'places' } as const;

/** Facts and chips from the item's own statements: one call for every label. */
export async function wikidataFacts(qid: string, kind: 'book' | 'game', lang: string): Promise<ShelfExtras> {
  const e = await entity(qid, lang);
  if (!e) return {};
  const factProps = kind === 'book' ? BOOK_FACTS : GAME_FACTS;
  const tagProps = kind === 'book' ? BOOK_TAGS : GAME_TAGS;
  const ids = (p: string, n: number) => claimIds(e.claims, p).slice(0, n);
  const wanted = [...Object.keys(factProps).flatMap((p) => ids(p, 3)), ...Object.keys(tagProps).flatMap((p) => ids(p, 12))];
  const names = await cachedLabels(wanted, lang);
  const named = (p: string, n: number) => ids(p, n).map((id) => names[id]).filter(Boolean);
  const facts: Fact[] = Object.entries(factProps)
    .map(([p, key]) => ({ key, value: named(p, 3).join(', ') }))
    .filter((f) => f.value);
  const tags: TagGroup[] = Object.entries(tagProps)
    .map(([p, key]) => ({ key, items: named(p, 12) }))
    .filter((g) => g.items.length);
  return { facts, tags, links: wikiLinks(e, lang) };
}

/** Wikipedia in your language, else English. */
function wikiLinks(e: Entity, lang: string): ExtraLink[] {
  const site = e.sitelinks[`${lang}wiki`] ? lang : e.sitelinks.enwiki ? 'en' : undefined;
  if (!site) return [];
  const title = e.sitelinks[`${site}wiki`].title.replace(/ /g, '_');
  return [{ label: 'Wikipedia', url: `https://${site}.wikipedia.org/wiki/${encodeURIComponent(title)}`, icon: 'globe' }];
}

/** Pages a number from a Wikidata quantity ("+352"). */
export const amountOf = (claims: Entity['claims'], prop: string) => {
  const n = Number(claimValues(claims, prop)[0]?.amount);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// ------------------------------------------------------------------ Wikidata: adaptations and sources
/** Films, TV films; TV, web, animated and anime series, miniseries. */
const FILM_TYPES = ['Q11424', 'Q24869', 'Q29168811', 'Q202866', 'Q506240'];
const SERIES_TYPES = ['Q5398426', 'Q1259759', 'Q526877', 'Q117467246', 'Q63952888', 'Q581714', 'Q15416'];

function adaptationsQuery(qid: string, lang: string, developerGames: boolean) {
  // The planner is told to keep this order: start from the item, never from "every film".
  return `SELECT ?rel ?item ?itemLabel ?type ?date ?imdb ?steam ?ol ?isbn WHERE {
  { ?item wdt:P144 wd:${qid} . BIND("adaptations" AS ?rel) }
  UNION { wd:${qid} wdt:P4969 ?item . BIND("adaptations" AS ?rel) }
  UNION { wd:${qid} wdt:P144 ?item . BIND("basedOn" AS ?rel) }
  UNION { ?item wdt:P4969 wd:${qid} . BIND("basedOn" AS ?rel) }
  ${
    developerGames
      ? `UNION { { SELECT ?item WHERE { wd:${qid} wdt:P178 ?dev . ?item wdt:P178 ?dev . } LIMIT 60 } BIND("developer" AS ?rel) }`
      : ''
  }
  hint:Query hint:optimizer "None" .
  FILTER(?item != wd:${qid})
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P577 ?date }
  OPTIONAL { ?item wdt:P345 ?imdb }
  OPTIONAL { ?item wdt:P1733 ?steam }
  OPTIONAL { ?item wdt:P648 ?ol }
  OPTIONAL { ?item wdt:P212 ?isbn }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT 400`;
}

interface Linked {
  qid: string;
  rel: string;
  title: string;
  kind?: MediaKind;
  year?: number;
  imdb?: string;
  steam?: string;
  ol?: string;
  isbn?: string;
}

const last = (uri?: string) => String(uri ?? '').split('/').pop() ?? '';

/** What the app can open it as: films and series need an IMDb id, books and games their type. */
function kindOf(type: string, w: Pick<Linked, 'imdb' | 'steam' | 'ol'>): MediaKind | undefined {
  if (w.imdb && SERIES_TYPES.includes(type)) return 'show';
  if (w.imdb && FILM_TYPES.includes(type)) return 'movie';
  if (w.steam || GAME_TYPES.includes(type)) return 'game';
  if (w.ol || BOOK_TYPES.includes(type)) return 'book';
  return undefined;
}

async function linkedWorks(qid: string, lang: string, developerGames: boolean): Promise<Linked[]> {
  const json = await sparql(adaptationsQuery(qid, lang, developerGames));
  // An item comes once per type and date: keep its earliest year and any kind we can open.
  const found = new Map<string, Linked>();
  for (const b of json?.results?.bindings ?? []) {
    const id = last(b.item?.value);
    const title: string | undefined = b.itemLabel?.value;
    if (!/^Q\d+$/.test(id) || !title || /^Q\d+$/.test(title)) continue;
    const key = `${b.rel?.value}${id}`;
    const w: Linked = found.get(key) ?? {
      qid: id,
      rel: b.rel?.value,
      title,
      imdb: /^tt\d+$/.test(b.imdb?.value ?? '') ? b.imdb.value : undefined,
      steam: /^\d+$/.test(b.steam?.value ?? '') ? b.steam.value : undefined,
      ol: /^OL\d+W$/.test(b.ol?.value ?? '') ? b.ol.value : undefined,
      isbn: b.isbn?.value?.replace(/-/g, ''),
    };
    w.kind ??= kindOf(last(b.type?.value), w);
    const year = Number(String(b.date?.value ?? '').slice(0, 4)) || undefined;
    if (year && (!w.year || year < w.year)) w.year = year;
    found.set(key, w);
  }
  return [...found.values()].filter((w) => w.kind);
}

/** Route inside the app for anything Wikidata links to. */
function hrefOf(w: Linked) {
  if (w.kind === 'movie') return `/movie/imdb-${w.imdb}`;
  if (w.kind === 'show') return `/show/imdb:${w.imdb}`;
  return seriesHref(w.kind as 'book' | 'game', w.qid, w.ol, w.steam);
}

/**
 * Adaptations and sources (any kind of work) and, for games Steam can't list, more by the same
 * developer. Posters for films and series come from IMDb.
 */
export async function wikidataRails(qid: string, kind: 'book' | 'game', lang: string, developerGames: boolean): Promise<ExtraRail[]> {
  const works = await persisted(`linked:${qid}:${lang}:${developerGames}`, 3 * DAY, () => linkedWorks(qid, lang, developerGames), (v) => !v.length);
  const items = await Promise.all(
    works.slice(0, 60).map(async (w, i): Promise<ExtraItem & { rel: string; year?: number }> => {
      const poster =
        w.kind === 'game' && w.steam
          ? steamCover(w.steam)
          : w.kind === 'book'
            ? isbnCover(w.isbn, 'M')
            : w.imdb && i < 24
              ? (await persisted(`imdb:${w.imdb}`, 30 * DAY, async () => (await imdbTitle(w.imdb!))?.poster ?? '', (v) => !v)) || undefined
              : undefined;
      return { key: w.qid, href: hrefOf(w), title: w.title, poster, kind: w.kind!, caption: w.year ? String(w.year) : undefined, rel: w.rel, year: w.year };
    }),
  );
  const oldest = (a: { year?: number }, b: { year?: number }) => (a.year ?? 9999) - (b.year ?? 9999);
  const newest = (a: { year?: number }, b: { year?: number }) => (b.year ?? 0) - (a.year ?? 0);
  const pick = (rel: string, sort: typeof oldest) => items.filter((i) => i.rel === rel).sort(sort).map(({ rel: _, year: __, ...item }) => item);
  return [
    { key: 'adaptations', title: kind === 'book' ? 'adaptations' : 'gameAdaptations', items: pick('adaptations', oldest) },
    { key: 'basedOn', title: 'basedOn', items: pick('basedOn', oldest) },
    { key: 'developer', title: 'developerAll', items: pick('developer', newest).filter((i) => i.kind === 'game') },
  ].filter((r) => r.items.length);
}
