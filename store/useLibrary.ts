import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LanguagePreference } from '@/locales/i18n';
import { lazyStorage } from '@/lib/storage';
import { hasAired, sortEpisodes } from '@/lib/progress';
import { Book, Episode, EpisodeNote, Game, Movie, Settings, Show } from '@/lib/types';

export type ShowData = Omit<Show, 'watched' | 'addedAt' | 'droppedAt' | 'rating' | 'review' | 'reviewedAt' | 'notes'>;
export type MovieData = Omit<Movie, 'watchedAt' | 'addedAt' | 'rating'>;
type Progressless = 'touchedAt' | 'startedAt' | 'finishedAt' | 'droppedAt' | 'rating' | 'addedAt';
export type BookData = Omit<Book, Progressless | 'page'>;
export type GameData = Omit<Game, Progressless | 'hours' | 'percent'>;
export type ShelfStatus = 'want' | 'started' | 'finished' | 'dropped';

export interface LibraryData {
  shows: Record<string, Show>;
  movies: Record<string, Movie>;
  /** Absent from backups made before 1.2. */
  books?: Record<string, Book>;
  games?: Record<string, Game>;
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
  /** Marks every aired episode up to and including `episode`. */
  watchUpTo: (showId: string, episode: Episode) => void;
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

  addBook: (data: BookData) => void;
  updateBook: (data: BookData) => void;
  removeBook: (id: string) => Book | undefined;
  restoreBook: (book: Book) => void;
  /** The page you are at; reaching the last page doesn't finish the book on its own. */
  setBookPage: (id: string, page: number) => void;
  setBookStatus: (id: string, status: ShelfStatus, at?: number) => void;
  setBookRating: (id: string, rating: number | undefined) => void;

  addGame: (data: GameData) => void;
  updateGame: (data: GameData) => void;
  removeGame: (id: string) => Game | undefined;
  restoreGame: (game: Game) => void;
  setGameProgress: (id: string, patch: { hours?: number; percent?: number }) => void;
  setGameStatus: (id: string, status: ShelfStatus, at?: number) => void;
  setGameRating: (id: string, rating: number | undefined) => void;

  importData: (data: LibraryData, mode: 'merge' | 'replace') => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLanguage: (language: LanguagePreference) => void;
}

const DEFAULT_SETTINGS: Settings = { notifications: true, haptics: true, tmdbKey: '', appearance: 'system', related: true, accent: '', fx: 'full' };
const STORE_KEY = 'palais-mental/library';
const STORE_VERSION = 3;

/** Your marks without the refetchable metadata (episode lists): small enough to keep copies of. */
export function compactLibrary(data: LibraryData): LibraryData {
  const shows: Record<string, Show> = {};
  for (const [id, show] of Object.entries(data.shows ?? {})) shows[id] = { ...show, episodes: [], syncedAt: 0 };
  return { shows, movies: data.movies ?? {}, books: data.books ?? {}, games: data.games ?? {} };
}

/** Status changes shared by books and games. Finishing keeps when you started. */
function withStatus<T extends Book | Game>(item: T, status: ShelfStatus, at = Date.now()): T {
  if (status === 'want') return { ...item, startedAt: undefined, finishedAt: undefined, droppedAt: undefined };
  if (status === 'started') return { ...item, startedAt: item.startedAt ?? at, finishedAt: undefined, droppedAt: undefined };
  if (status === 'finished') return { ...item, startedAt: item.startedAt ?? at, finishedAt: at, droppedAt: undefined };
  return { ...item, droppedAt: at };
}

const patchBook = (s: LibraryState, id: string, fn: (book: Book) => Book) => (s.books[id] ? { books: { ...s.books, [id]: fn(s.books[id]) } } : s);
const patchGame = (s: LibraryState, id: string, fn: (game: Game) => Game) => (s.games[id] ? { games: { ...s.games, [id]: fn(s.games[id]) } } : s);

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
          startedAt: own.startedAt ?? item.startedAt,
          finishedAt: own.finishedAt ?? item.finishedAt,
        } as T)
      : item;
  }
  return out;
}

