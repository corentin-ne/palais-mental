/**
 * Connections to other trackers: what each service says you watched, read or played (read by
 * `sources/`) is matched to a title here and merged in. Syncing only ever adds: titles missing
 * here are added, episodes and films watched elsewhere are marked, nothing is removed or unmarked.
 *
 * The other direction needs the service's own login, so it goes through their import pages:
 * "Export what's missing" writes a file (Letterboxd CSV, MyAnimeList XML) with only what that
 * service doesn't have yet.
 */
import i18n from '@/locales/i18n';
import { SearchResult, fetchMovie, fetchShow, getJson, imdbTitle, norm, quiet, searchMovies, searchShows, tmdb, tvmazeIdByImdb } from './api';
import { deliver } from './backup';
import { fetchBook, searchBooks } from './books';
import { toCsv } from './csv';
import { fetchGame, searchGames } from './games';
import { hasAired, seasonsOf, sortEpisodes } from './progress';
import { readAnilist, readMal } from './sources/anime';
import { readBookwyrm, readBooksFile, readGoodreads, readHardcover, readOpenLibrary } from './sources/books';
import { DAY, ExternalEntry, HttpError, MissingSetup, enc, sleep } from './sources/common';
import { letterboxdShortLink, readDiaryFile, readLetterboxd, readSerializd } from './sources/diaries';
import { readGamesFile, readRetroAchievements, readSteam } from './sources/games';
import { readJellyfin, readKitsu, readPlex, readScreenFile, readTrakt } from './sources/screen';
import { seasonHint, stripSeason } from './sources/seasons';
import { usernameFrom } from './sources/username';
import { Show } from './types';
import { useLibrary } from '@/store/useLibrary';
import { Account, Service, useConnections } from '@/store/useConnections';

export { HttpError, MissingSetup } from './sources/common';
export { usernameFrom };

export interface SyncResult {
  total: number;
  added: number;
  updated: number;
  unmatched: string[];
}

export type OnProgress = (done: number, total: number) => void;

const RETRY_UNMATCHED = 7 * DAY;
const tmdbKey = () => useLibrary.getState().settings.tmdbKey || undefined;
const near = (a?: number, b?: number) => !a || !b || Math.abs(a - b) <= 1;

/** What each service needs besides a username, and how it is read. */
export const SETUP: Record<Service, { username: boolean; token?: 'required' | 'optional'; server?: boolean }> = {
  letterboxd: { username: true },
  serializd: { username: true },
  trakt: { username: true, token: 'required' },
  mal: { username: true },
  anilist: { username: true },
  kitsu: { username: true },
  plex: { username: false, token: 'required', server: true },
  jellyfin: { username: false, token: 'required', server: true },
  emby: { username: false, token: 'required', server: true },
  goodreads: { username: true },
  openlibrary: { username: true },
  bookwyrm: { username: true },
  hardcover: { username: false, token: 'required' },
  steam: { username: true, token: 'optional' },
  retroachievements: { username: true, token: 'required' },
};

export const READERS: Record<Service, (a: Account) => Promise<ExternalEntry[]>> = {
  letterboxd: (a) => readLetterboxd(a.username),
  mal: (a) => readMal(a.username),
  anilist: (a) => readAnilist(a.username),
  serializd: (a) => readSerializd(a.username),
  trakt: (a) => readTrakt(a.username, a.token),
  kitsu: (a) => readKitsu(a.username),
  plex: (a) => readPlex(a.server, a.token),
  jellyfin: (a) => readJellyfin(a.server, a.token, a.username, 'jellyfin'),
  emby: (a) => readJellyfin(a.server, a.token, a.username, 'emby'),
  goodreads: (a) => readGoodreads(a.username),
  openlibrary: (a) => readOpenLibrary(a.username),
  bookwyrm: (a) => readBookwyrm(a.username),
  hardcover: (a) => readHardcover(a.token),
  steam: (a) => readSteam(a.username, a.token),
  retroachievements: (a) => readRetroAchievements(a.username, a.token),
};

