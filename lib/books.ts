/**
 * Books, keyless: Open Library leads (works, covers, page counts, editions), Google Books fills
 * publication dates (it knows upcoming books) and adds what Open Library misses, and Wikidata
 * gives exact dates and the series a book belongs to.
 */
import { SearchResult, getJson, norm, quiet, stripHtml, yearOf } from './api';
import { persisted } from './cache';
import { isbnCover, olAuthorPhoto, olCover } from './covers';
import { DAY, ExtraItem, ExtraLink, Fact, Score, ShelfExtras, TagGroup, uniqueBy, wikidataFacts, wikidataRails } from './extras';
import { compact } from './format';
import { Book, BookSource } from './types';
import { cachedLabels, claimIds, claimString, claimValues, commonsImage, entity, looseDate, qidBy, releaseOf, seriesClaim, wikiSummary } from './wikidata';

export type BookMeta = Omit<Book, 'page' | 'touchedAt' | 'startedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'addedAt'>;

const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const enc = encodeURIComponent;
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
  publishers?: string[];
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

/** Everything the search index knows about a work: readers, ratings, characters, places, series. */
const DOC_FIELDS = [
  'key', 'title', 'author_key', 'author_name', 'ratings_average', 'ratings_count', 'want_to_read_count', 'currently_reading_count', 'already_read_count',
  'edition_count', 'language', 'person', 'place', 'time', 'subject', 'id_wikidata', 'id_goodreads', 'series_key', 'series_name', 'series_position', 'first_publish_year',
].join(',');

export interface OlDocFull extends OlDoc {
  author_key?: string[];
  ratings_average?: number;
  ratings_count?: number;
  want_to_read_count?: number;
  currently_reading_count?: number;
  already_read_count?: number;
  edition_count?: number;
  language?: string[];
  person?: string[];
  place?: string[];
  time?: string[];
  subject?: string[];
  id_wikidata?: string[];
  id_goodreads?: string[];
  series_key?: string[];
  series_name?: string[];
  series_position?: string[];
}

export const olDoc = (workId: string) =>
  getJson<{ docs?: OlDocFull[] }>(`${OL}/search.json?q=key:/works/${enc(workId)}&fields=${DOC_FIELDS}&limit=1`).then((r) => r.docs?.[0]);
export const olEditions = (workId: string) => getJson<{ entries?: OlEdition[] }>(`${OL}/works/${enc(workId)}/editions.json?limit=60`);

/** The series Open Library places the work in, when Wikidata doesn't. */
const olSeries = (doc?: OlDocFull) => {
  const name = doc?.series_name?.[0];
  const ordinal = doc?.series_position?.[0];
  return name ? { name, ordinal: ordinal && /^\d+(\.\d+)?$/.test(ordinal) ? ordinal : undefined } : undefined;
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
  const names = series ? await cachedLabels([series.id], lang) : {};
  return { qid, release: releaseOf(e.claims), series: series && names[series.id] ? { name: names[series.id], id: series.id, ordinal: series.ordinal } : undefined, entity: e };
}

