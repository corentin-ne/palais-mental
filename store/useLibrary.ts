import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LanguagePreference } from '@/locales/i18n';
import { lazyStorage } from '@/lib/storage';
import { Book, EpisodeNote, Game, Movie, Settings, Show } from '@/lib/types';

export type ShowData = Omit<Show, 'watched' | 'addedAt' | 'droppedAt' | 'rating' | 'review' | 'reviewedAt' | 'notes'>;
export type MovieData = Omit<Movie, 'watchedAt' | 'addedAt' | 'rating' | 'review' | 'reviewedAt'>;
type Progressless = 'touchedAt' | 'startedAt' | 'pausedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'review' | 'reviewedAt' | 'addedAt';
export type BookData = Omit<Book, Progressless | 'page'>;
export type GameData = Omit<Game, Progressless | 'hours' | 'percent'>;
export type ShelfStatus = 'want' | 'started' | 'paused' | 'finished' | 'dropped';

export interface LibraryData {
  shows: Record<string, Show>;
  movies: Record<string, Movie>;
  /** Absent from backups made before 1.2. */
  books?: Record<string, Book>;
  games?: Record<string, Game>;
}

export interface Refreshed {
  shows: ShowData[];
  movies: MovieData[];
  books: BookData[];
  games: GameData[];
}

interface LibraryState extends LibraryData {
  books: Record<string, Book>;
  games: Record<string, Game>;
  settings: Settings;
  language: LanguagePreference;

  addShow: (data: ShowData) => void;
  updateShow: (data: ShowData) => void;
  removeShow: (id: string) => Show | undefined;
  restoreShow: (show: Show) => void;
  /** `at` backdates newly watched episodes (imports); already watched ones keep their date. */
  setEpisodes: (showId: string, episodeIds: number[], watched: boolean, at?: number) => void;
  toggleEpisode: (showId: string, episodeId: number) => boolean;
  setDropped: (showId: string, dropped: boolean) => void;
  /** Patch an episode's note; a note left with neither rating nor text is removed. */
  setEpisodeNote: (showId: string, episodeId: number, patch: Partial<Omit<EpisodeNote, 'at'>>) => void;
  setShowReview: (showId: string, review: string) => void;

  addMovie: (data: MovieData) => void;
  updateMovie: (data: MovieData) => void;
  removeMovie: (id: string) => Movie | undefined;
  restoreMovie: (movie: Movie) => void;
  setMovieWatched: (id: string, watched: boolean, at?: number) => void;
  setShowRating: (id: string, rating: number | undefined) => void;
  setMovieRating: (id: string, rating: number | undefined) => void;
  setMovieReview: (id: string, review: string) => void;
  /** Several films at once (series found in the background), without touching anything else. */
  patchMovies: (patches: Record<string, Partial<Movie>>) => void;

  addBook: (data: BookData) => void;
  updateBook: (data: BookData) => void;
  removeBook: (id: string) => Book | undefined;
  restoreBook: (book: Book) => void;
  /** The page you are at; reaching the last page doesn't finish the book on its own. */
  setBookPage: (id: string, page: number) => void;
  setBookStatus: (id: string, status: ShelfStatus, at?: number) => void;
  setBookRating: (id: string, rating: number | undefined) => void;
  setBookReview: (id: string, review: string) => void;

  addGame: (data: GameData) => void;
  updateGame: (data: GameData) => void;
  removeGame: (id: string) => Game | undefined;
  restoreGame: (game: Game) => void;
  setGameProgress: (id: string, patch: { hours?: number; percent?: number }) => void;
  setGameStatus: (id: string, status: ShelfStatus, at?: number) => void;
  setGameRating: (id: string, rating: number | undefined) => void;
  setGameReview: (id: string, review: string) => void;

  /** Refreshed metadata for many entries in one change (a refresh pass); entries removed meanwhile are left out. */
  updateMany: (fresh: Partial<Refreshed>) => void;
  importData: (data: LibraryData, mode: 'merge' | 'replace') => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLanguage: (language: LanguagePreference) => void;
}

