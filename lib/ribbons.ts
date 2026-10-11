/**
 * What friends' ratings and recommendations add up to: the red band across a poster (like the one a
 * bookshop wraps around a prize-winner), the suggestions on Up next, and how alike two tastes are.
 * All of it is worked out on the device from what was synced.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Shareable, findTitle, hrefOf, keysOf } from './friends';
import type { MediaKind } from './types';
import { BAND_COLORS, Member, Reco, SharedRating, SharedTitle, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** One band per poster, the first that applies in this order. */
export type Ribbon =
  | { type: 'quote'; reco: Reco }
  | { type: 'direct' | 'favorite' | 'reco' | 'loved'; users: string[] }
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
    const adored = (byTitle.get(title) ?? []).filter((r) => r.user !== me && r.rating >= ADORED).map((r) => r.user);
    const direct = theirs.filter((r) => r.to === me);
    const favorites = theirs.filter((r) => r.favorite);
    const users = (list: Reco[]) => list.map((r) => r.user);
    // A band someone wrote comes first (the latest one), yours included when nobody else wrote one.
    const own = (r: Reco) => !!r.band || r.stars != null;
    const quoted = [...theirs].reverse().find(own) ?? recosBy.get(title)?.find((r) => r.user === me && own(r));
    const ribbon: Ribbon | undefined = quoted
      ? { type: 'quote', reco: quoted }
      : direct.length
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
                : adored.length
                ? { type: 'loved', users: adored }
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

/** A band is narrow: a full name gives its first word. */
const first = (name?: string) => name?.trim().split(/\s+/)[0] ?? '';

/** "Léa", "Léa and Tom"; past two, the band counts instead. */
const names = (t: TFunction, users: string[], members: Record<string, Member>) => {
  const list = users.map((u) => first(members[u]?.name)).filter(Boolean);
  return list.length === 2 ? t('friends.and', { a: list[0], b: list[1] }) : list[0];
};

/** What a poster draws: the words, and for a band someone wrote, its colour, a quote's lettering and their stars. */
export interface Band {
  text: string;
  color?: string;
  quote?: boolean;
  /** 1–10 (half stars), drawn small above the words. */
  stars?: number;
}

/** "★★★★½" for a 1–10 rating. */
export const starsText = (rating: number) => '★'.repeat(Math.floor(rating / 2)) + (rating % 2 ? '½' : '');

/** A band someone wrote: their words quoted and signed, or just their name under their stars. */
export function quoteBand(t: TFunction, reco: Pick<Reco, 'band' | 'color' | 'stars'>, name: string): Band {
  return { text: reco.band ? t('friends.ribbon.quote', { quote: reco.band, name }) : name, color: BAND_COLORS[reco.color ?? 'red'], quote: true, stars: reco.stars };
}

export function bandOf(t: TFunction, ribbon: Ribbon, members: Record<string, Member>): Band {
  if (ribbon.type === 'quote') return quoteBand(t, ribbon.reco, first(members[ribbon.reco.user]?.name));
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
  const recos = useFriends((s) => s.recos);
  return useMemo(() => (me ? digest({ me, members, titles, ratings, recos }) : undefined), [me, members, titles, ratings, recos]);
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
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  return useMemo(() => {
    const mine = new Map<string, string>();
    const add = (kind: MediaKind, item: Shareable, href: string) => keysOf(kind, item).forEach((k) => mine.set(`${kind}/${k}`, href));
    Object.values(shows).forEach((s) => add('show', s, `/show/${s.tvmazeId}`));
    Object.values(movies).forEach((m) => add('movie', m, `/movie/${m.id}`));
    Object.values(books).forEach((b) => add('book', b, `/book/${b.id}`));
    Object.values(games).forEach((g) => add('game', g, `/game/${g.id}`));
    return (title) => {
      const local = title.keys.map((k) => mine.get(`${title.kind}/${k}`)).find(Boolean);
      return { href: local ?? hrefOf(title, tmdbKey), have: !!local };
    };
  }, [shows, movies, books, games, tmdbKey]);
}

export interface Suggestion {
  title: SharedTitle;
  recos: Reco[];
  /** The others' ratings of it, four stars and up. */
  ratings: SharedRating[];
  ribbon?: Ribbon;
}

/**
 * What the others recommend or rated four stars and up, that you don't have yet: meant for you first,
 * then favourites, then the tastes closest to yours.
 */
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
    for (const id of new Set([...d.recos.keys(), ...d.ratings.keys()])) {
      const title = titles[id];
      const recos = (d.recos.get(id) ?? []).filter((r) => r.user !== me);
      const ratings = (d.ratings.get(id) ?? []).filter((r) => r.user !== me && r.rating >= LOVED);
      if (!title || (!recos.length && !ratings.length) || dismissed.includes(id) || title.keys.some((k) => have.has(`${title.kind}/${k}`))) continue;
      const weight = (user: string) => 0.5 + (d.affinity.get(user) ?? 0.5);
      const score =
        recos.reduce((n, r) => n + (r.to === me ? 100 : 0) + (r.favorite ? 10 : 0) + 4 * weight(r.user), 0) + ratings.reduce((n, r) => n + (r.rating - 6) * weight(r.user), 0);
      out.push({ title, recos, ratings, ribbon: d.ribbons.get(id), score, at: Math.max(...recos.map((r) => r.at), ...ratings.map((r) => r.at)) });
    }
    return out.sort((a, b) => b.score - a.score || b.at - a.at);
  }, [me, d, titles, dismissed, shows, movies, books, games]);
}
