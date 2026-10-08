/**
 * Books, keyless: Open Library leads (works, covers, page counts, editions), Google Books fills
 * publication dates (it knows upcoming books) and adds what Open Library misses, and Wikidata
 * gives exact dates and the series a book belongs to.
 */
import { SearchResult, getJson, norm, quiet, stripHtml, yearOf } from './api';
import { Book, BookSource } from './types';
import { claimIds, claimString, claimValues, commonsImage, entity, labels, looseDate, qidBy, releaseOf, seriesClaim, wikiSummary } from './wikidata';

export type BookMeta = Omit<Book, 'page' | 'touchedAt' | 'startedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'addedAt'>;

const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const enc = encodeURIComponent;
const olCover = (id?: number, size: 'M' | 'L' = 'L') => (id && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : undefined);
export const isbnCover = (isbn?: string) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : undefined);
const https = (u?: string) => u?.replace(/^http:\/\//, 'https://');
/** Google Books thumbnails grow through `zoom` and lose the page curl with `edge`. */
const gbCover = (u?: string) => https(u)?.replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=1');

export function parseBookId(id: string): { source: BookSource; sourceId: string } | undefined {
  const m = id.match(/^(ol|gb|wd)-(.+)$/);
  return m ? { source: m[1] as BookSource, sourceId: m[2] } : undefined;
}

// ------------------------------------------------------------------ Search
interface OlDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
}
interface GbVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string; small?: string; medium?: string; large?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
    language?: string;
  };
}

const olResult = (d: OlDoc): SearchResult => ({
  kind: 'book',
  id: `ol-${d.key!.replace('/works/', '')}`,
  title: d.title!,
  year: d.first_publish_year,
  poster: olCover(d.cover_i, 'M'),
  subtitle: d.author_name?.slice(0, 2).join(', '),
});

function gbResult(v: GbVolume): SearchResult {
  const i = v.volumeInfo!;
  const when = looseDate(i.publishedDate);
  return { kind: 'book', id: `gb-${v.id}`, title: i.title!, year: when.year, releaseDate: when.date, poster: gbCover(i.imageLinks?.thumbnail), subtitle: i.authors?.slice(0, 2).join(', ') };
}

export async function searchBooks(q: string, lang: string): Promise<SearchResult[]> {
  const [ol, gb] = await Promise.all([
    quiet(getJson<{ docs?: OlDoc[] }>(`${OL}/search.json?q=${enc(q)}&limit=16&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median&lang=${lang}`), { docs: [] }),
    quiet(getJson<{ items?: GbVolume[] }>(`${GB}?q=${enc(q)}&maxResults=16&printType=books`), { items: [] }),
  ]);
  const out = (ol.docs ?? []).filter((d) => d.key && d.title).map(olResult);
  const sameAuthor = (a?: string, b?: string) => !a || !b || norm(a).split(' ').some((w) => w.length > 2 && norm(b).includes(w));
  for (const v of gb.items ?? []) {
    if (!v.id || !v.volumeInfo?.title) continue;
    const r = gbResult(v);
    const twin = out.find((o) => norm(o.title) === norm(r.title) && sameAuthor(o.subtitle, r.subtitle));
    if (twin) {
      twin.releaseDate ??= r.year === twin.year ? r.releaseDate : undefined;
      twin.poster ??= r.poster;
    } else if (r.poster || (r.releaseDate && r.releaseDate > Date.now())) out.push(r);
  }
  return out.slice(0, 24);
}

/** What people read this week (Open Library). */
export async function trendingBooks(): Promise<SearchResult[]> {
  const r = await quiet(getJson<{ works?: OlDoc[] }>(`${OL}/trending/weekly.json?limit=24`), { works: [] });
  return (r.works ?? [])
    .filter((d) => d.key && d.title && d.cover_i)
    .slice(0, 18)
    .map(olResult);
}

// ------------------------------------------------------------------ Details
export interface BookDetails {
  book: BookMeta;
  /** A Wikidata entry that has an Open Library twin opens there instead. */
  redirect?: string;
}

