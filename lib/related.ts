/**
 * Sequels and titles from the same universe as what you follow, from Wikidata (keyless):
 * what comes next ("followed by"), the same film series, the same media franchise or the same
 * fictional universe (the MCU, Star Wars, the Conjuring…). Only titles with an exact release
 * date are kept, from a few months back (out now) to anything announced.
 */
import i18n from '@/locales/i18n';
import { imdbTitle, postJson, tvmazeIdByImdb } from './api';
import { isbnCover } from './books';
import { steamCover } from './games';
import { BOOK_TYPES, GAME_TYPES, seriesHref } from './series';
import { WIKI_HEADERS } from './wikidata';
import { useLibrary } from '@/store/useLibrary';
import { RelatedRelease, useConnections } from '@/store/useConnections';

const SPARQL = 'https://query.wikidata.org/sparql';
const REFRESH = 86_400_000;
/** Recent releases stay as "out now" this long. */
export const OUT_NOW = 120 * 86_400_000;
const MAX = 80;

/** Instances of: film, feature, animated and TV film; TV, web, animated and anime series, miniseries. */
const FILM_TYPES = ['Q11424', 'Q24869', 'Q29168811', 'Q202866', 'Q506240'];
const SERIES_TYPES = ['Q5398426', 'Q1259759', 'Q526877', 'Q117467246', 'Q63952888', 'Q581714', 'Q15416'];

function query(seeds: string[], from: string, lang: string) {
  const types = [...FILM_TYPES, ...SERIES_TYPES].map((q) => `wd:${q}`).join(' ');
  return `SELECT ?seedImdb ?imdb ?itemLabel ?type ?date ?rel ?groupLabel WHERE {
  VALUES ?seedImdb { ${seeds.map((s) => `"${s}"`).join(' ')} }
  ?seed wdt:P345 ?seedImdb .
  { ?seed wdt:P156 ?item . BIND("sequel" AS ?rel) }
  UNION { ?seed wdt:P179 ?group . ?item wdt:P179 ?group . BIND("series" AS ?rel) }
  UNION { ?seed wdt:P8345 ?group . ?item wdt:P8345 ?group . BIND("universe" AS ?rel) }
  UNION { ?seed wdt:P1434 ?group . ?item wdt:P1434 ?group . BIND("universe" AS ?rel) }
  FILTER(?item != ?seed)
  VALUES ?type { ${types} }
  ?item wdt:P31 ?type ; wdt:P345 ?imdb ; p:P577 ?st .
  ?st psv:P577 [ wikibase:timeValue ?date ; wikibase:timePrecision ?prec ] .
  FILTER(?prec >= 11 && ?date >= "${from}"^^xsd:dateTime)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT 600`;
}

/** Books and games are seeded by their Wikidata id: sequels, prequels written later, series, franchise. */
function shelfQuery(seeds: string[], from: string, lang: string) {
  const types = [...BOOK_TYPES, ...GAME_TYPES].map((q) => `wd:${q}`).join(' ');
  return `SELECT ?seed ?item ?itemLabel ?type ?date ?rel ?groupLabel ?ol ?steam ?isbn WHERE {
  VALUES ?seed { ${seeds.map((s) => `wd:${s}`).join(' ')} }
  { ?seed wdt:P156 ?item . BIND("sequel" AS ?rel) }
  UNION { ?item wdt:P155 ?seed . BIND("sequel" AS ?rel) }
  UNION { ?seed wdt:P155 ?item . BIND("prequel" AS ?rel) }
  UNION { ?seed wdt:P179 ?group . ?item wdt:P179 ?group . BIND("series" AS ?rel) }
  UNION { ?seed wdt:P8345 ?group . ?item wdt:P8345 ?group . BIND("universe" AS ?rel) }
  FILTER(?item != ?seed)
  VALUES ?type { ${types} }
  ?item wdt:P31 ?type ; p:P577 ?st .
  ?st psv:P577 [ wikibase:timeValue ?date ; wikibase:timePrecision ?prec ] .
  FILTER(?prec >= 11 && ?date >= "${from}"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P648 ?ol }
  OPTIONAL { ?item wdt:P1733 ?steam }
  OPTIONAL { ?item wdt:P212 ?isbn }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT 600`;
}

const RANK = { sequel: 0, prequel: 0, series: 1, universe: 2 } as const;

/** The seeds: IMDb ids of every film and followed show, Wikidata ids of books and games. */
function seedsOf() {
  const { shows, movies, books, games } = useLibrary.getState();
  const titles = new Map<string, string>();
  const shelf = new Map<string, { title: string; kind: 'book' | 'game' }>();
  for (const m of Object.values(movies)) if (m.imdbId) titles.set(m.imdbId, m.title);
  for (const s of Object.values(shows)) if (s.imdbId && !s.droppedAt) titles.set(s.imdbId, s.title);
  for (const b of Object.values(books)) if (b.wikidataId && !b.droppedAt) shelf.set(b.wikidataId, { title: b.title, kind: 'book' });
  for (const g of Object.values(games)) if (g.wikidataId && !g.droppedAt) shelf.set(g.wikidataId, { title: g.title, kind: 'game' });
  return { titles, shelf };
}

const HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json', ...WIKI_HEADERS };

/** Keep the closest relation per title: a sequel beats "same universe". */
function keep(found: Map<string, RelatedRelease>, entry: RelatedRelease) {
  const prev = found.get(entry.imdbId);
  if (!prev || RANK[entry.relation] < RANK[prev.relation]) found.set(entry.imdbId, { ...entry, date: Math.min(entry.date, prev?.date ?? Infinity) });
  else prev.date = Math.min(prev.date, entry.date);
}

