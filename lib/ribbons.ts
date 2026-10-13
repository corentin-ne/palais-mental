/**
 * What friends' ratings add up to: the red band across a poster (like the one a
 * bookshop wraps around a prize-winner), the suggestions on Up next, and how alike two tastes are.
 * All of it is worked out on the device from what was synced.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Shareable, findTitle, hrefOf, keysOf } from './friends';
import type { MediaKind } from './types';
import { Member, SharedRating, SharedTitle, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** One band per poster, the first that applies in this order. */
export type Ribbon =
  | { type: 'loved'; users: string[] }
  | { type: 'prize'; year: number }
  | { type: 'unanimous' | 'split' | 'mine' };

/**
 * How many ratings make a verdict. Scaled to the group: two when you are three or four, so the bands
 * mean something with a handful of friends, up to four in a group of ten.
 */
export const quorumFor = (members: number) => (members <= 4 ? 2 : members <= 7 ? 3 : 4);
/** Four stars and up. */
const LOVED = 8;
/** Four and a half: one person's rating is enough for a band. */
const ADORED = 9;
/** Two and a half stars apart. */
const SPLIT = 5;
/** Ratings in common before two tastes are compared. */
const COMMON = 3;

export interface Digest {
  ribbons: Map<number, Ribbon>;
  ratings: Map<number, SharedRating[]>;
  /** Member id → 0–1: how close their ratings are to yours, on what you both rated. */
  affinity: Map<string, number>;
}

type Input = { me?: string; members: Record<string, Member>; titles: Record<number, SharedTitle>; ratings: SharedRating[] };

const group = <T extends { title: number }>(rows: T[]) => {
  const by = new Map<number, T[]>();
  for (const r of rows) by.set(r.title, [...(by.get(r.title) ?? []), r]);
  return by;
};

export function digest({ me, members, titles, ratings }: Input): Digest {
  const quorum = quorumFor(Object.keys(members).length);
  const byTitle = group(ratings.filter((r) => members[r.user]));

  // The friends' prize: each year, the best-rated title of a kind (enough ratings, four stars on average).
  const best = new Map<string, { title: number; avg: number; count: number }>();
  for (const [title, list] of byTitle) {
    const kind = titles[title]?.kind;
    if (!kind) continue;
    const years = new Map<number, number[]>();
    for (const r of list) years.set(new Date(r.at).getFullYear(), [...(years.get(new Date(r.at).getFullYear()) ?? []), r.rating]);
    for (const [year, values] of years) {
      if (values.length < quorum) continue;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const held = best.get(`${kind}/${year}`);
      if (avg >= LOVED && (!held || avg > held.avg || (avg === held.avg && (values.length > held.count || (values.length === held.count && title < held.title))))) {
        best.set(`${kind}/${year}`, { title, avg, count: values.length });
      }
    }
  }
  const prizes = new Map<number, number>();
  for (const [key, { title }] of best) prizes.set(title, Math.max(prizes.get(title) ?? 0, Number(key.split('/')[1])));

  const ribbons = new Map<number, Ribbon>();
  for (const [title, list] of byTitle) {
    const values = list.map((r) => r.rating);
    const adored = list.filter((r) => r.user !== me && r.rating >= ADORED).map((r) => r.user);
    const ribbon: Ribbon | undefined = prizes.has(title)
      ? { type: 'prize', year: prizes.get(title)! }
      : values.length >= quorum && Math.min(...values) >= LOVED
        ? { type: 'unanimous' }
        : values.length >= 2 && Math.max(...values) - Math.min(...values) >= SPLIT
          ? { type: 'split' }
          : adored.length
            ? { type: 'loved', users: adored }
            : undefined;
    if (ribbon) ribbons.set(title, ribbon);
  }

  const affinity = new Map<string, number>();
  if (me) {
    const gaps = new Map<string, number[]>();
    for (const list of byTitle.values()) {
      const mine = list.find((r) => r.user === me);
      if (mine) for (const r of list) if (r.user !== me) gaps.set(r.user, [...(gaps.get(r.user) ?? []), Math.abs(r.rating - mine.rating)]);
    }
    for (const [user, list] of gaps) if (list.length >= COMMON) affinity.set(user, 1 - list.reduce((a, b) => a + b, 0) / list.length / 9);
  }
  return { ribbons, ratings: byTitle, affinity };
}

/** A band is narrow: a full name gives its first word. */
const first = (name?: string) => name?.trim().split(/\s+/)[0] ?? '';

/** "Léa", "Léa and Tom"; past two, the band counts instead. */
const names = (t: TFunction, users: string[], members: Record<string, Member>) => {
  const list = users.map((u) => first(members[u]?.name)).filter(Boolean);
  return list.length === 2 ? t('friends.and', { a: list[0], b: list[1] }) : list[0];
};

/** What a poster draws: the words of its band. */
export interface Band {
  text: string;
}