interface OlEdition {
  number_of_pages?: number;
  publish_date?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  languages?: { key?: string }[];
}

const textOf = (v: unknown) => (typeof v === 'string' ? v : typeof (v as any)?.value === 'string' ? (v as any).value : undefined);

/** Open Library descriptions often end with a "Contains" list or source links: keep the prose. */
const cleanDescription = (s?: string) =>
  s
    ?.split(/\n-{3,}|\n\(\[source\]|\n\*\*Contains/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim() || undefined;

/** Middle value: page counts vary a little between editions. */
const median = (list: number[]) => {
  const sorted = list.filter((n) => n > 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
};

async function gbByIsbn(isbn: string) {
  const r = await quiet(getJson<{ items?: GbVolume[] }>(`${GB}?q=isbn:${isbn}&maxResults=1`), { items: [] });
  return r.items?.[0]?.volumeInfo;
}

/** Series name and the Wikidata id, for a book Wikidata knows. */
async function wikidataBits(qid: string | undefined, lang: string) {
  if (!qid) return undefined;
  const e = await quiet(entity(qid, lang), undefined);
  if (!e) return undefined;
  const series = seriesClaim(e.claims);
  const names = series ? await labels([series.id], lang) : {};
  return { qid, release: releaseOf(e.claims), series: series && names[series.id] ? { name: names[series.id], ordinal: series.ordinal } : undefined, entity: e };
}

export async function fetchBook(id: string, lang: string): Promise<BookDetails> {
  const parsed = parseBookId(id);
  if (!parsed) throw new Error('Unknown book');
  const { source, sourceId } = parsed;
  const base = { id, source, sourceId, syncedAt: Date.now() };

  if (source === 'ol') {
    const [work, editions, qid] = await Promise.all([
      getJson<any>(`${OL}/works/${sourceId}.json`),
      quiet(getJson<{ entries?: OlEdition[] }>(`${OL}/works/${sourceId}/editions.json?limit=60`), { entries: [] }),
      qidBy('P648', sourceId),
    ]);
    const authorKeys: string[] = (work.authors ?? []).map((a: any) => a?.author?.key).filter(Boolean).slice(0, 3);
    const [authors, wiki] = await Promise.all([
      Promise.all(authorKeys.map((k) => quiet(getJson<{ name?: string }>(`${OL}${k}.json`), {} as { name?: string }))),
      wikidataBits(qid, lang),
    ]);
    const list = editions.entries ?? [];
    const firstYear = yearOf(work.first_publish_date);
    const editionDates = list
      .map((e) => looseDate(e.publish_date).date)
      .filter((d): d is number => !!d && (!firstYear || new Date(d).getUTCFullYear() >= firstYear))
      .sort((a, b) => a - b);
    const isbn = list.flatMap((e) => e.isbn_13 ?? []).find(Boolean) ?? list.flatMap((e) => e.isbn_10 ?? []).find(Boolean);
    let releaseDate = wiki?.release.date ?? editionDates[0];
    let year = wiki?.release.year ?? firstYear ?? (releaseDate ? new Date(releaseDate).getUTCFullYear() : undefined);
    // Upcoming books: Google Books usually has the exact day from the publisher.
    let gb: GbVolume['volumeInfo'];
    if (isbn && (!releaseDate || releaseDate > Date.now() - 86_400_000 * 30)) {
      gb = await gbByIsbn(isbn);
      const when = looseDate(gb?.publishedDate);
      if (when.date && (!releaseDate || !wiki?.release.date)) releaseDate = when.date;
      year ??= when.year;
    }
    return {
      book: {
        ...base,
        title: work.title ?? sourceId,
        authors: authors.map((a) => a.name).filter((n): n is string => !!n),
        cover: olCover(work.covers?.find((c: number) => c > 0)) ?? gbCover(gb?.imageLinks?.thumbnail),
        year,
        releaseDate,
        pages: median(list.map((e) => e.number_of_pages ?? 0)) ?? gb?.pageCount,
        overview: cleanDescription(textOf(work.description)) ?? stripHtml(gb?.description) ?? (wiki ? await wikiSummary(wiki.entity, lang) : undefined),
        subjects: ((work.subjects ?? []) as string[]).filter((s) => s.length < 28 && !/[:=]/.test(s)).slice(0, 5),
        isbn,
        wikidataId: qid,
        series: wiki?.series,
      },
    };
  }

  if (source === 'gb') {
    const v = await getJson<GbVolume>(`${GB}/${sourceId}`);
    const i = v.volumeInfo;
    if (!i?.title) throw new Error('Not found');
    const isbn = i.industryIdentifiers?.find((x) => x.type === 'ISBN_13')?.identifier ?? i.industryIdentifiers?.find((x) => x.type === 'ISBN_10')?.identifier;
    // Wikidata knows books by their Open Library work: reach it through the ISBN.
    const edition = isbn ? await quiet(getJson<{ works?: { key?: string }[] }>(`${OL}/isbn/${isbn}.json`), null) : null;
    const work = edition?.works?.[0]?.key?.replace('/works/', '');
    const qid = work ? await qidBy('P648', work) : undefined;
    const wiki = await wikidataBits(qid, lang);
    const when = looseDate(i.publishedDate);
    const img = i.imageLinks;
    return {
      book: {
        ...base,
        title: i.subtitle && i.title.length < 30 ? `${i.title}: ${i.subtitle}` : i.title,
        authors: i.authors ?? [],
        cover: gbCover(img?.medium ?? img?.small ?? img?.thumbnail) ?? isbnCover(isbn),
        year: when.year,
        releaseDate: when.date ?? wiki?.release.date,
        pages: i.pageCount || undefined,
        overview: stripHtml(i.description),
        subjects: (i.categories ?? []).flatMap((c) => c.split(' / ')).filter((c, k, all) => all.indexOf(c) === k).slice(0, 5),
        isbn,
        wikidataId: qid,
        series: wiki?.series,
      },
    };
  }

  // Wikidata: opens on Open Library when it has a twin there, else built from Wikidata.
  const e = await entity(sourceId, lang);
  if (!e) throw new Error('Not found');
  const olId = claimString(e.claims, 'P648');
  if (olId && /^OL\d+W$/.test(olId)) return { redirect: `ol-${olId}`, book: { ...base, title: e.label ?? sourceId, authors: [], subjects: [] } };
  const series = seriesClaim(e.claims);
  const authorIds = claimIds(e.claims, 'P50').slice(0, 3);
  const genreIds = claimIds(e.claims, 'P136').slice(0, 4);
  const names = await labels([...authorIds, ...genreIds, ...(series ? [series.id] : [])], lang);
  const release = releaseOf(e.claims);
  const isbn = claimString(e.claims, 'P212')?.replace(/-/g, '');
  const pages = Number(claimValues(e.claims, 'P1104')[0]?.amount);
  return {
    book: {
      ...base,
      title: e.label ?? sourceId,
      authors: authorIds.map((a) => names[a]).filter(Boolean),
      cover: commonsImage(claimString(e.claims, 'P18')) ?? isbnCover(isbn),
      year: release.year,
      releaseDate: release.date,
      pages: Number.isFinite(pages) && pages > 0 ? pages : undefined,
      overview: (await wikiSummary(e, lang)) ?? e.description,
      subjects: genreIds.map((g) => names[g]).filter(Boolean),
      isbn,
      wikidataId: sourceId,
      series: series && names[series.id] ? { name: names[series.id], ordinal: series.ordinal } : undefined,
    },
  };
}

/** The book's page on its source. */
export function bookPage(b: Pick<Book, 'source' | 'sourceId' | 'wikidataId'>) {
  if (b.source === 'ol') return `${OL}/works/${b.sourceId}`;
  if (b.source === 'gb') return `https://books.google.com/books?id=${b.sourceId}`;
  return `https://www.wikidata.org/wiki/${b.sourceId}`;
}
