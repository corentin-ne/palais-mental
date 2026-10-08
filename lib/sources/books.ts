/**
 * Books from the trackers people use: Goodreads (public shelves as RSS, or the export CSV),
 * Open Library's public reading log, BookWyrm (any instance, public shelves), Hardcover (with
 * your API token), and the export files of StoryGraph, LibraryThing, Libib and the like.
 */
import { parseCsv } from '../csv';
import { ExternalEntry, HttpError, MissingSetup, Status, anyDate, cleanIsbn, column, enc, fetchJson, fetchText, keyOf, rating10, sleep, xmlTag } from './common';

// ------------------------------------------------------------------ Goodreads
const GR_SHELVES: [string, Status][] = [
  ['read', 'watched'],
  ['currently-reading', 'watching'],
  ['to-read', 'planned'],
];

/** Goodreads: each public shelf's RSS feed, by the number in your profile link. */
export async function readGoodreads(userId: string): Promise<ExternalEntry[]> {
  const id = userId.trim().match(/^\d+/)?.[0];
  if (!id) throw new HttpError(404);
  const out = new Map<string, ExternalEntry>();
  for (const [shelf, status] of GR_SHELVES) {
    for (let page = 1; page <= 40; page++) {
      const xml = await fetchText(`https://www.goodreads.com/review/list_rss/${id}?shelf=${shelf}&per_page=100&page=${page}`);
      const items = xml.split('<item>').slice(1);
      for (const item of items) {
        const title = xmlTag(item, 'title');
        const bookId = xmlTag(item, 'book_id');
        if (!title || !bookId) continue;
        const key = `goodreads:${bookId}`;
        if (out.has(key)) continue;
        out.set(key, {
          key,
          kind: 'book',
          titles: [...new Set([title.replace(/\s*\([^)]*#\d+(\.\d+)?\)\s*$/, ''), title])],
          authors: [xmlTag(item, 'author_name')].filter((a): a is string => !!a),
          isbn: cleanIsbn(xmlTag(item, 'isbn13')) ?? cleanIsbn(xmlTag(item, 'isbn')),
          status,
          watchedAt: status === 'watched' ? anyDate(xmlTag(item, 'user_read_at')) ?? anyDate(xmlTag(item, 'user_date_added')) : undefined,
          rating: rating10(xmlTag(item, 'user_rating'), 2),
        });
      }
      if (items.length < 100) break;
      await sleep(500);
    }
  }
  return [...out.values()];
}

/** The library export (My Books › Import and export) — also the format StoryGraph, Hardcover and BookWyrm import. */
function goodreadsCsv(rows: Record<string, string>[]): ExternalEntry[] {
  const SHELF: Record<string, Status> = { read: 'watched', 'currently-reading': 'watching', 'to-read': 'planned', 'did-not-finish': 'dropped' };
  return rows
    .filter((r) => r.Title)
    .map((r) => {
      const status = SHELF[(r['Exclusive Shelf'] ?? '').trim()] ?? 'planned';
      return {
        key: `goodreads:${r['Book Id'] || keyOf('b', r.Title, r.Author).slice(2)}`,
        kind: 'book' as const,
        titles: [r.Title.replace(/\s*\([^)]*#\d+(\.\d+)?\)\s*$/, ''), r.Title],
        authors: [r.Author, ...(r['Additional Authors'] ?? '').split(',')].map((a) => a?.trim()).filter(Boolean),
        isbn: cleanIsbn(r.ISBN13) ?? cleanIsbn(r.ISBN),
        year: Number(r['Original Publication Year'] || r['Year Published']) || undefined,
        status,
        watchedAt: status === 'watched' ? anyDate(r['Date Read']) ?? anyDate(r['Date Added']) : undefined,
        rating: rating10(r['My Rating'], 2),
      };
    });
}

/** StoryGraph's export (Manage account › Export StoryGraph library). */
function storygraphCsv(rows: Record<string, string>[]): ExternalEntry[] {
  const STATUS: Record<string, Status> = { read: 'watched', 'currently-reading': 'watching', 'to-read': 'planned', 'did-not-finish': 'dropped', paused: 'watching' };
  return rows
    .filter((r) => r.Title)
    .map((r) => {
      const status = STATUS[(r['Read Status'] ?? '').trim()] ?? 'planned';
      return {
        key: `storygraph:${cleanIsbn(r['ISBN/UID']) ?? keyOf('b', r.Title, r.Authors).slice(2)}`,
        kind: 'book' as const,
        titles: [r.Title],
        authors: (r.Authors ?? '').split(',').map((a) => a.trim()).filter(Boolean),
        isbn: cleanIsbn(r['ISBN/UID']),
        status,
        watchedAt: status === 'watched' ? anyDate(r['Last Date Read']) ?? anyDate(r['Date Added']) : undefined,
        rating: rating10(r['Star Rating'], 2),
      };
    });
}

/** Anything else with a title and an ISBN or author (LibraryThing, Libib, Bookly, spreadsheets). */
function genericBooksCsv(rows: Record<string, string>[]): ExternalEntry[] {
  const out: ExternalEntry[] = [];
  for (const r of rows) {
    const title = column(r, /^(title|book title|titre)$/i);
    if (!title) continue;
    const author = column(r, /^(author|authors|auteur|primary author|creators?)$/i);
    const statusText = (column(r, /^(status|read status|exclusive shelf|shelf|collection|statut)$/i) ?? '').toLowerCase();
    const status: Status = /^read$|^finished|^lu$|complete/.test(statusText) ? 'watched' : /reading|progress|en cours/.test(statusText) ? 'watching' : /abandon|dnf|did not|dropped/.test(statusText) ? 'dropped' : 'planned';
    const isbn = cleanIsbn(column(r, /^isbn ?13$/i)) ?? cleanIsbn(column(r, /^(isbn|isbns|isbn\/uid|ean|upc)$/i)?.split(/[,;\s]/)[0]);
    out.push({
      key: `books:${isbn ?? keyOf('b', title, author).slice(2)}`,
      kind: 'book',
      titles: [title],
      authors: author ? [author.split(/[;|]/)[0].replace(/^(.+),\s*(.+)$/, '$2 $1').trim()] : [],
      isbn,
      status,
      watchedAt: anyDate(column(r, /^(date read|date finished|date completed|finished|end date|date lu)$/i)),
      rating: rating10(column(r, /^(rating|my rating|stars|note)$/i), 2),
    });
  }
  return out;
}

export function readBooksFile(name: string, text: string): ExternalEntry[] | undefined {
  if (/^\s*[[{]/.test(text)) return undefined;
  const rows = parseCsv(text);
  if (!rows.length) return undefined;
  const cols = Object.keys(rows[0]).map((c) => c.trim());
  if (cols.includes('Exclusive Shelf') && cols.includes('Title')) return goodreadsCsv(rows);
  if (cols.includes('Read Status') && cols.includes('ISBN/UID')) return storygraphCsv(rows);
  const lower = cols.map((c) => c.toLowerCase());
  const bookish = lower.some((c) => /isbn|^author|^auteur/.test(c)) && lower.some((c) => /^(title|book title|titre)$/.test(c));
  return bookish ? genericBooksCsv(rows) : undefined;
}

// ------------------------------------------------------------------ Open Library
/** Open Library's reading log, when it is public (Settings › Privacy). */
export async function readOpenLibrary(user: string): Promise<ExternalEntry[]> {
  const SHELVES: [string, Status][] = [
    ['already-read', 'watched'],
    ['currently-reading', 'watching'],
    ['want-to-read', 'planned'],
  ];
  const out: ExternalEntry[] = [];
  for (const [shelf, status] of SHELVES) {
    for (let page = 1; page <= 50; page++) {
      const json = await fetchJson<any>(`https://openlibrary.org/people/${enc(user.trim())}/books/${shelf}.json?page=${page}&limit=100`);
      const entries: any[] = json?.reading_log_entries ?? [];
      for (const e of entries) {
        const work = String(e?.work?.key ?? '').replace('/works/', '');
        if (!/^OL\d+W$/.test(work) || !e.work.title) continue;
        out.push({
          key: `openlibrary:${work}`,
          kind: 'book',
          titles: [e.work.title],
          authors: e.work.author_names ?? [],
          olWork: work,
          year: e.work.first_publish_year,
          status,
          watchedAt: status === 'watched' ? anyDate(String(e.logged_date ?? '').split(',')[0]) : undefined,
        });
      }
      if (entries.length < 100) break;
      await sleep(400);
    }
  }
  return out;
}

// ------------------------------------------------------------------ BookWyrm
/** "name@instance", "@name@instance" or a profile link → the instance and the name. */
export function bookwyrmUser(input: string) {
  const v = input.trim().replace(/^@/, '');
  const link = v.match(/^(?:https?:\/\/)?([^/]+)\/user\/([^/?#]+)/i);
  if (link) return { host: link[1], name: link[2] };
  const at = v.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (at) return { host: at[2], name: at[1] };
  return { host: 'bookwyrm.social', name: v };
}

/** BookWyrm (the federated Goodreads alternative): public shelves through ActivityPub. */
export async function readBookwyrm(user: string): Promise<ExternalEntry[]> {
  const { host, name } = bookwyrmUser(user);
  const SHELVES: [string, Status][] = [
    ['read', 'watched'],
    ['reading', 'watching'],
    ['to-read', 'planned'],
    ['stopped-reading', 'dropped'],
  ];
  const headers = { Accept: 'application/activity+json' };
  const out: ExternalEntry[] = [];
  for (const [shelf, status] of SHELVES) {
    // Pages are built here: some instances link the next page of a shelf to a wrong address.
    for (let page = 1; page <= 100; page++) {
      const json: any = await fetchJson(`https://${host}/user/${enc(name)}/shelf/${shelf}?page=${page}`, { headers }).catch((err) => {
        // A shelf you never used, or the end of one: what was read so far stands.
        if (err instanceof HttpError && err.status === 404 && (page > 1 || shelf !== 'read')) return null;
        throw err;
      });
      const items: any[] = json?.orderedItems ?? [];
      for (const b of items) {
        if (!b?.title) continue;
        out.push({
          key: `bookwyrm:${b.id ?? keyOf('b', b.title).slice(2)}`,
          kind: 'book',
          titles: [b.title, b.subtitle ? `${b.title}: ${b.subtitle}` : ''].filter(Boolean),
          isbn: cleanIsbn(b.isbn13) ?? cleanIsbn(b.isbn10),
          status,
        });
      }
      if (!items.length || !json?.next) break;
      await sleep(300);
    }
  }
  return out;
}

// ------------------------------------------------------------------ Hardcover
/** Hardcover: your shelves through its GraphQL API, with the token from Settings › API. */
export async function readHardcover(token?: string): Promise<ExternalEntry[]> {
  if (!token) throw new MissingSetup('token');
  const auth = token.trim().replace(/^bearer\s+/i, '');
  const query = `query { me { user_books(limit: 2000) { id status_id rating last_read_date date_added
    book { title release_year contributions { author { name } } } edition { isbn_13 isbn_10 } } } }`;
  const r = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', authorization: `Bearer ${auth}` },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new HttpError(r.status);
  const json: any = await r.json();
  if (json?.errors?.length) throw new HttpError(401);
  const me = Array.isArray(json?.data?.me) ? json.data.me[0] : json?.data?.me;
  const STATUS: Record<number, Status> = { 1: 'planned', 2: 'watching', 3: 'watched', 4: 'watching', 5: 'dropped' };
  return (me?.user_books ?? [])
    .filter((ub: any) => ub?.book?.title && STATUS[ub.status_id])
    .map((ub: any) => ({
      key: `hardcover:${ub.id}`,
      kind: 'book' as const,
      titles: [ub.book.title],
      authors: (ub.book.contributions ?? []).map((c: any) => c?.author?.name).filter(Boolean),
      isbn: cleanIsbn(ub.edition?.isbn_13) ?? cleanIsbn(ub.edition?.isbn_10),
      year: ub.book.release_year ?? undefined,
      status: STATUS[ub.status_id],
      watchedAt: ub.status_id === 3 ? anyDate(ub.last_read_date) ?? anyDate(ub.date_added) : undefined,
      rating: rating10(ub.rating, 2),
    }));
}