/** Whether the account has what its service needs to be read. */
export function isSetUp(service: Service, a?: Account) {
  const need = SETUP[service];
  return !!a && (!need.username || !!a.username) && (need.token !== 'required' || !!a.token) && (!need.server || !!a.server);
}

/**
 * Export files: Trakt, TV Time and Netflix, then book lists (Goodreads, StoryGraph…), game lists
 * (HowLongToBeat, Grouvee, Backloggd, Playnite…), then diaries (Letterboxd, IMDb, Serializd).
 * Anything else is ignored.
 */
export const readExportFile = (name: string, text: string): ExternalEntry[] =>
  readScreenFile(name, text) ?? readBooksFile(name, text) ?? readGamesFile(name, text) ?? readDiaryFile(name, text);

// ------------------------------------------------------------------ Matching
interface Found {
  id: string;
  /** The title is the same, not just close: safe to mark episodes. */
  exact: boolean;
  hint?: SearchResult;
}

async function matchMovie(e: ExternalEntry): Promise<Found | undefined> {
  const movies = useLibrary.getState().movies;
  const list = Object.values(movies);
  const titles = e.titles.map(norm);
  const mine =
    (e.imdbId && list.find((m) => m.imdbId === e.imdbId)) ||
    (e.tmdbId && movies[`tmdb-${e.tmdbId}`]) ||
    list.find((m) => titles.includes(norm(m.title)) && near(m.year, e.year));
  if (mine) return { id: mine.id, exact: true };
  const key = tmdbKey();
  if (e.tmdbId && key) return { id: `tmdb-${e.tmdbId}`, exact: true };
  if (e.imdbId) return { id: `imdb-${e.imdbId}`, exact: true, hint: await imdbTitle(e.imdbId) };
  for (const title of e.titles) {
    const results = await quiet(searchMovies(title, { tmdbKey: key, lang: i18n.language }), []);
    const best = results.find((r) => norm(r.title) === norm(title) && near(r.year, e.year)) ?? (e.year ? results.find((r) => r.year === e.year) : undefined);
    if (best) return { id: best.id, exact: true, hint: best };
  }
  return undefined;
}

async function matchShow(e: ExternalEntry): Promise<Found | undefined> {
  const shows = Object.values(useLibrary.getState().shows);
  if (e.imdbId) {
    const mine = shows.find((s) => s.imdbId === e.imdbId);
    if (mine) return { id: mine.id, exact: true };
    const id = await tvmazeIdByImdb(e.imdbId);
    if (id) return { id: String(id), exact: true };
  }
  // Serializd ids are TMDB ids: with a key, TMDB gives the IMDb id and TVmaze finds it by that.
  const key = tmdbKey();
  if (e.tmdbId && key) {
    const ext = await quiet(tmdb<{ imdb_id?: string | null }>(`/tv/${e.tmdbId}/external_ids`, key), null);
    if (ext?.imdb_id) {
      const mine = shows.find((s) => s.imdbId === ext.imdb_id);
      if (mine) return { id: mine.id, exact: true };
      const id = await tvmazeIdByImdb(ext.imdb_id);
      if (id) return { id: String(id), exact: true };
    }
  }
  const titles = [...new Set(e.titles.map(stripSeason).filter(Boolean))];
  const mine = shows.find((s) => titles.some((t) => norm(t) === norm(s.title)));
  if (mine) return { id: mine.id, exact: true };
  let loose: Found | undefined;
  for (const title of titles) {
    const results = await quiet(searchShows(title), []);
    const exact = results.find((r) => norm(r.title) === norm(title) && near(r.year, e.year ? e.year : r.year));
    if (exact) return { id: exact.id, exact: true };
    const first = results[0];
    if (!loose && first && (norm(first.title).includes(norm(title)) || norm(title).includes(norm(first.title)))) loose = { id: first.id, exact: false };
    await sleep(250);
  }
  return loose;
}

