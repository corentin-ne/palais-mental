/**
 * The Social feed: everything the group shared, latest first, in one list. Reviews and episode messages
 * stand on their own; ratings without words are gathered per person and day, so a hundred ratings
 * shared at once read as one line instead of a hundred.
 */
import type { MediaKind } from './types';

// The shapes of what Social syncs (store/useFriends), restated here so this file stands alone.
export interface FeedTitle {
  id: number;
  kind: MediaKind;
  keys: string[];
  route: string;
  title: string;
  year?: number;
  poster?: string;
}
export interface FeedPost {
  id: number;
  user: string;
  title: number;
  episode: number;
  body: string;
  rating?: number;
  at: number;
  reactions: Record<string, string>;
}
type SharedTitle = FeedTitle;
type TitlePost = FeedPost;
type Member = { id: string; name: string };
type SharedRating = { user: string; title: number; rating: number; at: number };

export type FeedItem =
  | { type: 'review'; key: string; user: string; at: number; title: SharedTitle; post: TitlePost; rating?: number }
  | { type: 'talk'; key: string; user: string; at: number; title: SharedTitle; post: TitlePost }
  | { type: 'rated'; key: string; user: string; at: number; items: { title: SharedTitle; rating: number }[] };

interface Input {
  members: Record<string, Member>;
  titles: Record<number, SharedTitle>;
  ratings: SharedRating[];
  reviews: TitlePost[];
  talk: TitlePost[];
}

const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function buildFeed({ members, titles, ratings, reviews, talk }: Input): FeedItem[] {
  const out: FeedItem[] = [];
  const rating = new Map(ratings.map((r) => [`${r.user}/${r.title}`, r.rating]));
  const worded = new Set<string>();

  for (const p of reviews) {
    const title = titles[p.title];
    if (!title || !members[p.user]) continue;
    worded.add(`${p.user}/${p.title}`);
    out.push({ type: 'review', key: `r${p.id}`, user: p.user, at: p.at, title, post: p, rating: rating.get(`${p.user}/${p.title}`) ?? p.rating });
  }
  for (const p of talk) {
    const title = titles[p.title];
    if (!title || !members[p.user]) continue;
    out.push({ type: 'talk', key: `t${p.id}`, user: p.user, at: p.at, title, post: p });
  }
  const days = new Map<string, Extract<FeedItem, { type: 'rated' }>>();
  for (const r of ratings) {
    const title = titles[r.title];
    if (!title || !members[r.user] || worded.has(`${r.user}/${r.title}`)) continue;
    const key = `d${r.user}/${dayOf(r.at)}`;
    const group = days.get(key) ?? days.set(key, { type: 'rated', key, user: r.user, at: 0, items: [] }).get(key)!;
    group.items.push({ title, rating: r.rating });
    group.at = Math.max(group.at, r.at);
  }
  for (const g of days.values()) {
    g.items.sort((a, b) => b.rating - a.rating);
    out.push(g);
  }
  return out.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}