export async function fetchBook(id: string, lang: string): Promise<BookDetails> {
  const parsed = parseBookId(id);
  if (!parsed) throw new Error('Unknown book');
  const { source, sourceId } = parsed;
  const base = { id, source, sourceId, syncedAt: Date.now() };

  if (source === 'ol') {
    // The search index carries the authors' names and the Wikidata id: no call per author.
    const [work, editions, doc, qidFound] = await Promise.all([
      getJson<any>(`${OL}/works/${sourceId}.json`),
      quiet(olEditions(sourceId), { entries: [] }),
      quiet(olDoc(sourceId), undefined),
      qidBy('P648', sourceId),
    ]);
    const qid = qidFound ?? doc?.id_wikidata?.find((q) => /^Q\d+$/.test(q));
    const authorKeys: string[] = (work.authors ?? []).map((a: any) => a?.author?.key).filter(Boolean).slice(0, 3);
    const [authors, wiki] = await Promise.all([
      doc?.author_name?.length
        ? doc.author_name.slice(0, 3).map((name) => ({ name }))
        : Promise.all(authorKeys.map((k) => quiet(getJson<{ name?: string }>(`${OL}${k}.json`), {} as { name?: string }))),
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
        series: wiki?.series ?? olSeries(doc),
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
  const names = await cachedLabels([...authorIds, ...genreIds, ...(series ? [series.id] : [])], lang);
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
      series: series && names[series.id] ? { name: names[series.id], id: series.id, ordinal: series.ordinal } : undefined,
    },
  };
}

/** The book's page on its source. */
export function bookPage(b: Pick<Book, 'source' | 'sourceId' | 'wikidataId'>) {
  if (b.source === 'ol') return `${OL}/works/${b.sourceId}`;
  if (b.source === 'gb') return `https://books.google.com/books?id=${b.sourceId}`;
  return `https://www.wikidata.org/wiki/${b.sourceId}`;
}

// ------------------------------------------------------------------ Extras
/** Subjects too broad to find anything alike with. */
const BROAD =
  /^(fiction|general|literature|novels?|romans?|english|american|french|british|juvenile|young adult|children|accessible book|protected daisy|lending library|in library|large type|reading level|nyt|new york times|open library|staff picks|translations|history|biography)\b|fiction, general|ebooks?|award|bestseller|internet archive/i;
/** "Frodo Baggins (Fictitious character)" → "Frodo Baggins"; "Baggins, Bilbo" → "Bilbo Baggins". */
const cleanName = (s: string) => {
  const bare = s
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/,?\s*fiction$/i, '')
    .trim();
  const m = bare.match(/^([^,]+),\s*([^,]+)$/);
  return m ? `${m[2]} ${m[1]}` : bare;
};
const tidy = (list: string[] | undefined, n: number) =>
  uniqueBy(
    (list ?? []).map(cleanName).filter((s) => s.length > 1 && s.length < 40),
    (s) => s,
  ).slice(0, n);
/** Subjects that say what kind of book it is: preferred to find books alike. */
const GENRE =
  /fantas|science.fiction|sci-fi|myster|thriller|suspense|romance|love stor|horror|detective|crime|historical fiction|dystop|adventure|humou?r|comic|graphic novel|manga|poetry|space|magic|wizard|dragon|vampire|ghost|psycholog|coming of age|espionage|spy|western|apocalyp|time travel|robot|cyberpunk|steampunk|fairy|myth|policier|aventure|amour|fantastique/i;
/** Translations of "fiction", call numbers and catalogue oddities. */
const NOISE = /^(ficci[oó]n|fiction|fictie|fiktion|literatura|littérature|novela|gift books?|telephone directories)$|\d/i;
const OL_LANG: Record<string, string> = { fr: 'fre', en: 'eng' };
/** "J.R.R. Tolkien" → "tolkien": a title naming the author is a book about them. */
const surnamesOf = (authors: string[]) => authors.map((a) => norm(a).split(' ').pop() ?? '').filter((n) => n.length > 3);

/**
 * Works from a search, as rail entries: covers first, one per title, without this book.
 * `others` keeps only other authors' books that aren't about this one (companions, guides).
 */
