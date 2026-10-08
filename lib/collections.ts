/**
 * Films, books and games of the same series, kept together like a show's seasons: the series
 * Wikidata gives (Harry Potter, Dune, Dark Souls) or, when it has none, the title's own number
 * ("ONE PIECE 3", "Toy Story 2", "Tome 4"). The library shows a series as one poster; its page
 * lists every entry, the ones you don't have too, each with a tick.
 */
import i18n from '@/locales/i18n';
import { getJson, quiet } from './api';
import { olCover } from './covers';
import { SeriesEntry, SeriesKind, fetchSeries, fetchSeriesMembers } from './series';
import { sparql } from './wikidata';
import { persisted } from './cache';
import { Book, Game, Movie } from './types';
import { useLibrary } from '@/store/useLibrary';

export type CollectionItem = Movie | Book | Game;

export const seriesNorm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9À-￿]+/g, ' ')
    .trim();

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 };
const ROMAN: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const MARK = '(?:vol(?:ume)?|tome|t|book|livre|part|partie|chapter|chapitre|episode|n°|no|#)';
/** "Name 3", "Name, Vol. 3", "Name: Part Two", "Name - Tome 3", "Name II". */
const NUMBERED = new RegExp(`^(.+?)[\\s,:.\\-–—]+(${MARK}\\.?\\s*)?(\\d{1,3}|[ivx]{1,4}|[a-z]+)\\s*$`, 'i');

/** The series a title names on its own, and where it sits in it. */
export function titleSeries(title: string): { name: string; ordinal: number } | undefined {
  const m = title.trim().match(NUMBERED);
  if (!m) return undefined;
  const [, base, mark, num] = m;
  const word = num.toLowerCase();
  // A lone "I" or a spelled number only counts after "Part", "Tome"…
  const n = /^\d+$/.test(word) ? Number(word) : (ROMAN[word] ?? (mark ? (word === 'i' ? 1 : WORDS[word]) : undefined));
  // Years ("Blade Runner 2049") and long numbers are not positions.
  if (!n || n > 300 || !base.trim() || seriesNorm(base).length < 2) return undefined;
  return { name: base.trim(), ordinal: n };
}

/** The series an item belongs to: Wikidata's, else the one its title names. */
export function seriesOf(item: CollectionItem): { key: string; name: string; ordinal?: number; qid?: string } | undefined {
  if (item.series?.name) {
    const n = parseFloat(item.series.ordinal ?? '');
    return { key: seriesNorm(item.series.name), name: item.series.name, ordinal: Number.isFinite(n) ? n : undefined, qid: item.series.id };
  }
  const own = titleSeries(item.title);
  return own ? { key: seriesNorm(own.name), name: own.name, ordinal: own.ordinal } : undefined;
}

export interface Member<T extends CollectionItem = CollectionItem> {
  item: T;
  ordinal?: number;
}

export interface Collection<T extends CollectionItem = CollectionItem> {
  key: string;
  name: string;
  members: Member<T>[];
}

/** Poster or cover. */
export const artOf = (i: CollectionItem) => ('poster' in i ? (i as Movie).poster : (i as Book | Game).cover);

const dateOf = (i: CollectionItem) => i.releaseDate ?? (i.year ? Date.UTC(i.year, 0, 1) : undefined);
const byPlace = (a: { ordinal?: number; date?: number; title: string }, b: { ordinal?: number; date?: number; title: string }) =>
  a.ordinal != null && b.ordinal != null && a.ordinal !== b.ordinal ? a.ordinal - b.ordinal : (a.date ?? Infinity) - (b.date ?? Infinity) || a.title.localeCompare(b.title);