/** A book: by Open Library work, else through the ISBN, else by title and author. */
async function matchBook(e: ExternalEntry): Promise<Found | undefined> {
  const books = Object.values(useLibrary.getState().books);
  const titles = e.titles.map(norm);
  const mine =
    (e.olWork && books.find((b) => b.source === 'ol' && b.sourceId === e.olWork)) ||
    (e.isbn && books.find((b) => b.isbn === e.isbn)) ||
    books.find((b) => titles.includes(norm(b.title)) && (!e.authors?.length || b.authors.some((a) => e.authors!.some((x) => norm(x).split(' ').pop() === norm(a).split(' ').pop()))));
  if (mine) return { id: mine.id, exact: true };
  if (e.olWork) return { id: `ol-${e.olWork}`, exact: true };
  if (e.isbn) {
    const ed = await quiet(getJson<{ works?: { key?: string }[] }>(`https://openlibrary.org/isbn/${e.isbn}.json`), null);
    const work = ed?.works?.[0]?.key?.replace('/works/', '');
    if (work) return { id: `ol-${work}`, exact: true };
  }
  const author = e.authors?.[0];
  for (const title of e.titles.slice(0, 2)) {
    const results = await quiet(searchBooks(author ? `${title} ${author}` : title, i18n.language), []);
    const surname = author ? norm(author).split(' ').pop()! : '';
    const best =
      results.find((r) => norm(r.title) === norm(title) && (!surname || norm(r.subtitle ?? '').includes(surname))) ??
      results.find((r) => norm(r.title).startsWith(norm(title)) && (!surname || norm(r.subtitle ?? '').includes(surname)));
    if (best) return { id: best.id, exact: true };
  }
  return undefined;
}

/** A game: by Steam app id, else by title (Steam and Wikidata, consoles included). */
async function matchGame(e: ExternalEntry): Promise<Found | undefined> {
  const games = Object.values(useLibrary.getState().games);
  const titles = e.titles.map(norm);
  const mine = (e.steamId && games.find((g) => g.steamId === e.steamId)) || games.find((g) => titles.includes(norm(g.title)));
  if (mine) return { id: mine.id, exact: true };
  if (e.steamId) return { id: `steam-${e.steamId}`, exact: true };
  for (const title of e.titles.slice(0, 2)) {
    const results = await quiet(searchGames(title, i18n.language), []);
    const clean = (t: string) => norm(t).replace(/(the|edition|remastered|definitive|goty|hd)/g, '').replace(/\s+/g, ' ').trim();
    const best = results.find((r) => norm(r.title) === norm(title)) ?? results.find((r) => clean(r.title) === clean(title));
    if (best) return { id: best.id, exact: true };
  }
  return undefined;
}

