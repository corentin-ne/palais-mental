import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { lazyStorage } from '@/lib/storage';
import type { MediaKind } from '@/lib/types';

/** The colours a band of your own can take (the automatic ones stay red). */
export const BAND_COLORS = { red: '#C8102E', blue: '#1D4ED8', green: '#15803D', purple: '#7C3AED', orange: '#C2410C', black: '#111827' } as const;
export type BandColor = keyof typeof BAND_COLORS;

export interface Member {
  id: string;
  name: string;
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
  /** A band of your own across the poster: a few words, quoted and signed, in the colour you picked. */
  band?: string;
  color?: BandColor;
  /** Your stars on that band (1–10), when you chose to show them. */
  stars?: number;
  favorite: boolean;
  /** The one friend it is meant for. */
  to?: string;
  at: number;
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

/** A post somewhere in the group: a review of a title (episode 0) or a message on an episode. */
export interface TitlePost extends Post {
  title: number;
}

export interface FriendsData {
  members: Record<string, Member>;
  titles: Record<number, SharedTitle>;
  ratings: SharedRating[];
  recos: Reco[];
  /** What each member wrote about a title as a whole, with their stars: one per member and title. */
  reviews: TitlePost[];
  /** The latest messages on episodes, across every show: the Social feed. */
  talk: TitlePost[];
}

interface FriendsState extends FriendsData {
  /** Your member id once you have joined; absent, the app is exactly what it was. */
  me?: string;
  /** Send your ratings along (off until you say so): the rule for every rating you haven't decided on. */
  shareRatings: boolean;
  /** Reviews go along with ratings: false for those who shared ratings before reviews were shared, until they say yes. */
  shareReviews: boolean;
  /** Ratings you decided on one by one (`kind/id` → shown or hidden), whatever the rule above says. */
  shared: Record<string, boolean>;
  syncedAt: number;
  /** Episode talk, per title: read when a show opens, never stored. */
  posts: Record<number, Post[]>;
  set: (patch: Partial<Omit<FriendsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY: FriendsData = { members: {}, titles: {}, ratings: [], recos: [], reviews: [], talk: [] };

/** What your friends shared, kept on the device so it reads offline. */
export const useFriends = create<FriendsState>()(
  persist(
    (set) => ({
      ...EMPTY,
      shareRatings: false,
      shareReviews: false,
      shared: {},
      syncedAt: 0,
      posts: {},
      set: (patch) => set(patch),
      reset: () => set({ ...EMPTY, me: undefined, shareRatings: false, shareReviews: false, shared: {}, syncedAt: 0, posts: {} }),
    }),
    {
      name: 'palais-mental/friends',
      version: 1,
      storage: lazyStorage(),
      partialize: ({ posts: _posts, set: _set, reset: _reset, ...kept }) => kept as FriendsState,
    },
  ),
);