let running = false;

export async function refreshRelated(force = false) {
  const { settings } = useLibrary.getState();
  if (!settings.related || running) return;
  const { titles: seeds, shelf } = seedsOf();
  const key = [...seeds.keys(), ...shelf.keys()].sort().join(',');
  const cached = useConnections.getState().related;
  if (!force && cached.seeds === key && Date.now() - cached.at < REFRESH) return;
  if (!seeds.size && !shelf.size) {
    useConnections.getState().setRelated({ at: Date.now(), seeds: key, entries: [] });
    return;
  }
  running = true;
  try {
    const from = new Date(Date.now() - OUT_NOW).toISOString().slice(0, 10) + 'T00:00:00Z';
    const lang = i18n.language === 'fr' ? 'fr' : 'en';
    const ids = [...seeds.keys()];
    const found = new Map<string, RelatedRelease>();
    for (let i = 0; i < ids.length; i += 80) {
      const json = await postJson<any>(SPARQL, `format=json&query=${encodeURIComponent(query(ids.slice(i, i + 80), from, lang))}`, HEADERS);
      for (const b of json?.results?.bindings ?? []) {
        const imdbId: string | undefined = b.imdb?.value;
        const date = Date.parse(b.date?.value ?? '');
        const title: string | undefined = b.itemLabel?.value;
        if (!imdbId || !/^tt\d+$/.test(imdbId) || !Number.isFinite(date) || !title || /^Q\d+$/.test(title)) continue;
        if (seeds.has(imdbId)) continue;
        const relation = b.rel?.value as RelatedRelease['relation'];
        const kind = SERIES_TYPES.includes(String(b.type?.value).split('/').pop()!) ? 'show' : 'movie';
        const group = b.groupLabel?.value && !/^Q\d+$/.test(b.groupLabel.value) ? b.groupLabel.value : undefined;
        keep(found, { imdbId, title, date, kind, relation, group, from: seeds.get(b.seedImdb?.value) ?? '' });
      }
    }
    const qids = [...shelf.keys()];
    for (let i = 0; i < qids.length; i += 80) {
      const json = await postJson<any>(SPARQL, `format=json&query=${encodeURIComponent(shelfQuery(qids.slice(i, i + 80), from, lang))}`, HEADERS);
      for (const b of json?.results?.bindings ?? []) {
        const qid = String(b.item?.value ?? '').split('/').pop()!;
        const seed = shelf.get(String(b.seed?.value ?? '').split('/').pop()!);
        const date = Date.parse(b.date?.value ?? '');
        const title: string | undefined = b.itemLabel?.value;
        if (!seed || !/^Q\d+$/.test(qid) || !Number.isFinite(date) || !title || /^Q\d+$/.test(title) || shelf.has(qid)) continue;
        const kind = GAME_TYPES.includes(String(b.type?.value).split('/').pop()!) ? 'game' : 'book';
        const steam: string | undefined = b.steam?.value;
        const isbn: string | undefined = b.isbn?.value?.replace(/-/g, '');
        const group = b.groupLabel?.value && !/^Q\d+$/.test(b.groupLabel.value) ? b.groupLabel.value : undefined;
        keep(found, {
          imdbId: qid,
          title,
          date,
          kind,
          relation: b.rel?.value as RelatedRelease['relation'],
          group,
          from: seed.title,
          href: seriesHref(kind, qid, b.ol?.value, steam),
          poster: kind === 'game' && steam ? steamCover(steam) : isbn ? isbnCover(isbn) : undefined,
        });
      }
    }
    const entries = [...found.values()].sort((a, b) => a.date - b.date).slice(0, MAX);
    // Posters from IMDb, a few at a time.
    const screen = entries.filter((e) => e.kind === 'show' || e.kind === 'movie');
    for (let i = 0; i < screen.length; i += 6)
      await Promise.all(
        screen.slice(i, i + 6).map(async (e) => {
          const hit = await imdbTitle(e.imdbId);
          e.poster = hit?.poster;
        }),
      );
    useConnections.getState().setRelated({ at: Date.now(), seeds: key, entries });
  } catch {
    // Wikidata busy or offline: keep the last list.
  } finally {
    running = false;
  }
}

/** What is not in the library yet. */
export function visibleRelated(entries: RelatedRelease[]) {
  const { shows, movies, books, games } = useLibrary.getState();
  const have = new Set<string>();
  for (const m of Object.values(movies)) if (m.imdbId) have.add(m.imdbId);
  for (const s of Object.values(shows)) if (s.imdbId) have.add(s.imdbId);
  for (const b of Object.values(books)) if (b.wikidataId) have.add(b.wikidataId);
  for (const g of Object.values(games)) if (g.wikidataId) have.add(g.wikidataId);
  return entries.filter((e) => !have.has(e.imdbId));
}

/** Route to a related title: films open by IMDb id, series through TVmaze, books and games by their own route. */
export async function relatedHref(e: RelatedRelease) {
  if (e.href) return e.href;
  if (e.kind === 'movie') return `/movie/imdb-${e.imdbId}`;
  const id = await tvmazeIdByImdb(e.imdbId);
  return id ? `/show/${id}` : `/show/name:${encodeURIComponent(e.title)}`;
}

/** "Sequel to Dune" / "Marvel Cinematic Universe". */
export function relationLabel(e: RelatedRelease) {
  if (e.relation === 'sequel') return i18n.t('related.sequelTo', { title: e.from });
  if (e.relation === 'prequel') return i18n.t('related.prequelTo', { title: e.from });
  if (e.group) return e.group;
  return i18n.t('related.sameUniverse', { title: e.from });
}