async function olRail(query: string, exclude: string, lang: string, others?: { title: string; authors: string[] }): Promise<ExtraItem[]> {
  const r = await getJson<{ docs?: OlDoc[] }>(`${OL}/search.json?q=${enc(query)}&sort=readinglog&limit=40&lang=${lang}&fields=key,title,cover_i,first_publish_year,author_name`);
  const title = others ? norm(others.title) : '';
  const authors = new Set(others?.authors.map(norm));
  const surnames = surnamesOf(others?.authors ?? []);
  const aboutIt = (t: string) => norm(t).includes(title) || surnames.some((n) => norm(t).split(' ').includes(n));
  const docs = (r.docs ?? []).filter(
    (d) => d.key && d.title && d.key !== `/works/${exclude}` && (!others || (!aboutIt(d.title) && !(d.author_name ?? []).some((a) => authors.has(norm(a))))),
  );
  // Books alike: at most two per author, so one big series doesn't fill the rail.
  const perAuthor = new Map<string, number>();
  const varied = others ? docs.filter((d) => {
    const a = norm(d.author_name?.[0] ?? '');
    perAuthor.set(a, (perAuthor.get(a) ?? 0) + 1);
    return !a || perAuthor.get(a)! <= 2;
  }) : docs;
  return uniqueBy(varied, (d) => norm(d.title!))
    .sort((a, b) => Number(!!b.cover_i) - Number(!!a.cover_i))
    .slice(0, 18)
    .map((d) => ({
      key: d.key!,
      href: `/book/ol-${d.key!.replace('/works/', '')}`,
      title: d.title!,
      poster: olCover(d.cover_i, 'M'),
      kind: 'book' as const,
      caption: d.first_publish_year ? String(d.first_publish_year) : d.author_name?.[0],
    }));
}

/** The Open Library work behind any book: its own id, or found through the ISBN. */
async function workOf(book: Pick<Book, 'source' | 'sourceId' | 'isbn'>) {
  if (book.source === 'ol') return book.sourceId;
  if (!book.isbn) return undefined;
  const edition = await quiet(getJson<{ works?: { key?: string }[] }>(`${OL}/isbn/${book.isbn}.json`), null);
  return edition?.works?.[0]?.key?.replace('/works/', '');
}