export function bandOf(t: TFunction, ribbon: Ribbon, members: Record<string, Member>): Band {
  if (ribbon.type === 'prize') return { text: t('friends.ribbon.prize', { year: ribbon.year }) };
  if (!('users' in ribbon)) return { text: t(`friends.ribbon.${ribbon.type}`) };
  return { text: ribbon.users.length > 2 ? t(`friends.ribbon.${ribbon.type}Many`, { count: ribbon.users.length }) : t(`friends.ribbon.${ribbon.type}`, { names: names(t, ribbon.users, members) }) };
}

/** The digest of what is synced, recomputed only when it changes. */
export function useDigest(): Digest | undefined {
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const ratings = useFriends((s) => s.ratings);
  return me ? digestOf(me, members, titles, ratings) : undefined;
}

let lastDigest: { me: string; members: object; titles: object; ratings: object; d: Digest } | undefined;
/** One digest for the whole app: every screen and block that asks gets the same one until the synced data changes. */
function digestOf(me: string, members: Record<string, Member>, titles: Record<number, SharedTitle>, ratings: SharedRating[]) {
  const l = lastDigest;
  if (l && l.me === me && l.members === members && l.titles === titles && l.ratings === ratings) return l.d;
  const d = digest({ me, members, titles, ratings });
  lastDigest = { me, members, titles, ratings, d };
  return d;
}

const indexes = new WeakMap<object, Map<string, string>>();
/** `kind/key` → the page of that title in your library, built once per collection and reused until it changes. */
function localIndex<T extends Shareable>(kind: MediaKind, collection: Record<string, T>, href: (item: T) => string) {
  let index = indexes.get(collection);
  if (!index) {
    index = new Map();
    for (const item of Object.values(collection)) for (const k of keysOf(kind, item)) index.set(`${kind}/${k}`, href(item));
    indexes.set(collection, index);
  }
  return index;
}

/** Every key of every title you have, per kind. */
function useLocalIndexes() {
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  return useMemo(
    () => ({
      show: localIndex('show', shows, (s) => `/show/${s.tvmazeId}`),
      movie: localIndex('movie', movies, (m) => `/movie/${m.id}`),
      book: localIndex('book', books, (b) => `/book/${b.id}`),
      game: localIndex('game', games, (g) => `/game/${g.id}`),
    }),
    [shows, movies, books, games],
  );
}

const NONE = () => undefined;

/** The band for a title, if it earned one (the same object each time, so posters don't redraw). Before you join, nothing does. */
export function useRibbons(): (kind: MediaKind, item: Shareable) => Band | undefined {
  const { t } = useTranslation();
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const d = useDigest();
  return useMemo(() => {
    if (!d?.ribbons.size) return NONE;
    const bands = new Map<number, Band>();
    return (kind, item) => {
      const id = findTitle(titles, kind, item);
      const ribbon = id != null ? d.ribbons.get(id) : undefined;
      if (id == null || !ribbon) return undefined;
      if (!bands.has(id)) bands.set(id, bandOf(t, ribbon, members));
      return bands.get(id);
    };
  }, [d, titles, members, t]);
}

/**
 * Where a shared title opens on this phone: its page in your library when you have it (matched on any
 * key), else the page the app can load for it.
 */
export function useLocalHrefs(): (title: SharedTitle) => { href: string; have: boolean } {
  const mine = useLocalIndexes();
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  return useMemo(
    () => (title) => {
      const index = mine[title.kind];
      const local = title.keys.map((k) => index.get(`${title.kind}/${k}`)).find(Boolean);
      return { href: local ?? hrefOf(title, tmdbKey), have: !!local };
    },
    [mine, tmdbKey],
  );
}

export interface Suggestion {
  title: SharedTitle;
  /** The others' ratings of it, four stars and up. */
  ratings: SharedRating[];
  ribbon?: Ribbon;
}

/**
 * What the others rated four stars and up that you don't have yet, the tastes closest to yours first.
 */
export function useSuggestions(): Suggestion[] {
  const me = useFriends((s) => s.me);
  const titles = useFriends((s) => s.titles);
  const d = useDigest();
  const have = useLocalIndexes();
  return useMemo(() => {
    if (!me || !d) return [];
    const out: (Suggestion & { score: number; at: number })[] = [];
    for (const [id, all] of d.ratings) {
      const title = titles[id];
      const ratings = all.filter((r) => r.user !== me && r.rating >= LOVED);
      if (!title || !ratings.length || title.keys.some((k) => have[title.kind].has(`${title.kind}/${k}`))) continue;
      const weight = (user: string) => 0.5 + (d.affinity.get(user) ?? 0.5);
      const score = ratings.reduce((n, r) => n + (r.rating - 6) * weight(r.user), 0);
      out.push({ title, ratings, ribbon: d.ribbons.get(id), score, at: Math.max(...ratings.map((r) => r.at)) });
    }
    return out.sort((a, b) => b.score - a.score || b.at - a.at);
  }, [me, d, titles, have]);
}