/** Books and games: added if missing; status, rating, page and playtime only ever move forward. */
async function applyShelf(e: ExternalEntry, found: Found, result: SyncResult) {
  const isBook = e.kind === 'book';
  const lib = useLibrary.getState();
  const existed = !!(isBook ? lib.books[found.id] : lib.games[found.id]);
  if (!existed) {
    if (isBook) {
      const { book, redirect } = await fetchBook(found.id, i18n.language);
      if (redirect) return applyShelf(e, { ...found, id: redirect }, result);
      useLibrary.getState().addBook(book);
    } else {
      const { game, redirect } = await fetchGame(found.id, i18n.language);
      if (redirect) return applyShelf(e, { ...found, id: redirect }, result);
      useLibrary.getState().addGame(game);
    }
    result.added++;
  }
  const l = useLibrary.getState();
  const item = isBook ? l.books[found.id] : l.games[found.id];
  if (!item) return found.id;
  const setStatus = isBook ? l.setBookStatus : l.setGameStatus;
  let changed = false;
  if (e.status === 'watched' && !item.finishedAt) {
    setStatus(item.id, 'finished', e.watchedAt);
    changed = true;
  } else if (e.status === 'watching' && !item.startedAt && !item.finishedAt) {
    setStatus(item.id, 'started', e.watchedAt);
    changed = true;
  } else if (e.status === 'dropped' && !existed) {
    setStatus(item.id, 'dropped', e.watchedAt);
  }
  if (isBook && e.page && e.page > ((item as { page?: number }).page ?? 0)) {
    l.setBookPage(item.id, e.page);
    changed = true;
  }
  if (!isBook) {
    const g = useLibrary.getState().games[item.id];
    const patch: { hours?: number; percent?: number } = {};
    if (e.hours && e.hours > (g?.hours ?? 0)) patch.hours = e.hours;
    if (e.percent && e.percent > (g?.percent ?? 0) && !g?.finishedAt) patch.percent = e.percent;
    if (patch.hours || patch.percent) {
      l.setGameProgress(item.id, patch);
      changed = true;
    }
  }
  if (e.rating && !item.rating) {
    (isBook ? l.setBookRating : l.setGameRating)(item.id, e.rating);
    changed = true;
  }
  if (changed && existed) result.updated++;
  return found.id;
}

// ------------------------------------------------------------------ Applying, additively
const sigOf = (e: ExternalEntry) =>
  `${e.status}|${e.progress ?? ''}|${e.rating ?? ''}|${e.episodes?.length ?? ''}|${e.seasons?.length ?? ''}|${e.episodeNames?.length ?? ''}|${e.hours ?? ''}|${e.percent ?? ''}|${e.page ?? ''}`;

/** Episodes an outside entry says you saw: that season if the title names one, else from the start. */
function episodesFor(show: Show, e: ExternalEntry, season?: number) {
  const all = sortEpisodes(show.episodes).filter((ep) => hasAired(ep));
  if (e.episodeNames?.length) {
    // Known by name only (Netflix): the season when given, else anywhere in the show.
    const out: { id: number; at?: number }[] = [];
    for (const x of e.episodeNames) {
      const name = norm(x.name);
      const ep = all.find((ep) => (x.season == null || ep.season === x.season) && norm(ep.name) === name) ?? all.find((ep) => (x.season == null || ep.season === x.season) && name.length > 5 && norm(ep.name).includes(name));
      if (ep) out.push({ id: ep.id, at: x.at });
    }
    return out;
  }
  if (e.episodes || e.seasons) {
    const logged = new Set((e.episodes ?? []).map((x) => `${x.season}x${x.number}`));
    const whole = new Set((e.seasons ?? []).map((x) => x.season));
    const dateOfEp = new Map((e.episodes ?? []).map((x) => [`${x.season}x${x.number}`, x.at]));
    const dateOfSeason = new Map((e.seasons ?? []).map((x) => [x.season, x.at]));
    return all
      .filter((ep) => whole.has(ep.season) || logged.has(`${ep.season}x${ep.number}`))
      .map((ep) => ({ id: ep.id, at: dateOfEp.get(`${ep.season}x${ep.number}`) ?? dateOfSeason.get(ep.season) ?? e.watchedAt }));
  }
  const pool = season && season > 1 ? all.filter((ep) => ep.season === season) : all;
  if (season && season > 1 && !pool.length) return [];
  const count = e.status === 'watched' ? (e.total ?? pool.length) : (e.progress ?? 0);
  return pool.slice(0, count).map((ep) => ({ id: ep.id, at: e.watchedAt }));
}