/** Two or more of the same series become one collection; everything else stays on its own. */
export function groupCollections<T extends CollectionItem>(items: T[]): { singles: T[]; groups: Collection<T>[] } {
  const found = new Map<string, Collection<T>>();
  const loose: T[] = [];
  for (const item of items) {
    const s = seriesOf(item);
    if (!s) {
      loose.push(item);
      continue;
    }
    const c = found.get(s.key) ?? { key: s.key, name: s.name, members: [] };
    // Wikidata's name wins over one read from a title ("ONE PIECE" → "One Piece").
    if (item.series?.name) c.name = item.series.name;
    c.members.push({ item, ordinal: s.ordinal });
    found.set(s.key, c);
  }
  // The first of a series often has no number ("Toy Story", then "Toy Story 2").
  const singles: T[] = [];
  for (const item of loose) {
    const c = found.get(seriesNorm(item.title));
    if (c) c.members.push({ item, ordinal: 1 });
    else singles.push(item);
  }
  const groups: Collection<T>[] = [];
  for (const c of found.values()) {
    if (c.members.length < 2) singles.push(...c.members.map((m) => m.item));
    else {
      c.members.sort((a, b) => byPlace({ ordinal: a.ordinal, date: dateOf(a.item), title: a.item.title }, { ordinal: b.ordinal, date: dateOf(b.item), title: b.item.title }));
      groups.push(c);
    }
  }
  return { singles, groups };
}

/** Seen, read or played. */
export const isDone = (kind: SeriesKind, item: CollectionItem) => (kind === 'movie' ? !!(item as Movie).watchedAt : !!(item as Book | Game).finishedAt);

/** A series' page; `qid` (any entry Wikidata knows) finds the rest of the series. */
export const collectionHref = (kind: SeriesKind, s: { key: string; name: string }, qid?: string) =>
  `/collection/${kind}/${encodeURIComponent(s.key)}?name=${encodeURIComponent(s.name)}${qid ? `&qid=${qid}` : ''}`;

/** Your copies of a series: what names it, and the series' first entry when it has no number. */
export function membersOf<T extends CollectionItem>(items: T[], key: string): Member<T>[] {
  const out: Member<T>[] = [];
  for (const item of items) {
    const s = seriesOf(item);
    if (s?.key === key) out.push({ item, ordinal: s.ordinal });
    else if (!s && seriesNorm(item.title) === key) out.push({ item, ordinal: 1 });
  }
  return out;
}

// ------------------------------------------------------------------ films: series from Wikidata

const DAY = 86_400_000;
let running = false;

/** Films don't come with their series: Wikidata is asked once a month, by IMDb id, many at a time. */
export async function refreshMovieSeries() {
  if (running) return;
  const now = Date.now();
  const due = Object.values(useLibrary.getState().movies).filter((m) => m.imdbId && (!m.seriesAt || now - m.seriesAt > 30 * DAY));
  if (!due.length) return;
  running = true;
  const lang = i18n.language === 'fr' ? 'fr' : 'en';
  try {
    for (let i = 0; i < due.length; i += 60) {
      const chunk = due.slice(i, i + 60);
      const json = await sparql<any>(`SELECT ?imdb ?item ?series ?seriesLabel ?ord WHERE {
  VALUES ?imdb { ${chunk.map((m) => `"${m.imdbId}"`).join(' ')} }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item p:P179 ?st . ?st ps:P179 ?series . OPTIONAL { ?st pq:P1545 ?ord } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
}`);
      const byImdb = new Map<string, any>();
      // A film in several series keeps its own (Toy Story), not a studio's list (Pixar films): one with a position first.
      const score = (b: any) => (b?.series ? 1 : 0) + (b?.ord ? 1 : 0) - (/^(list|liste)\b/i.test(b?.seriesLabel?.value ?? '') ? 3 : 0);
      for (const b of json?.results?.bindings ?? []) {
        const prev = byImdb.get(b.imdb?.value);
        if (!prev || score(b) > score(prev)) byImdb.set(b.imdb?.value, b);
      }
      const patches: Record<string, Partial<Movie>> = {};
      for (const m of chunk) {
        const b = byImdb.get(m.imdbId!);
        const qid = b?.item?.value?.split('/').pop();
        const sid = b?.series?.value?.split('/').pop();
        const name: string | undefined = b?.seriesLabel?.value;
        patches[m.id] = {
          seriesAt: now,
          wikidataId: qid && /^Q\d+$/.test(qid) ? qid : m.wikidataId,
          series: sid && name && !/^Q\d+$/.test(name) ? { name, id: sid, ordinal: b.ord?.value } : m.series,
        };
      }
      useLibrary.getState().patchMovies(patches);
    }
  } catch {
    // Wikidata busy or offline: asked again next time.
  } finally {
    running = false;
  }
}