/** The publisher most editions in your language (else English) came out with. */
function mainPublisher(editions: OlEdition[], lang: string) {
  const count = new Map<string, number>();
  for (const want of [OL_LANG[lang], 'eng']) {
    for (const e of editions) {
      if (want && !e.languages?.some((l) => l.key === `/languages/${want}`)) continue;
      for (const p of e.publishers ?? []) {
        const name = p.replace(/[\s,]*(ltd\.?|inc\.?|llc|publishers?|publishing( group| company)?|editions?|éditions?)\s*$/i, '').trim();
        if (name.length > 1 && !/^n\/?a$|unknown|^brand:/i.test(name)) count.set(name, (count.get(name) ?? 0) + 1);
      }
    }
    if (count.size) break;
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

interface Author {
  name?: string;
  birth_date?: string;
  death_date?: string;
  photos?: number[];
}

/** Ratings, readers, characters, places and the Goodreads link from the search index. */
function docPart(doc: OlDocFull, work: string, lang: string): ShelfExtras {
  const scores: Score[] = [];
  if (doc.ratings_count && doc.ratings_average)
    scores.push({
      key: 'rating',
      value: `${doc.ratings_average.toFixed(1).replace('.', lang === 'fr' ? ',' : '.')} ★`,
      params: { count: compact(doc.ratings_count) },
      url: `${OL}/works/${work}`,
      tone: doc.ratings_average >= 4 ? 'good' : doc.ratings_average >= 3 ? 'mixed' : 'bad',
    });
  const readers = (doc.already_read_count ?? 0) + (doc.currently_reading_count ?? 0);
  if (readers) scores.push({ key: 'readers', value: compact(readers) });
  if (doc.want_to_read_count) scores.push({ key: 'wantToRead', value: compact(doc.want_to_read_count) });
  const facts: Fact[] = [];
  if (doc.edition_count && doc.edition_count > 1) facts.push({ key: 'editions', value: compact(doc.edition_count) });
  if (doc.language && doc.language.length > 1) facts.push({ key: 'translations', value: String(doc.language.length) });
  const tags: TagGroup[] = [
    { key: 'characters', items: tidy(doc.person, 12) },
    { key: 'places', items: tidy(doc.place, 10) },
    { key: 'times', items: tidy(doc.time, 6) },
  ].filter((g) => g.items.length);
  const goodreads = doc.id_goodreads?.[0];
  return { scores, facts, tags, links: goodreads ? [{ label: 'Goodreads', url: `https://www.goodreads.com/book/show/${goodreads}`, icon: 'star' }] : [] };
}

/** The series as Open Library knows it, in order. */
async function olSeriesEntries(seriesKey: string, lang: string): Promise<ExtraItem[]> {
  const r = await getJson<{ docs?: (OlDoc & { series_position?: string[] })[] }>(
    `${OL}/search.json?q=series_key:${enc(seriesKey)}&limit=40&lang=${lang}&fields=key,title,cover_i,first_publish_year,series_position`,
  );
  const pos = (d: { series_position?: string[] }) => parseFloat(d.series_position?.[0] ?? '') || 999;
  return (r.docs ?? [])
    .filter((d) => d.key && d.title && /^\d+(\.\d+)?$/.test(d.series_position?.[0] ?? ''))
    .sort((a, b) => pos(a) - pos(b) || (a.first_publish_year ?? 0) - (b.first_publish_year ?? 0))
    .map((d) => ({ key: d.key!, href: `/book/ol-${d.key!.replace('/works/', '')}`, title: d.title!, poster: olCover(d.cover_i, 'M'), kind: 'book' as const, caption: `#${d.series_position![0]}` }));
}

/**
 * Everything around a book, part by part as each source answers: Open Library's readers,
 * ratings, characters, places, series, authors and their other books, the publisher's
 * catalogue and books on the same subjects; Wikidata's awards, adaptations and facts.
 */
export async function loadBookExtras(
  book: Pick<Book, 'source' | 'sourceId' | 'isbn' | 'wikidataId' | 'authors' | 'title'>,
  lang: string,
  emit: (part: ShelfExtras) => void,
) {
  const long = 7 * DAY;
  const noItems = (v: ExtraItem[]) => !v.length;
  const links: ExtraLink[] = [];
  if (book.source === 'gb') links.push({ label: 'Google Books', url: `https://books.google.com/books?id=${book.sourceId}`, icon: 'globe' });
  if (book.isbn) links.push({ label: 'WorldCat', url: `https://search.worldcat.org/search?q=bn:${book.isbn}`, icon: 'library' });
  if (lang === 'fr') links.push({ label: 'Babelio', url: `https://www.babelio.com/resrecherche.php?Recherche=${enc(book.title)}`, icon: 'globe' });
  emit({ links });

  const parts: Promise<unknown>[] = [];
  if (book.wikidataId) {
    const qid = book.wikidataId;
    parts.push(quiet(persisted(`wdfacts:${qid}:${lang}`, 3 * DAY, () => wikidataFacts(qid, 'book', lang)), {}).then(emit));
    parts.push(quiet(wikidataRails(qid, 'book', lang, false), []).then((rails) => emit({ rails })));
  }

  const work = await quiet(workOf(book), undefined);
  if (!work) {
    const name = book.authors[0];
    if (name)
      parts.push(
        quiet(persisted(`olbyname:${norm(name)}:${lang}`, long, () => olRail(`author:"${name}"`, '', lang), noItems), []).then((items) =>
          emit({ rails: [{ key: 'author', title: 'author', params: { name }, items: items.filter((i) => norm(i.title) !== norm(book.title)) }] }),
        ),
      );
    await Promise.all(parts);
    return;
  }

  if (book.source !== 'ol') emit({ links: [{ label: 'Open Library', url: `${OL}/works/${work}`, icon: 'globe' }] });
  const doc = await quiet(
    persisted(`oldoc:${work}`, DAY, async () => (await olDoc(work)) ?? null),
    null,
  );
  /** The book's main genre, to keep the publisher's rail to books of the same kind. */
  let genre: string | undefined;
  if (doc) {
    emit(docPart(doc, work, lang));
    const seriesKey = doc.series_key?.[0];
    const seriesName = doc.series_name?.[0];
    if (seriesKey && seriesName)
      parts.push(quiet(persisted(`olseries:${seriesKey}:${lang}`, long, () => olSeriesEntries(seriesKey, lang), noItems), []).then((items) => items.length > 1 && emit({ series: { name: seriesName, items } })));

    // Authors: portrait, lifespan, and what else they wrote.
    const authorKeys = (doc.author_key ?? []).slice(0, 3);
    parts.push(
      Promise.all(authorKeys.map((k) => quiet(persisted(`olauthor:${k}`, 30 * DAY, () => getJson<Author>(`${OL}/authors/${k}.json`)), {} as Author))).then((authors) => {
        const people = authors
          .map((a, i) => ({
            name: a.name ?? doc.author_name?.[i] ?? '',
            role: [yearOf(a.birth_date), yearOf(a.death_date)].filter(Boolean).join(' – ') || undefined,
            image: a.photos?.some((p) => p > 0) ? olAuthorPhoto(authorKeys[i]) : undefined,
          }))
          .filter((p) => p.name);
        if (people.length) emit({ people });
      }),
    );
    const first = authorKeys[0];
    if (first)
      parts.push(
        quiet(persisted(`olby:${first}:${lang}`, long, () => olRail(`author_key:${first}`, work, lang), noItems), []).then((items) =>
          emit({ rails: [{ key: 'author', title: 'author', params: { name: doc.author_name?.[0] ?? book.authors[0] ?? '' }, items }] }),
        ),
      );

    // Books on the same subjects: the two most specific ones together, else the first.
    // Genres rather than the book's own world: no names, places or the title itself.
    const own = [norm(book.title), ...(doc.series_name ?? []).map(norm), ...surnamesOf(doc.author_name ?? book.authors)];
    const candidates = uniqueBy(
      (doc.subject ?? []).filter((s) => s.length < 40 && !BROAD.test(s) && !NOISE.test(s) && !/[:=(]/.test(s) && !own.some((o) => o && (norm(s).includes(o) || o.includes(norm(s))))),
      (s) => norm(s),
    );
    // Genres first, English ones (the most widely tagged) before the rest; the index keeps the order.
    const rank = (s: string) => (GENRE.test(s) ? 0 : 2) + (/^[ -~]+$/.test(s) ? 0 : 1);
    const subjects = candidates
      .map((s, i) => ({ s, r: rank(s) * 1000 + i }))
      .sort((a, b) => a.r - b.r)
      .slice(0, 2)
      .map((x) => x.s);
    genre = subjects.find((x) => GENRE.test(x));
    if (subjects.length)
      parts.push(
        quiet(
          persisted(
            `olsimilar:${work}:${lang}`,
            long,
            async () => {
              const others = { title: book.title, authors: doc.author_name ?? book.authors };
              const both = subjects.length > 1 ? await quiet(olRail(subjects.map((s) => `subject:"${s}"`).join(' '), work, lang, others), []) : [];
              return both.length >= 6 ? both : olRail(`subject:"${subjects[0]}"`, work, lang, others);
            },
            noItems,
          ),
          [],
        ).then((items) => emit({ rails: [{ key: 'similar', title: 'similar', items }] })),
      );
  }

  // The publisher's catalogue.
  parts.push(
    quiet(olEditions(work), { entries: [] }).then(async (r) => {
      const publisher = mainPublisher(r.entries ?? [], lang);
      if (!publisher) return;
      emit({ facts: [{ key: 'publisher', value: publisher }] });
      const items = await quiet(
        persisted(
          `olpub:${norm(publisher)}:${genre ?? ''}:${lang}`,
          long,
          async () => {
            const sameKind = genre ? await quiet(olRail(`publisher:"${publisher}" subject:"${genre}"`, work, lang), []) : [];
            return sameKind.length >= 6 ? sameKind : olRail(`publisher:"${publisher}"`, work, lang);
          },
          noItems,
        ),
        [],
      );
      emit({ rails: [{ key: 'publisher', title: 'publisher', params: { name: publisher }, items }] });
    }),
  );
  await Promise.all(parts);
}