async function applyOne(e: ExternalEntry, found: Found, season: number | undefined, result: SyncResult) {
  const lib = useLibrary.getState();
  if (e.kind === 'movie') {
    let movie = lib.movies[found.id];
    if (!movie) {
      const { movie: data } = await fetchMovie(found.id, { tmdbKey: tmdbKey(), lang: i18n.language, hint: found.hint });
      useLibrary.getState().addMovie({ ...data, poster: data.poster ?? found.hint?.poster });
      result.added++;
    }
    const lib2 = useLibrary.getState();
    movie = lib2.movies[found.id];
    if (!movie) return;
    let changed = false;
    if (e.status === 'watched' && !movie.watchedAt) {
      lib2.setMovieWatched(movie.id, true, e.watchedAt);
      changed = true;
    }
    if (e.rating && !movie.rating) {
      lib2.setMovieRating(movie.id, e.rating);
      changed = true;
    }
    if (changed && lib.movies[found.id]) result.updated++;
    return;
  }

  const existed = !!lib.shows[found.id];
  if (!existed) {
    const { show } = await fetchShow(Number(found.id), tmdbKey());
    useLibrary.getState().addShow(show);
    if (e.status === 'dropped') useLibrary.getState().setDropped(show.id, true);
    result.added++;
  }
  const lib2 = useLibrary.getState();
  const show = lib2.shows[found.id];
  if (!show) return;
  let changed = false;
  // A loosely matched title could be another season or a spin-off: add it, but leave its ticks alone.
  if (found.exact) {
    const todo = episodesFor(show, e, season).filter((x) => !show.watched[x.id]);
    // One write per date, so each episode keeps the day you logged it.
    const byDate = new Map<number | undefined, number[]>();
    for (const x of todo) byDate.set(x.at, [...(byDate.get(x.at) ?? []), x.id]);
    for (const [at, ids] of byDate) lib2.setEpisodes(show.id, ids, true, at);
    if (todo.length) changed = true;
  }
  if (e.rating && !show.rating && (!season || season === 1)) {
    lib2.setShowRating(show.id, e.rating);
    changed = true;
  }
  if (changed && existed) result.updated++;
}

/**
 * Merge outside entries into the library. Unchanged entries since the last sync are skipped;
 * titles not found are looked for again after a week, or right away when `retry` (a sync you asked for).
 */
export async function applyEntries(entries: ExternalEntry[], onProgress?: OnProgress, retry = false): Promise<SyncResult> {
  const result: SyncResult = { total: entries.length, added: 0, updated: 0, unmatched: [] };
  const { setMatches } = useConnections.getState();
  let done = 0;
  for (const e of entries) {
    onProgress?.(done++, entries.length);
    const prev = useConnections.getState().matches[e.key];
    const sig = sigOf(e);
    const lib = useLibrary.getState();
    const inLibrary = (id: string) => !!{ movie: lib.movies, show: lib.shows, book: lib.books, game: lib.games }[e.kind][id];
    const present = prev?.id ? inLibrary(prev.id) : false;
    // Matched to something already here: nothing was asked of any source, no need to pace.
    let local = false;
    // Unchanged since last time: leave it (and leave alone anything you removed here since).
    if (prev?.id && prev.sig === sig) continue;
    if (!retry && prev && prev.id === null && prev.sig === sig && Date.now() - prev.at < RETRY_UNMATCHED) {
      result.unmatched.push(e.titles[0] ?? e.key);
      continue;
    }
    const season = e.kind === 'show' ? e.titles.map(seasonHint).find(Boolean) : undefined;
    try {
      const found: Found | undefined = prev?.id && present ? { id: prev.id, exact: true } : await matchEntry(e);
      if (!found) {
        setMatches({ [e.key]: { id: null, kind: e.kind, season, malId: e.malId, sig, at: Date.now() } });
        result.unmatched.push(e.titles[0] ?? e.key);
        continue;
      }
      local = inLibrary(found.id) && (present || !found.hint);
      // A Wikidata book or game may open as its Open Library or Steam twin: keep the id it got.
      const id = e.kind === 'book' || e.kind === 'game' ? await applyShelf(e, found, result) : (await applyOne(e, found, season, result), found.id);
      setMatches({ [e.key]: { id: id ?? found.id, kind: e.kind, season, malId: e.malId, sig, at: Date.now() } });
    } catch {
      // Offline or rate limited: this entry is retried next sync.
      result.unmatched.push(e.titles[0] ?? e.key);
    }
    if (!local) await sleep(e.kind === 'show' || e.kind === 'book' ? 400 : 150);
  }
  onProgress?.(entries.length, entries.length);
  return result;
}
const matchEntry = (e: ExternalEntry) => (e.kind === 'movie' ? matchMovie(e) : e.kind === 'show' ? matchShow(e) : e.kind === 'book' ? matchBook(e) : matchGame(e));

