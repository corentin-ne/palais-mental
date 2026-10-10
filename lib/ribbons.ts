/**
 * What friends' ratings and recommendations add up to: the red band across a poster (like the one a
 * bookshop wraps around a prize-winner), the suggestions on Up next, and how alike two tastes are.
 * All of it is worked out on the device from what was synced.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Shareable, findTitle, keysOf } from './friends';
import type { MediaKind } from './types';
import { Member, Reco, SharedRating, SharedTitle, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** One band per poster, the first that applies in this order. */
export type Ribbon =
  | { type: 'direct' | 'favorite' | 'reco'; users: string[] }
  | { type: 'prize'; year: number }
  | { type: 'unanimous' | 'split' | 'mine' };

/**
 * How many ratings make a verdict. Scaled to the group: two when you are three or four, so the bands
 * mean something with a handful of friends, up to four in a group of ten.
 */
export const quorumFor = (members: number) => (members <= 4 ? 2 : members <= 7 ? 3 : 4);
/** Four stars and up. */
const LOVED = 8;
/** Two and a half stars apart. */
const SPLIT = 5;
/** Ratings in common before two tastes are compared. */
const COMMON = 3;

export interface Digest {
  ribbons: Map<number, Ribbon>;
  ratings: Map<number, SharedRating[]>;
  recos: Map<number, Reco[]>;
  /** Member id → 0–1: how close their ratings are to yours, on what you both rated. */
  affinity: Map<string, number>;
}

type Input = { me?: string; members: Record<string, Member>; titles: Record<number, SharedTitle>; ratings: SharedRating[]; recos: Reco[] };

const group = <T extends { title: number }>(rows: T[]) => {
  const by = new Map<number, T[]>();
  for (const r of rows) by.set(r.title, [...(by.get(r.title) ?? []), r]);
  return by;
};

export function digest({ me, members, titles, ratings, recos }: Input): Digest {
  const quorum = quorumFor(Object.keys(members).length);
  const byTitle = group(ratings.filter((r) => members[r.user]));
  const recosBy = group(recos.filter((r) => members[r.user]));

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
  for (const title of new Set([...byTitle.keys(), ...recosBy.keys()])) {
    const theirs = (recosBy.get(title) ?? []).filter((r) => r.user !== me).sort((a, b) => a.at - b.at);
    const values = (byTitle.get(title) ?? []).map((r) => r.rating);
    const direct = theirs.filter((r) => r.to === me);
    const favorites = theirs.filter((r) => r.favorite);
    const users = (list: Reco[]) => list.map((r) => r.user);
    const ribbon: Ribbon | undefined = direct.length
      ? { type: 'direct', users: users(direct) }
      : favorites.length
        ? { type: 'favorite', users: users(favorites) }
        : prizes.has(title)
          ? { type: 'prize', year: prizes.get(title)! }
          : values.length >= quorum && Math.min(...values) >= LOVED
            ? { type: 'unanimous' }
            : theirs.length
              ? { type: 'reco', users: users(theirs) }
              : values.length >= 2 && Math.max(...values) - Math.min(...values) >= SPLIT
                ? { type: 'split' }
                : recosBy.get(title)?.some((r) => r.user === me && r.favorite)
                  ? { type: 'mine' }
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
  return { ribbons, ratings: byTitle, recos: recosBy, affinity };
}

/** "Léa", "Léa and Tom"; past two, the band counts instead. */
const names = (t: TFunction, users: string[], members: Record<string, Member>) => {
  const list = users.map((u) => members[u]?.name).filter(Boolean);
  return list.length === 2 ? t('friends.and', { a: list[0], b: list[1] }) : list[0];
};

export function ribbonText(t: TFunction, ribbon: Ribbon, members: Record<string, Member>) {
  if (ribbon.type === 'prize') return t('friends.ribbon.prize', { year: ribbon.year });
  if (!('users' in ribbon)) return t(`friends.ribbon.${ribbon.type}`);
  return ribbon.users.length > 2 ? t(`friends.ribbon.${ribbon.type}Many`, { count: ribbon.users.length }) : t(`friends.ribbon.${ribbon.type}`, { names: names(t, ribbon.users, members) });
}

/** The digest of what is synced, recomputed only when it changes. */
export function useDigest(): Digest | undefined {
  const me = useFriends((s) => s.me);
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const ratings = useFriends((s) => s.ratings);
  const recos = useFriends((s) => s.recos);
  return useMemo(() => (me ? digest({ me, members, titles, ratings, recos }) : undefined), [me, members, titles, ratings, recos]);
}

const NONE = () => undefined;

/** The band's text for a title, if it earned one. Before you join, nothing does. */
export function useRibbons(): (kind: MediaKind, item: Shareable) => string | undefined {
  const { t } = useTranslation();
  const members = useFriends((s) => s.members);
  const titles = useFriends((s) => s.titles);
  const d = useDigest();
  return useMemo(() => {
    if (!d?.ribbons.size) return NONE;
    return (kind, item) => {
      const id = findTitle(titles, kind, item);
      const ribbon = id != null ? d.ribbons.get(id) : undefined;
      return ribbon ? ribbonText(t, ribbon, members) : undefined;
    };
  }, [d, titles, members, t]);
}

export interface Suggestion {
  title: SharedTitle;
  recos: Reco[];
  ribbon?: Ribbon;
}

/** What friends recommend that you don't have yet: meant for you first, then favourites, then the tastes closest to yours. */
export function useSuggestions(): Suggestion[] {
  const me = useFriends((s) => s.me);
  const titles = useFriends((s) => s.titles);
  const dismissed = useFriends((s) => s.dismissed);
  const d = useDigest();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  return useMemo(() => {
    if (!me || !d) return [];
    const have = new Set<string>();
    const add = (kind: MediaKind, list: Shareable[]) => list.forEach((item) => keysOf(kind, item).forEach((k) => have.add(`${kind}/${k}`)));
    add('show', Object.values(shows));
    add('movie', Object.values(movies));
    add('book', Object.values(books));
    add('game', Object.values(games));
    const out: (Suggestion & { score: number; at: number })[] = [];
    for (const [id, all] of d.recos) {
      const title = titles[id];
      const recos = all.filter((r) => r.user !== me);
      if (!title || !recos.length || dismissed.includes(id) || title.keys.some((k) => have.has(`${title.kind}/${k}`))) continue;
      const score = recos.reduce((n, r) => n + (r.to === me ? 100 : 0) + (r.favorite ? 10 : 0) + 3 + 2 * (d.affinity.get(r.user) ?? 0.5), 0);
      out.push({ title, recos, ribbon: d.ribbons.get(id), score, at: Math.max(...recos.map((r) => r.at)) });
    }
    return out.sort((a, b) => b.score - a.score || b.at - a.at);
  }, [me, d, titles, dismissed, shows, movies, books, games]);
}
