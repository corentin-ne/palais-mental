import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { lazyStorage } from '@/lib/storage';
import type { StatKind } from '@/lib/stats';

/** How you left the screens: the library tab, its filters and sort, your recent searches, the goals you set. Kept across launches. */
interface PrefsState {
  libraryTab?: 'shows' | 'movies' | 'books' | 'games';
  showFilter: string;
  movieFilter: string;
  shelfFilter: string;
  sort: string;
  /** Latest first, at most RECENT_MAX. */
  recentSearches: string[];
  /** How many films, books and games you mean to get through in a year; none until you set one. */
  goals: Partial<Record<StatKind, number>>;
  set: (patch: Partial<Omit<PrefsState, 'set' | 'addSearch' | 'clearSearches'>>) => void;
  addSearch: (q: string) => void;
  clearSearches: () => void;
}

const RECENT_MAX = 8;

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      showFilter: 'all',
      movieFilter: 'watchlist',
      shelfFilter: 'started',
      sort: 'recent',
      recentSearches: [],
      goals: {},
      set: (patch) => set(patch),
      addSearch: (q) =>
        set((s) => {
          const query = q.trim();
          if (query.length < 2) return s;
          const rest = s.recentSearches.filter((x) => x.toLocaleLowerCase() !== query.toLocaleLowerCase());
          return { recentSearches: [query, ...rest].slice(0, RECENT_MAX) };
        }),
      clearSearches: () => set({ recentSearches: [] }),
    }),
    { name: 'palais-mental/prefs', version: 1, storage: lazyStorage() },
  ),
);
