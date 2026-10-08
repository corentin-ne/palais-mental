/**
 * What comes before and after a book or game, and the rest of its series, from Wikidata:
 * "follows" (P155), "followed by" (P156) and "part of the series" (P179) with each entry's
 * position and release date, announced ones included.
 */
import { persisted } from './cache';
import { isbnCover, steamCover } from './covers';
import { sparql } from './wikidata';

export type SeriesKind = 'book' | 'game';

/** Literary work, written work, novel, book, novella, short story, graphic novel, manga, light novel. */
export const BOOK_TYPES = ['Q7725634', 'Q47461344', 'Q8261', 'Q571', 'Q149537', 'Q49084', 'Q725377', 'Q8274', 'Q747381'];
/** Video game, expansion pack. */
export const GAME_TYPES = ['Q7889', 'Q865493'];

export interface SeriesEntry {
  qid: string;
  title: string;
  relation: 'prequel' | 'sequel' | 'series';
  ordinal?: string;
  series?: string;
  date?: number;
  /** False when only the year (or month) is known. */
  exact: boolean;
  href: string;
  cover?: string;
}

const RANK = { prequel: 0, sequel: 0, series: 1 } as const;

function query(qid: string, kind: SeriesKind, lang: string) {
  const types = (kind === 'book' ? BOOK_TYPES : GAME_TYPES).map((q) => `wd:${q}`).join(' ');
  return `SELECT ?item ?itemLabel ?rel ?ord ?seriesLabel ?date ?prec ?ol ?steam ?isbn WHERE {
  { wd:${qid} wdt:P155 ?item . BIND("prequel" AS ?rel) }
  UNION { ?item wdt:P156 wd:${qid} . BIND("prequel" AS ?rel) }
  UNION { wd:${qid} wdt:P156 ?item . BIND("sequel" AS ?rel) }
  UNION { ?item wdt:P155 wd:${qid} . BIND("sequel" AS ?rel) }
  UNION { wd:${qid} wdt:P179 ?series . ?item p:P179 ?st . ?st ps:P179 ?series . OPTIONAL { ?st pq:P1545 ?ord } BIND("series" AS ?rel) }
  FILTER(?item != wd:${qid})
  VALUES ?type { ${types} }
  ?item wdt:P31 ?type .
  OPTIONAL { ?item p:P577/psv:P577 [ wikibase:timeValue ?date ; wikibase:timePrecision ?prec ] }
  OPTIONAL { ?item wdt:P648 ?ol }
  OPTIONAL { ?item wdt:P1733 ?steam }
  OPTIONAL { ?item wdt:P212 ?isbn }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
} LIMIT 400`;
}

/** Route to an entry: its Open Library or Steam page when Wikidata links one. */
export function seriesHref(kind: SeriesKind, qid: string, ol?: string, steam?: string) {
  if (kind === 'book') return ol && /^OL\d+W$/.test(ol) ? `/book/ol-${ol}` : `/book/wd-${qid}`;
  return steam && /^\d+$/.test(steam) ? `/game/steam-${steam}` : `/game/wd-${qid}`;
}

/** Ordered: by position in the series when known, else by release date. */
export function fetchSeries(qid: string, kind: SeriesKind, lang: string): Promise<SeriesEntry[]> {
  // Kept a day on the device: the query takes seconds, and series change rarely.
  return persisted(`series:${qid}:${kind}:${lang}`, 86_400_000, () => querySeries(qid, kind, lang), (v) => !v.length);
}

async function querySeries(qid: string, kind: SeriesKind, lang: string): Promise<SeriesEntry[]> {
  const json = await sparql(query(qid, kind, lang === 'fr' ? 'fr' : 'en'));
  const found = new Map<string, SeriesEntry>();
  for (const b of json?.results?.bindings ?? []) {
    const id = String(b.item?.value ?? '').split('/').pop()!;
    const title: string | undefined = b.itemLabel?.value;
    if (!/^Q\d+$/.test(id) || !title || /^Q\d+$/.test(title)) continue;
    const relation = b.rel?.value as SeriesEntry['relation'];
    const t = Date.parse(b.date?.value ?? '');
    const exact = Number(b.prec?.value) >= 11;
    const ol: string | undefined = b.ol?.value;
    const steam: string | undefined = b.steam?.value;
    const isbn: string | undefined = b.isbn?.value?.replace(/-/g, '');
    const prev = found.get(id);
    const date = Number.isFinite(t) ? (prev?.date != null ? Math.min(prev.date, t) : t) : prev?.date;
    const entry: SeriesEntry = {
      qid: id,
      title,
      relation: prev && RANK[prev.relation] <= RANK[relation] ? prev.relation : relation,
      ordinal: prev?.ordinal ?? b.ord?.value,
      series: prev?.series ?? (b.seriesLabel?.value && !/^Q\d+$/.test(b.seriesLabel.value) ? b.seriesLabel.value : undefined),
      date,
      exact: (prev?.exact ?? false) || (exact && date === t),
      href: prev?.href && !prev.href.includes('/wd-') ? prev.href : seriesHref(kind, id, ol, steam),
      cover: prev?.cover ?? (kind === 'game' && steam ? steamCover(steam) : kind === 'book' && isbn ? isbnCover(isbn) : undefined),
    };
    found.set(id, entry);
  }
  const list = [...found.values()];
  const num = (o?: string) => (o && Number.isFinite(parseFloat(o)) ? parseFloat(o) : undefined);
  return list.sort((a, b) => {
    const oa = num(a.ordinal);
    const ob = num(b.ordinal);
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    return (a.date ?? Infinity) - (b.date ?? Infinity) || a.title.localeCompare(b.title);
  });
}