const DEFAULT_SETTINGS: Settings = { notifications: true, haptics: true, tmdbKey: '', appearance: 'system', related: true, accent: '', fx: 'full' };
const STORE_KEY = 'palais-mental/library';
const STORE_VERSION = 4;

/** Your marks without the refetchable metadata (episode lists): small enough to keep copies of. */
export function compactLibrary(data: LibraryData): LibraryData {
  const shows: Record<string, Show> = {};
  for (const [id, show] of Object.entries(data.shows ?? {})) shows[id] = { ...show, episodes: [], syncedAt: 0 };
  return { shows, movies: data.movies ?? {}, books: data.books ?? {}, games: data.games ?? {} };
}

/** Status changes shared by books and games. Finishing keeps when you started. */
function withStatus<T extends Book | Game>(item: T, status: ShelfStatus, at = Date.now()): T {
  if (status === 'want') return { ...item, startedAt: undefined, pausedAt: undefined, finishedAt: undefined, droppedAt: undefined };
  if (status === 'started') return { ...item, startedAt: item.startedAt ?? at, pausedAt: undefined, finishedAt: undefined, droppedAt: undefined };
  if (status === 'paused') return { ...item, startedAt: item.startedAt ?? at, pausedAt: at, finishedAt: undefined, droppedAt: undefined };
  if (status === 'finished') return { ...item, startedAt: item.startedAt ?? at, pausedAt: undefined, finishedAt: at, droppedAt: undefined };
  return { ...item, pausedAt: undefined, droppedAt: at };
}

/** A review and when it was written; an empty one clears both. */
const reviewed = (review: string) => ({ review: review.trim() || undefined, reviewedAt: review.trim() ? Date.now() : undefined });

/** The four collections share how an entry is added, refreshed, removed, put back, rated and reviewed. */
type Kind = 'shows' | 'movies' | 'books' | 'games';
const KINDS: Kind[] = ['shows', 'movies', 'books', 'games'];
type Item<K extends Kind> = LibraryState[K][string];
type Change = Partial<Pick<LibraryState, Kind>>;

/** One entry changed, if it is there. */
const patch = <K extends Kind>(s: LibraryState, kind: K, id: string, fn: (item: Item<K>) => Item<K>): Change | LibraryState =>
  s[kind][id] ? ({ [kind]: { ...s[kind], [id]: fn(s[kind][id] as Item<K>) } } as Change) : s;

function without<T>(record: Record<string, T>, id: string) {
  const next = { ...record };
  delete next[id];
  return next;
}