const patchShow = (s: LibraryState, id: string, fn: (show: Show) => Show) =>
  s.shows[id] ? { shows: { ...s.shows, [id]: fn(s.shows[id]) } } : s;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
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
      updateShow: (data) => set((s) => patchShow(s, data.id, (show) => ({ ...show, ...data }))),
      removeShow: (id) => {
        const show = get().shows[id];
        if (show)
          set((s) => {
            const shows = { ...s.shows };
            delete shows[id];
            return { shows };
          });
        return show;
      },
      restoreShow: (show) => set((s) => ({ shows: { ...s.shows, [show.id]: show } })),
      setEpisodes: (showId, ids, watched, at) =>
        set((s) =>
          patchShow(s, showId, (show) => {
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
      watchUpTo: (showId, episode) => {
        const show = get().shows[showId];
        if (!show) return;
        const ids = sortEpisodes(show.episodes)
          .filter((e) => (e.season < episode.season || (e.season === episode.season && e.number <= episode.number)) && (hasAired(e) || e.id === episode.id))
          .map((e) => e.id);
        get().setEpisodes(showId, ids, true);
      },
      setDropped: (showId, dropped) => set((s) => patchShow(s, showId, (show) => ({ ...show, droppedAt: dropped ? Date.now() : undefined }))),
      setEpisodeNote: (showId, episodeId, patch) =>
        set((s) =>
          patchShow(s, showId, (show) => {
            const notes = { ...show.notes };
            const next: EpisodeNote = { ...notes[episodeId], ...patch, at: Date.now() };
            if (!next.text?.trim()) delete next.text;
            if (next.rating == null) delete next.rating;
            if (next.rating == null && !next.text) delete notes[episodeId];
            else notes[episodeId] = next;
            return { ...show, notes };
          }),
        ),
      setShowReview: (showId, review) => set((s) => patchShow(s, showId, (show) => ({ ...show, review: review.trim() || undefined, reviewedAt: review.trim() ? Date.now() : undefined }))),

      addMovie: (data) =>
        set((s) => ({ movies: { ...s.movies, [data.id]: { ...s.movies[data.id], ...data, addedAt: s.movies[data.id]?.addedAt ?? Date.now() } } })),
      updateMovie: (data) => set((s) => (s.movies[data.id] ? { movies: { ...s.movies, [data.id]: { ...s.movies[data.id], ...data } } } : s)),
      removeMovie: (id) => {
        const movie = get().movies[id];
        if (movie)
          set((s) => {
            const movies = { ...s.movies };
            delete movies[id];
            return { movies };
          });
        return movie;
      },
      restoreMovie: (movie) => set((s) => ({ movies: { ...s.movies, [movie.id]: movie } })),
      setMovieWatched: (id, watched, at) =>
        set((s) => (s.movies[id] ? { movies: { ...s.movies, [id]: { ...s.movies[id], watchedAt: watched ? (at ?? Date.now()) : undefined } } } : s)),
      setShowRating: (id, rating) => set((s) => patchShow(s, id, (show) => ({ ...show, rating }))),
      setMovieRating: (id, rating) => set((s) => (s.movies[id] ? { movies: { ...s.movies, [id]: { ...s.movies[id], rating } } } : s)),

      addBook: (data) =>
        set((s) => ({ books: { ...s.books, [data.id]: { ...s.books[data.id], ...data, addedAt: s.books[data.id]?.addedAt ?? Date.now() } } })),
      updateBook: (data) => set((s) => patchBook(s, data.id, (b) => ({ ...b, ...data }))),
      removeBook: (id) => {
        const book = get().books[id];
        if (book) set((s) => ({ books: without(s.books, id) }));
        return book;
      },
      restoreBook: (book) => set((s) => ({ books: { ...s.books, [book.id]: book } })),
      setBookPage: (id, page) =>
        set((s) =>
          patchBook(s, id, (b) => {
            const now = Date.now();
            const p = Math.max(0, Math.round(page));
            return { ...b, page: p || undefined, touchedAt: now, startedAt: b.startedAt ?? (p ? now : undefined), droppedAt: undefined };
          }),
        ),
      setBookStatus: (id, status, at) =>
        set((s) =>
          patchBook(s, id, (b) => {
            const next = withStatus(b, status, at);
            if (status === 'finished' && b.pages) return { ...next, page: b.pages };
            if (status === 'want') return { ...next, page: undefined };
            return next;
          }),
        ),
      setBookRating: (id, rating) => set((s) => patchBook(s, id, (b) => ({ ...b, rating }))),

      addGame: (data) =>
        set((s) => ({ games: { ...s.games, [data.id]: { ...s.games[data.id], ...data, addedAt: s.games[data.id]?.addedAt ?? Date.now() } } })),
      updateGame: (data) => set((s) => patchGame(s, data.id, (g) => ({ ...g, ...data }))),
      removeGame: (id) => {
        const game = get().games[id];
        if (game) set((s) => ({ games: without(s.games, id) }));
        return game;
      },
      restoreGame: (game) => set((s) => ({ games: { ...s.games, [game.id]: game } })),
      setGameProgress: (id, patch) =>
        set((s) =>
          patchGame(s, id, (g) => {
            const now = Date.now();
            const next = { ...g, ...patch, touchedAt: now, droppedAt: undefined };
            if (next.percent != null) next.percent = Math.max(0, Math.min(100, Math.round(next.percent))) || undefined;
            if (next.hours != null) next.hours = Math.max(0, Math.round(next.hours * 2) / 2) || undefined;
            return { ...next, startedAt: g.startedAt ?? (next.hours || next.percent ? now : undefined) };
          }),
        ),
      setGameStatus: (id, status, at) =>
        set((s) =>
          patchGame(s, id, (g) => {
            const next = withStatus(g, status, at);
            if (status === 'finished') return { ...next, percent: Math.max(g.percent ?? 0, 100) };
            if (status === 'want') return { ...next, hours: undefined, percent: undefined };
            return next;
          }),
        ),
      setGameRating: (id, rating) => set((s) => patchGame(s, id, (g) => ({ ...g, rating }))),

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
            movies[id] = mine ? { ...movie, ...mine, rating: mine.rating ?? movie.rating, watchedAt: mine.watchedAt ?? movie.watchedAt } : movie;
          }
          return { shows, movies, books: mergeShelf(s.books, data.books), games: mergeShelf(s.games, data.games) };
        }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: lazyStorage(),
      partialize: (s) => ({ shows: s.shows, movies: s.movies, books: s.books, games: s.games, settings: s.settings, language: s.language }),
      // v0 was the 3D palace: nothing in it maps to tracked shows, so start clean.
      // v1 → v2 → v3 only add optional fields and collections (books, games): the library is
      // kept as is, with a copy saved first.
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
