import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Services read through public pages or feeds: no API key, no password, just a username. */
export type Service = 'letterboxd' | 'serializd' | 'mal' | 'anilist';
export const SERVICES: Service[] = ['letterboxd', 'serializd', 'mal', 'anilist'];

export interface Account {
  username: string;
  lastSync?: number;
  /** Titles added or updated by the last sync. */
  lastChanges?: number;
  lastUnmatched?: number;
  lastError?: boolean;
}

/** What an outside entry was matched to. `id` null: nothing found (retried after a while). */
export interface Match {
  id: string | null;
  kind: 'show' | 'movie';
  season?: number;
  malId?: number;
  /** Status, progress and rating last applied: unchanged entries are skipped. */
  sig?: string;
  at: number;
}

/** A film, series, book or game from the universe of something you follow (Wikidata). */
export interface RelatedRelease {
  /** IMDb id for films and series; Wikidata id (Q…) for books and games. */
  imdbId: string;
  title: string;
  date: number;
  kind: 'show' | 'movie' | 'book' | 'game';
  /** Route for books and games. */
  href?: string;
  relation: 'sequel' | 'prequel' | 'series' | 'universe';
  /** The series, franchise or universe they share. */
  group?: string;
  /** Title in your library it comes from. */
  from: string;
  poster?: string;
}

interface ConnectionsState {
  accounts: Partial<Record<Service, Account>>;
  matches: Record<string, Match>;
  autoSync: boolean;
  related: { at: number; seeds: string; entries: RelatedRelease[] };

  setAccount: (service: Service, patch: Partial<Account> | null) => void;
  setMatches: (patch: Record<string, Match>) => void;
  setAutoSync: (on: boolean) => void;
  setRelated: (related: ConnectionsState['related']) => void;
}

export const useConnections = create<ConnectionsState>()(
  persist(
    (set) => ({
      accounts: {},
      matches: {},
      autoSync: true,
      related: { at: 0, seeds: '', entries: [] },

      setAccount: (service, patch) =>
        set((s) => {
          const accounts = { ...s.accounts };
          if (patch === null) delete accounts[service];
          else accounts[service] = { username: '', ...accounts[service], ...patch };
          return { accounts };
        }),
      setMatches: (patch) => set((s) => ({ matches: { ...s.matches, ...patch } })),
      setAutoSync: (autoSync) => set({ autoSync }),
      setRelated: (related) => set({ related }),
    }),
    {
      name: 'palais-mental/connections',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ accounts: s.accounts, matches: s.matches, autoSync: s.autoSync, related: s.related }),
    },
  ),
);
