import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LanguagePreference } from '@/locales/i18n';
import { hasAired, sortEpisodes } from '@/lib/progress';
import { Episode, Movie, Settings, Show } from '@/lib/types';

export type ShowData = Omit<Show, 'watched' | 'addedAt' | 'droppedAt'>;
export type MovieData = Omit<Movie, 'watchedAt' | 'addedAt'>;

export interface LibraryData {
  shows: Record<string, Show>;
  movies: Record<string, Movie>;
}

interface LibraryState extends LibraryData {
  settings: Settings;
  language: LanguagePreference;

  addShow: (data: ShowData) => void;
  updateShow: (data: ShowData) => void;
  removeShow: (id: string) => Show | undefined;
  restoreShow: (show: Show) => void;
  setEpisodes: (showId: string, episodeIds: number[], watched: boolean) => void;
  toggleEpisode: (showId: string, episodeId: number) => boolean;
  /** Marks every aired episode up to and including `episode`. */
  watchUpTo: (showId: string, episode: Episode) => void;
  setDropped: (showId: string, dropped: boolean) => void;

  addMovie: (data: MovieData) => void;
  updateMovie: (data: MovieData) => void;
  removeMovie: (id: string) => Movie | undefined;
  restoreMovie: (movie: Movie) => void;
  setMovieWatched: (id: string, watched: boolean) => void;

  importData: (data: LibraryData, mode: 'merge' | 'replace') => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLanguage: (language: LanguagePreference) => void;
}

const DEFAULT_SETTINGS: Settings = { notifications: true, haptics: true, tmdbKey: '', appearance: 'system' };

const patchShow = (s: LibraryState, id: string, fn: (show: Show) => Show) =>
  s.shows[id] ? { shows: { ...s.shows, [id]: fn(s.shows[id]) } } : s;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      shows: {},
      movies: {},
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
      setEpisodes: (showId, ids, watched) =>
        set((s) =>
          patchShow(s, showId, (show) => {
            const next = { ...show.watched };
            const now = Date.now();
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
      setMovieWatched: (id, watched) =>
        set((s) => (s.movies[id] ? { movies: { ...s.movies, [id]: { ...s.movies[id], watchedAt: watched ? Date.now() : undefined } } } : s)),

      importData: (data, mode) =>
        set((s) => {
          if (mode === 'replace') return { shows: data.shows, movies: data.movies };
          const shows = { ...s.shows };
          for (const [id, show] of Object.entries(data.shows)) {
            const mine = shows[id];
            shows[id] = mine ? { ...show, ...mine, watched: { ...show.watched, ...mine.watched } } : show;
          }
          const movies = { ...s.movies };
          for (const [id, movie] of Object.entries(data.movies)) {
            const mine = movies[id];
            movies[id] = mine ? { ...movie, ...mine, watchedAt: mine.watchedAt ?? movie.watchedAt } : movie;
          }
          return { shows, movies };
        }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'palais-mental/library',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ shows: s.shows, movies: s.movies, settings: s.settings, language: s.language }),
      // v0 was the 3D palace: nothing in it maps to tracked shows, so start clean.
      migrate: (persisted, version) => (version < 1 ? {} : persisted) as LibraryState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
    },
  ),
);