// ------------------------------------------------------------------ Sync
let running: Promise<SyncResult> | undefined;

export function syncService(service: Service, onProgress?: OnProgress, manual = true): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    const { accounts, setAccount } = useConnections.getState();
    const account = accounts[service];
    if (!account || !isSetUp(service, account)) throw new MissingSetup(SETUP[service].server && !account?.server ? 'server' : account?.username || !SETUP[service].username ? 'token' : 'username');
    // Accounts saved by 1.1.1 may hold the whole pasted link.
    let user = usernameFrom(service, account.username);
    try {
      if (service === 'letterboxd' && /boxd\.it\//i.test(user)) user = await letterboxdShortLink(user);
      const entries = await READERS[service]({ ...account, username: user });
      if (user !== account.username) setAccount(service, { username: user });
      const result = await applyEntries(entries, onProgress, manual);
      setAccount(service, { lastSync: Date.now(), lastChanges: result.added + result.updated, lastUnmatched: result.unmatched.length, lastError: false, lastErrorStatus: undefined });
      return result;
    } catch (err) {
      setAccount(service, { lastError: true, lastErrorStatus: err instanceof HttpError ? err.status : 0 });
      throw err;
    }
  })().finally(() => {
    running = undefined;
  });
  return running;
}

/** Every connected account in turn, now; one that fails doesn't stop the others. */
export async function syncAll(onProgress?: OnProgress, onService?: (service: Service) => void): Promise<SyncResult> {
  const { accounts } = useConnections.getState();
  const total: SyncResult = { total: 0, added: 0, updated: 0, unmatched: [] };
  let failed = 0;
  const list = (Object.entries(accounts) as [Service, Account][]).filter(([s, a]) => isSetUp(s, a));
  for (const [service] of list) {
    onService?.(service);
    try {
      const r = await syncService(service, onProgress);
      total.total += r.total;
      total.added += r.added;
      total.updated += r.updated;
      total.unmatched.push(...r.unmatched);
    } catch {
      failed++;
    }
  }
  if (failed && failed === list.length) throw new Error('All failed');
  return total;
}

/** Background pass on launch: every connected account, at most twice a day. */
export async function autoSyncAccounts() {
  const { accounts, autoSync } = useConnections.getState();
  if (!autoSync) return;
  for (const [service, account] of Object.entries(accounts) as [Service, NonNullable<(typeof accounts)[Service]>][]) {
    if (!isSetUp(service, account) || (account.lastSync && Date.now() - account.lastSync < DAY / 2)) continue;
    await quiet(syncService(service, undefined, false), undefined);
  }
}

export async function importExportFiles(files: { name: string; text: string }[], onProgress?: OnProgress) {
  const entries = files.flatMap((f) => readExportFile(f.name, f.text));
  if (!entries.length) throw new Error('Nothing recognised');
  return applyEntries(entries, onProgress, true);
}

