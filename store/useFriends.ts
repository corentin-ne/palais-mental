import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { lazyStorage } from '@/lib/storage';
import type { MediaKind } from '@/lib/types';

export interface Member {
  id: string;
  name: string;
  emoji: string;
  joinedAt: number;
}

/** A title as friends share it: every key it is known by, and enough to draw its card. */
export interface SharedTitle {
  id: number;
  kind: MediaKind;
  keys: string[];
  /** What the app opens it with: a TVmaze id, or the film, book or game id. */
  route: string;
  title: string;
  year?: number;
  poster?: string;
}

export interface SharedRating {
  user: string;
  title: number;
  /** 1–10 (half stars). */
  rating: number;
  at: number;
}

export interface Reco {
  user: string;
  title: number;
  note?: string;
  favorite: boolean;
  /** The one friend it is meant for. */
  to?: string;
  at: number;
}

export interface Thanks {
  recoUser: string;
  title: number;
  from: string;
}

export interface Post {
  id: number;
  user: string;
  episode: number;
  body: string;
  rating?: number;
  at: number;
  /** Member id → emoji. */
  reactions: Record<string, string>;
}

export interface FriendsData {
  members: Record<string, Member>;
  titles: Record<number, SharedTitle>;
  ratings: SharedRating[];
  recos: Reco[];
  thanks: Thanks[];
}

interface FriendsState extends FriendsData {
  /** Your member id once you have joined; absent, the app is exactly what it was. */
  me?: string;
  /** Send your ratings along (off until you say so). */
  shareRatings: boolean;
  /** Recommendations you waved off ("not for me"): kept on this device. */
  dismissed: number[];
  syncedAt: number;
  /** Episode talk, per title: read when a show opens, never stored. */
  posts: Record<number, Post[]>;
  set: (patch: Partial<Omit<FriendsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY: FriendsData = { members: {}, titles: {}, ratings: [], recos: [], thanks: [] };

/** What your friends shared, kept on the device so it reads offline. */
export const useFriends = create<FriendsState>()(
  persist(
    (set) => ({
      ...EMPTY,
      shareRatings: false,
      dismissed: [],
      syncedAt: 0,
      posts: {},
      set: (patch) => set(patch),
      reset: () => set({ ...EMPTY, me: undefined, shareRatings: false, dismissed: [], syncedAt: 0, posts: {} }),
    }),
    {
      name: 'palais-mental/friends',
      version: 1,
      storage: lazyStorage(),
      partialize: ({ posts: _posts, set: _set, reset: _reset, ...kept }) => kept as FriendsState,
    },
  ),
);