// ------------------------------------------------------------------ a collection's page

/** Every entry of a series, in your library or not. */
export interface CollectionEntry {
  key: string;
  title: string;
  href: string;
  cover?: string;
  ordinal?: number;
  date?: number;
  exact: boolean;
  /** Your copy, when it is in the library. */
  item?: CollectionItem;
}

/** Book volumes numbered in their titles ("ONE PIECE 12"): Open Library has them all, unlinked. */
async function olVolumes(name: string, lang: string): Promise<SeriesEntry[]> {
  const r = await getJson<{ docs?: { key?: string; title?: string; cover_i?: number; first_publish_year?: number }[] }>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(name)}&limit=200&lang=${lang}&fields=key,title,cover_i,first_publish_year`,
  );
  const want = seriesNorm(name);
  const seen = new Set<number>();
  const out: SeriesEntry[] = [];
  for (const d of r.docs ?? []) {
    const s = d.title ? titleSeries(d.title) : undefined;
    if (!d.key || !s || seriesNorm(s.name) !== want || seen.has(s.ordinal)) continue;
    seen.add(s.ordinal);
    const olid = d.key.replace('/works/', '');
    out.push({
      qid: olid,
      title: d.title!,
      relation: 'series',
      ordinal: String(s.ordinal),
      date: d.first_publish_year ? Date.UTC(d.first_publish_year, 0, 1) : undefined,
      exact: false,
      href: `/book/ol-${olid}`,
      cover: olCover(d.cover_i, 'M'),
    });
  }
  return out;
}

/**
 * The series from Wikidata: by its own id when known, else around any entry it knows (kept to
 * the entries of that series by name). Else Open Library's numbered volumes.
 */
export async function loadCollection(kind: SeriesKind, name: string, seriesIds: string[], seeds: string[], lang: string): Promise<SeriesEntry[]> {
  for (const id of seriesIds) {
    const list = await quiet(fetchSeriesMembers(id, kind, lang), []);
    if (list.length) return list;
  }
  const want = seriesNorm(name);
  for (const qid of seeds) {
    const list = await quiet(fetchSeries(qid, kind, lang), []);
    const same = list.filter((e) => e.relation !== 'series' || (e.series && seriesNorm(e.series) === want));
    if (same.length) return same;
  }
  if (kind === 'book') return quiet(persisted(`olvolumes:${seriesNorm(name)}:${lang}`, 7 * DAY, () => olVolumes(name, lang), (v) => !v.length), []);
  return [];
}

/** The page's list: the series' entries matched with your copies, yours that it misses added in place. */
export function mergeEntries(kind: SeriesKind, entries: SeriesEntry[], members: Member[]): CollectionEntry[] {
  const left = new Set(members);
  const out: CollectionEntry[] = entries.map((e) => {
    const mine = members.find(
      (m) =>
        left.has(m) &&
        ((!!e.imdb && (m.item as Movie).imdbId === e.imdb) || (!!m.item.wikidataId && m.item.wikidataId === e.qid) || e.href === `/${kind}/${m.item.id}`),
    );
    if (mine) left.delete(mine);
    const n = parseFloat(e.ordinal ?? '');
    return {
      key: e.qid,
      title: mine?.item.title ?? e.title,
      href: mine ? `/${kind}/${mine.item.id}` : e.href,
      cover: (mine && artOf(mine.item)) || e.cover,
      ordinal: Number.isFinite(n) ? n : mine?.ordinal,
      date: e.date ?? (mine ? dateOf(mine.item) : undefined),
      exact: e.exact,
      item: mine?.item,
    };
  });
  for (const m of left)
    out.push({
      key: m.item.id,
      title: m.item.title,
      href: `/${kind}/${m.item.id}`,
      cover: artOf(m.item),
      ordinal: m.ordinal,
      date: dateOf(m.item),
      exact: !!m.item.releaseDate,
      item: m.item,
    });
  return out.sort(byPlace);
}