// ------------------------------------------------------------------ The other way: files for their import pages
const known = (prefix: string) => {
  const out = new Set<string>();
  for (const [key, m] of Object.entries(useConnections.getState().matches)) if (key.startsWith(`${prefix}:`) && m.id) out.add(`${m.id}#${m.season ?? 1}`);
  return out;
};
const ymd = (ms?: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const stamp = () => new Date().toISOString().slice(0, 10);

/** Watched films Letterboxd doesn't have yet, in its import format (letterboxd.com/import). */
export async function exportForLetterboxd() {
  const onLetterboxd = known('letterboxd');
  const films = Object.values(useLibrary.getState().movies).filter((m) => m.watchedAt && !onLetterboxd.has(`${m.id}#1`));
  const rows: unknown[][] = [['Title', 'Year', 'imdbID', 'tmdbID', 'WatchedDate', 'Rating10']];
  for (const m of films) rows.push([m.title, m.year ?? '', m.imdbId ?? '', m.source === 'tmdb' ? m.sourceId : '', ymd(m.watchedAt), m.rating ?? '']);
  await deliver(`palais-mental-letterboxd-${stamp()}.csv`, toCsv(rows), 'text/csv');
  return films.length;
}

const isAnime = (show: Show, linked: Set<string>) => show.genres.includes('Anime') || [...linked].some((k) => k.startsWith(`${show.id}#`));

/** MyAnimeList id of a season through Jikan (the keyless MAL mirror), 1 call a second. */
async function malIdFor(title: string, season: number) {
  const q = season > 1 ? `${title} season ${season}` : title;
  const json = await quiet(getJson<any>(`https://api.jikan.moe/v4/anime?q=${enc(q)}&limit=5`), null);
  const list: any[] = (json?.data ?? []).filter((a: any) => ['TV', 'ONA'].includes(a?.type));
  const want = norm(q);
  const exact = list.find((a) => [a.title, a.title_english, ...(a.titles ?? []).map((t: any) => t?.title)].some((t) => typeof t === 'string' && norm(t) === want));
  return (exact ?? list[0])?.mal_id as number | undefined;
}

const xmlText = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

/**
 * Anime seasons the target list doesn't have yet, as a MyAnimeList export file. MyAnimeList
 * (myanimelist.net/import.php) and AniList (Settings › Import) both read it.
 */
export async function exportForAnimeList(target: 'mal' | 'anilist', onProgress?: OnProgress) {
  const there = known(target);
  const linked = new Set([...known('mal'), ...known('anilist')]);
  const malIds = new Map<string, number>();
  for (const m of Object.values(useConnections.getState().matches)) if (m.id && m.malId) malIds.set(`${m.id}#${m.season ?? 1}`, m.malId);

  const todo: { show: Show; season: number; watched: number; total: number }[] = [];
  for (const show of Object.values(useLibrary.getState().shows)) {
    if (!isAnime(show, linked)) continue;
    for (const { season, episodes } of seasonsOf(show.episodes)) {
      if (there.has(`${show.id}#${season}`)) continue;
      const watched = episodes.filter((e) => show.watched[e.id]).length;
      if (!watched && season > 1) continue;
      todo.push({ show, season, watched, total: episodes.length });
    }
  }

  const items: string[] = [];
  let i = 0;
  for (const { show, season, watched, total } of todo) {
    onProgress?.(i++, todo.length);
    let malId = malIds.get(`${show.id}#${season}`);
    if (!malId) {
      malId = await malIdFor(show.title, season);
      await sleep(1100);
    }
    if (!malId) continue;
    const ended = show.status === 'Ended' || seasonsOf(show.episodes).some((s) => s.season > season);
    const status = show.droppedAt ? 'Dropped' : watched === 0 ? 'Plan to Watch' : watched >= total && ended ? 'Completed' : 'Watching';
    const last = Math.max(0, ...show.episodes.filter((e) => e.season === season && show.watched[e.id]).map((e) => show.watched[e.id]));
    items.push(
      [
        '  <anime>',
        `    <series_animedb_id>${malId}</series_animedb_id>`,
        `    <series_title>${xmlText(season > 1 ? `${show.title} Season ${season}` : show.title)}</series_title>`,
        `    <my_watched_episodes>${watched}</my_watched_episodes>`,
        '    <my_start_date>0000-00-00</my_start_date>',
        `    <my_finish_date>${status === 'Completed' && last ? ymd(last) : '0000-00-00'}</my_finish_date>`,
        `    <my_score>${season === 1 && show.rating ? show.rating : 0}</my_score>`,
        `    <my_status>${status}</my_status>`,
        '    <update_on_import>0</update_on_import>',
        '  </anime>',
      ].join('\n'),
    );
  }
  onProgress?.(todo.length, todo.length);
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n  <myinfo>\n    <user_export_type>1</user_export_type>\n  </myinfo>\n${items.join('\n')}\n</myanimelist>\n`;
  await deliver(`palais-mental-${target}-${stamp()}.xml`, xml, 'application/xml');
  return items.length;
}

/**
 * Your books in Goodreads' export format: Goodreads (My Books › Import), StoryGraph, Hardcover
 * and BookWyrm all import it. Only books the target doesn't already list here are written.
 */
export async function exportBooksCsv(target: 'goodreads' | 'storygraph' | 'hardcover' | 'bookwyrm' = 'goodreads') {
  const there = new Set([...known(target)].map((k) => k.split('#')[0]));
  const books = Object.values(useLibrary.getState().books).filter((b) => !there.has(b.id));
  const rows: unknown[][] = [['Book Id', 'Title', 'Author', 'ISBN', 'ISBN13', 'My Rating', 'Number of Pages', 'Year Published', 'Date Read', 'Date Added', 'Bookshelves', 'Exclusive Shelf']];
  for (const b of books) {
    const shelf = b.finishedAt ? 'read' : b.droppedAt ? 'did-not-finish' : b.startedAt || b.page ? 'currently-reading' : 'to-read';
    const isbn13 = b.isbn?.length === 13 ? b.isbn : '';
    const isbn10 = b.isbn?.length === 10 ? b.isbn : '';
    // Goodreads rates in whole stars; StoryGraph reads quarter stars from the same column.
    const stars = b.rating ? Math.max(1, Math.round(b.rating / 2)) : 0;
    rows.push(['', b.title, b.authors[0] ?? '', isbn10 ? `="${isbn10}"` : '', isbn13 ? `="${isbn13}"` : '', stars, b.pages ?? '', b.year ?? '', ymd(b.finishedAt).replace(/-/g, '/'), ymd(b.addedAt).replace(/-/g, '/'), shelf, shelf]);
  }
  await deliver(`palais-mental-books-${stamp()}.csv`, toCsv(rows), 'text/csv');
  return books.length;
}

/**
 * Films and series you watched or rated, in IMDb's ratings format: Trakt (Settings › Import),
 * Simkl and most trackers import it. Titles without an IMDb id can't be written.
 */
export async function exportImdbCsv() {
  const { movies, shows } = useLibrary.getState();
  const rows: unknown[][] = [['Const', 'Your Rating', 'Date Rated', 'Title', 'URL', 'Title Type', 'Year']];
  let count = 0;
  for (const m of Object.values(movies)) {
    if (!m.imdbId || (!m.watchedAt && !m.rating)) continue;
    rows.push([m.imdbId, m.rating ?? '', ymd(m.watchedAt ?? m.addedAt), m.title, `https://www.imdb.com/title/${m.imdbId}/`, 'Movie', m.year ?? '']);
    count++;
  }
  for (const s of Object.values(shows)) {
    if (!s.imdbId || (!Object.keys(s.watched).length && !s.rating)) continue;
    rows.push([s.imdbId, s.rating ?? '', ymd(Math.max(s.addedAt, ...Object.values(s.watched))), s.title, `https://www.imdb.com/title/${s.imdbId}/`, 'TV Series', s.year ?? '']);
    count++;
  }
  await deliver(`palais-mental-imdb-${stamp()}.csv`, toCsv(rows), 'text/csv');
  return count;
}