/** Merge a record into mine: my progress and rating win, metadata comes from theirs. */
function mergeShelf<T extends Book | Game>(mine: Record<string, T>, theirs: Record<string, T> | undefined) {
  const out = { ...mine };
  for (const [id, item] of Object.entries(theirs ?? {})) {
    const own = out[id];
    out[id] = own
      ? ({
          ...item,
          ...own,
          rating: own.rating ?? item.rating,
          review: own.review ?? item.review,
          reviewedAt: own.review ? own.reviewedAt : item.reviewedAt,
          startedAt: own.startedAt ?? item.startedAt,
          finishedAt: own.finishedAt ?? item.finishedAt,
        } as T)
      : item;
  }
  return out;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => {
      const entries = <K extends Kind>(kind: K) => ({
        /** Added, or its metadata refreshed when it is already there (your marks are kept). */
        add: (data: { id: string }) =>
          set((s) => ({ [kind]: { ...s[kind], [data.id]: { ...s[kind][data.id], ...data, addedAt: s[kind][data.id]?.addedAt ?? Date.now() } } }) as Change),
        update: (data: { id: string }) => set((s) => patch(s, kind, data.id, (item) => ({ ...item, ...data }))),
        remove: (id: string) => {
          const item = get()[kind][id] as Item<K> | undefined;
          if (item) set((s) => ({ [kind]: without(s[kind] as Record<string, unknown>, id) }) as Change);
          return item;
        },
        restore: (item: Item<K>) => set((s) => ({ [kind]: { ...s[kind], [item.id]: item } }) as Change),
        rate: (id: string, rating: number | undefined) => set((s) => patch(s, kind, id, (item) => ({ ...item, rating }))),
        review: (id: string, review: string) => set((s) => patch(s, kind, id, (item) => ({ ...item, ...reviewed(review) }))),
      });
      const shows = entries('shows');
      const movies = entries('movies');
      const books = entries('books');
      const games = entries('games');

      return {
        shows: {},
        movies: {},
        books: {},
        games: {},
        settings: DEFAULT_SETTINGS,
        language: 'system',

        addShow: (data) =>
          set((s) => {
            const prev = s.shows[data.id];
            if (prev) return { shows: { ...s.shows, [data.id]: { ...prev, ...data, droppedAt: undefined } } };
            return { shows: { ...s.shows, [data.id]: { ...data, watched: {}, addedAt: Date.now() } } };
          }),
        updateShow: shows.update,
        removeShow: shows.remove,
        restoreShow: shows.restore,
        setShowRating: shows.rate,
        setShowReview: shows.review,
        setEpisodes: (showId, ids, watched, at) =>
          set((s) =>
            patch(s, 'shows', showId, (show) => {
              const next = { ...show.watched };
              const now = at ?? Date.now();
              for (const id of ids) {
                if (watched) next[id] ??= now;
                else delete next[id];
              }
              return { ...show, watched: next };
            }),
          ),
        toggleEpisode: (showId, episodeId) => {
          const watched = !get().shows[showId]?.watched[episodeId];
          get().setEpisodes(showId, [episodeId], watched);
          return watched;
        },
        setDropped: (showId, dropped) => set((s) => patch(s, 'shows', showId, (show) => ({ ...show, droppedAt: dropped ? Date.now() : undefined }))),
        setEpisodeNote: (showId, episodeId, change) =>
          set((s) =>
            patch(s, 'shows', showId, (show) => {
              const notes = { ...show.notes };
              const next: EpisodeNote = { ...notes[episodeId], ...change, at: Date.now() };
              if (!next.text?.trim()) delete next.text;
              if (next.rating == null) delete next.rating;
              if (next.rating == null && !next.text) delete notes[episodeId];
              else notes[episodeId] = next;
              return { ...show, notes };
            }),
          ),

        addMovie: movies.add,
        updateMovie: movies.update,
        removeMovie: movies.remove,
        restoreMovie: movies.restore,
        setMovieRating: movies.rate,
        setMovieReview: movies.review,
        setMovieWatched: (id, watched, at) => set((s) => patch(s, 'movies', id, (m) => ({ ...m, watchedAt: watched ? (at ?? Date.now()) : undefined }))),
        patchMovies: (patches) =>
          set((s) => {
            const next = { ...s.movies };
            for (const [id, change] of Object.entries(patches)) if (next[id]) next[id] = { ...next[id], ...change };
            return { movies: next };
          }),

        addBook: books.add,
        updateBook: books.update,
        removeBook: books.remove,
        restoreBook: books.restore,
        setBookRating: books.rate,
        setBookReview: books.review,
        setBookPage: (id, page) =>
          set((s) =>
            patch(s, 'books', id, (b) => {
              const now = Date.now();
              const p = Math.max(0, Math.round(page));
              return { ...b, page: p || undefined, touchedAt: now, startedAt: b.startedAt ?? (p ? now : undefined), pausedAt: undefined, droppedAt: undefined };
            }),
          ),
        setBookStatus: (id, status, at) =>
          set((s) =>
            patch(s, 'books', id, (b) => {
              const next = withStatus(b, status, at);
              if (status === 'finished' && b.pages) return { ...next, page: b.pages };
              if (status === 'want') return { ...next, page: undefined };
              return next;
            }),
          ),

        addGame: games.add,
        updateGame: games.update,
        removeGame: games.remove,
        restoreGame: games.restore,
        setGameRating: games.rate,
        setGameReview: games.review,
        setGameProgress: (id, change) =>
          set((s) =>
            patch(s, 'games', id, (g) => {
              const now = Date.now();
              const next = { ...g, ...change, touchedAt: now, pausedAt: undefined, droppedAt: undefined };
              if (next.percent != null) next.percent = Math.max(0, Math.min(100, Math.round(next.percent))) || undefined;
              if (next.hours != null) next.hours = Math.max(0, Math.round(next.hours * 2) / 2) || undefined;
              return { ...next, startedAt: g.startedAt ?? (next.hours || next.percent ? now : undefined) };
            }),
          ),
        setGameStatus: (id, status, at) =>
          set((s) =>
            patch(s, 'games', id, (g) => {
              const next = withStatus(g, status, at);
              if (status === 'finished') return { ...next, percent: Math.max(g.percent ?? 0, 100) };
              if (status === 'want') return { ...next, hours: undefined, percent: undefined };
              return next;
            }),
          ),

        updateMany: (fresh) =>
          set((s) => {
            const change: Record<string, Record<string, { id: string }>> = {};
            for (const kind of KINDS) {
              if (!fresh[kind]?.length) continue;
              const record: Record<string, { id: string }> = { ...s[kind] };
              for (const data of fresh[kind]!) if (record[data.id]) record[data.id] = { ...record[data.id], ...data };
              change[kind] = record;
            }
            return change as Change;
          }),
        importData: (data, mode) =>
          set((s) => {
            if (mode === 'replace') return { shows: data.shows, movies: data.movies, books: data.books ?? {}, games: data.games ?? {} };
            const shows = { ...s.shows };
            for (const [id, show] of Object.entries(data.shows)) {
              const mine = shows[id];
              shows[id] = mine
                ? {
                    ...show,
                    ...mine,
                    rating: mine.rating ?? show.rating,
                    review: mine.review ?? show.review,
                    reviewedAt: mine.review ? mine.reviewedAt : show.reviewedAt,
                    watched: { ...show.watched, ...mine.watched },
                    notes: { ...show.notes, ...mine.notes },
                  }
                : show;
            }
            const movies = { ...s.movies };
            for (const [id, movie] of Object.entries(data.movies)) {
              const mine = movies[id];
              movies[id] = mine
                ? {
                    ...movie,
                    ...mine,
                    rating: mine.rating ?? movie.rating,
                    review: mine.review ?? movie.review,
                    reviewedAt: mine.review ? mine.reviewedAt : movie.reviewedAt,
                    watchedAt: mine.watchedAt ?? movie.watchedAt,
                  }
                : movie;
            }
            return { shows, movies, books: mergeShelf(s.books, data.books), games: mergeShelf(s.games, data.games) };
          }),
        setSettings: (change) => set((s) => ({ settings: { ...s.settings, ...change } })),
        setLanguage: (language) => set({ language }),
      };
    },
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: lazyStorage({ episodesApart: true }),
      partialize: (s) => ({ shows: s.shows, movies: s.movies, books: s.books, games: s.games, settings: s.settings, language: s.language }),
      // v0 was the 3D palace: nothing in it maps to tracked shows, so start clean.
      // v1 → v2 → v3 only add optional fields and collections (books, games); v4 moves episode
      // lists to their own keys (lib/libraryParts). The library is kept as is, with a copy saved first.
      migrate: async (persisted, version) => {
        if (version < 1) return {} as LibraryState;
        const p = persisted as Partial<LibraryData>;
        await AsyncStorage.setItem(`${STORE_KEY}@v${version}`, JSON.stringify(compactLibrary({ shows: p.shows ?? {}, movies: p.movies ?? {} }))).catch(() => undefined);
        return persisted as LibraryState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryState>;
        return { ...current, ...p, books: p.books ?? {}, games: p.games ?? {}, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
    },
  ),
);

/** True while nothing is tracked yet (first run). */
export const useLibraryEmpty = () => useLibrary((s) => !Object.keys(s.shows).length && !Object.keys(s.movies).length && !Object.keys(s.books).length && !Object.keys(s.games).length);
