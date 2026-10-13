/**
 * Friends: what a few people share with each other, and nothing else. Ratings and reviews (once you turn
 * that on) and what is said about an episode go to the server; the library, progress and history
 * never do. Everything read back is kept on the device (`useFriends`), so pages draw offline.
 */
import { AppState } from 'react-native';

import { norm } from './api';
import { ApiError, all, api, currentUser, forgetSession, rpc, signIn } from './supabase';
import { Book, Game, MediaKind, Movie, Show } from './types';
import { BandColor, FriendsData, Member, Post, Reco, SharedRating, SharedTitle, TitlePost, useFriends } from '@/store/useFriends';
import { useLibrary } from '@/store/useLibrary';

/** What a title needs to be shared: the fields the library and the detail pages both have. */
export type Shareable =
  | Pick<Show, 'tvmazeId' | 'imdbId' | 'title' | 'year' | 'poster'>
  | Pick<Movie, 'id' | 'source' | 'sourceId' | 'imdbId' | 'wikidataId' | 'title' | 'year' | 'poster'>
  | Pick<Book, 'id' | 'source' | 'sourceId' | 'isbn' | 'wikidataId' | 'title' | 'year' | 'cover' | 'authors'>
  | Pick<Game, 'id' | 'source' | 'sourceId' | 'steamId' | 'wikidataId' | 'title' | 'year' | 'cover'>;

/**
 * Every key a title is known by. Two phones rarely hold the same id for it (TMDB here, IMDb there):
 * they meet on any key they share, down to the title itself with its year (or its author, for a book).
 */
export function keysOf(kind: MediaKind, item: Shareable): string[] {
  const any = item as { tvmazeId?: number; imdbId?: string; source?: string; sourceId?: string; steamId?: string; isbn?: string; wikidataId?: string; authors?: string[] };
  const named = norm(item.title);
  const keys =
    kind === 'show'
      ? [`tvmaze:${any.tvmazeId}`, any.imdbId && `imdb:${any.imdbId}`]
      : [
          `${any.source}:${any.sourceId}`,
          any.imdbId && `imdb:${any.imdbId}`,
          any.steamId && `steam:${any.steamId}`,
          any.isbn && `isbn:${any.isbn}`,
          any.wikidataId && `wd:${any.wikidataId}`,
          kind === 'book' ? named && any.authors?.[0] && `t:${named}|${norm(any.authors[0])}` : named && item.year && `t:${named}|${item.year}`,
        ];
  return [...new Set(keys.filter((k): k is string => !!k))];
}

/** A title's key in the library (`kind/id`): what a per-rating choice is kept under. */
export const localKey = (kind: MediaKind, item: Shareable) => `${kind}/${routeOf(kind, item)}`;
const routeOf = (kind: MediaKind, item: Shareable) => (kind === 'show' ? String((item as Show).tvmazeId) : (item as Movie).id);
const artOf = (item: Shareable) => ('cover' in item ? item.cover : (item as Show).poster);

const indexes = new WeakMap<Record<number, SharedTitle>, Map<string, number>>();
/** `kind/key` → title id, for the titles friends share. */
function indexOf(titles: Record<number, SharedTitle>) {
  let index = indexes.get(titles);
  if (!index) {
    index = new Map();
    for (const t of Object.values(titles)) for (const k of t.keys) if (!index.has(`${t.kind}/${k}`)) index.set(`${t.kind}/${k}`, t.id);
    indexes.set(titles, index);
  }
  return index;
}

/** The shared title this one is, when a friend (or you) has shared something about it. */
export function findTitle(titles: Record<number, SharedTitle>, kind: MediaKind, item: Shareable): number | undefined {
  const index = indexOf(titles);
  for (const k of keysOf(kind, item)) {
    const id = index.get(`${kind}/${k}`);
    if (id != null) return id;
  }
  return undefined;
}

/** Where a shared title opens on this phone. A TMDB film needs a key: without one it opens through IMDb. */
export function hrefOf(title: SharedTitle, tmdbKey?: string) {
  if (title.kind === 'movie' && title.route.startsWith('tmdb-') && !tmdbKey) {
    const imdb = title.keys.find((k) => k.startsWith('imdb:'));
    if (imdb) return `/movie/imdb-${imdb.slice(5)}`;
  }
  return `/${title.kind}/${title.route}`;
}

// ------------------------------------------------------------------ Reading
interface TitleRow {
  id: number;
  kind: MediaKind;
  keys: string[];
  route: string;
  title: string;
  year: number | null;
  poster: string | null;
}
/** Where the app's own sources keep their artwork: the only hosts a shared poster may come from. */
const ART_HOSTS = ['tvmaze.com', 'tmdb.org', 'media-amazon.com', 'mzstatic.com', 'steamstatic.com', 'steampowered.com', 'openlibrary.org', 'archive.org', 'google.com', 'googleusercontent.com', 'wikimedia.org'];
/**
 * A shared title is someone else's input: its poster is drawn only from a host the app already talks to
 * (else a member could point it at a server of theirs and see who opens the app, and when), and its route
 * only when it is a plain id.
 */
const safeArt = (url: string | null) => {
  const host = /^https:\/\/([a-z0-9.-]+)\//i.exec(url ?? '')?.[1]?.toLowerCase();
  return host && ART_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? url! : undefined;
};
const titleOf = (r: TitleRow): SharedTitle => ({ id: r.id, kind: r.kind, keys: r.keys, route: /^[\w.:-]+$/.test(r.route) ? r.route : '0', title: r.title, year: r.year ?? undefined, poster: safeArt(r.poster) });
/**
 * The server's timestamps ("2026-10-10T21:09:57.63743+00:00") read by hand: Android's engine (Hermes)
 * rejects the microseconds, and a date it can't read would put every rating in 1970.
 */
export function ms(iso: string) {
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d):(\d\d)(?:\.(\d+))?(?:Z|([+-])(\d\d):?(\d\d))?/.exec(iso ?? '');
  if (!m) return 0;
  const offset = m[8] ? (m[8] === '-' ? -1 : 1) * (Number(m[9]) * 60 + Number(m[10])) : 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], Number(`0.${m[7] ?? 0}`) * 1000) - offset * 60_000;
}

/**
 * A review is a post on episode 0: no episode has that id, so versions that only know episode talk never
 * show it, and the database did not have to change for it.
 */
export const REVIEW = 0;
/** How many episode messages the feed reads. */
const TALK = 80;
const POST_FIELDS = 'id,user_id,title_id,episode_id,body,rating,created_at,post_reactions(user_id,emoji)';

async function fetchAll(): Promise<FriendsData> {
  const [members, titles, ratings, recos, reviews, talk] = await Promise.all([
    all<{ user_id: string; name: string; joined_at: string }>('members?select=user_id,name,joined_at&order=joined_at.asc,user_id.asc'),
    all<TitleRow>('titles?select=id,kind,keys,route,title,year,poster&order=id.asc'),
    all<{ user_id: string; title_id: number; rating: number; updated_at: string }>('ratings?select=user_id,title_id,rating,updated_at&order=title_id.asc,user_id.asc'),
    all<{ user_id: string; title_id: number; note: string | null; band: string | null; band_color: BandColor | null; band_rating: number | null; favorite: boolean; to_user: string | null; created_at: string }>(
      'recos?select=user_id,title_id,note,band,band_color,band_rating,favorite,to_user,created_at&order=title_id.asc,user_id.asc',
    ),
    all<PostRow>(`posts?select=${POST_FIELDS}&episode_id=eq.${REVIEW}&order=created_at.desc,id.desc`),
    api<PostRow[]>(`posts?select=${POST_FIELDS}&episode_id=gt.${REVIEW}&order=created_at.desc,id.desc&limit=${TALK}`),
  ]);
  return {
    members: Object.fromEntries(members.map((m): [string, Member] => [m.user_id, { id: m.user_id, name: m.name, joinedAt: ms(m.joined_at) }])),
    titles: Object.fromEntries(titles.map((t) => [t.id, titleOf(t)])),
    ratings: ratings.map((r): SharedRating => ({ user: r.user_id, title: r.title_id, rating: r.rating, at: ms(r.updated_at) })),
    recos: recos.map((r): Reco => ({ user: r.user_id, title: r.title_id, note: r.note ?? undefined, band: r.band ?? undefined, color: r.band_color ?? undefined, stars: r.band_rating ?? undefined, favorite: r.favorite, to: r.to_user ?? undefined, at: ms(r.created_at) })),
    reviews: reviews.map(titlePostOf),
    talk: talk.map(titlePostOf),
  };
}

const FRESH = 3 * 60_000;
let pass: Promise<void> | undefined;
/** Reviews were read from the server since launch: until then, yours can't be told apart from new ones. */
let reviewsRead = false;

/** Read what friends shared, then send your ratings if you share them. Quiet when offline. */
export function syncFriends(force = false) {
  const { me, syncedAt } = useFriends.getState();
  if (!me || (!force && Date.now() - syncedAt < FRESH)) return pass ?? Promise.resolve();
  return (pass ??= (async () => {
    try {
      const data = await fetchAll();
      // No longer in the group (you left from another device): back to the app as it was.
      if (!data.members[me]) return useFriends.getState().reset();
      useFriends.getState().set({ ...data, syncedAt: Date.now() });
      reviewsRead = true;
      await pushRatings();
    } catch {
      // Offline, or the server is asleep: what is on the device stays.
    }
  })().finally(() => {
    pass = undefined;
  }));
}

// ------------------------------------------------------------------ Titles
type Entry = { kind: MediaKind; item: Shareable };

/** The shared ids of these titles, creating the ones nobody has shared yet. */
async function ensureTitles(entries: Entry[]): Promise<number[]> {
  const known = useFriends.getState().titles;
  const ids = entries.map((e) => findTitle(known, e.kind, e.item));
  const missing = entries.map((e, i) => ({ e, i })).filter(({ i }) => ids[i] == null);
  const added: Record<number, SharedTitle> = {};
  for (let from = 0; from < missing.length; from += 200) {
    const chunk = missing.slice(from, from + 200);
    const items = chunk.map(({ e }) => ({ kind: e.kind, keys: keysOf(e.kind, e.item), route: routeOf(e.kind, e.item), title: e.item.title, year: e.item.year ?? null, poster: artOf(e.item) ?? null }));
    const made = await rpc<number[]>('upsert_titles', { items });
    chunk.forEach(({ e, i }, n) => {
      ids[i] = made[n];
      // The server may have merged it into a title another key already named: its keys are read at the next sync.
      added[made[n]] = known[made[n]] ?? { id: made[n], kind: e.kind, keys: items[n].keys, route: items[n].route, title: e.item.title, year: e.item.year, poster: artOf(e.item) };
    });
  }
  if (missing.length) useFriends.getState().set({ titles: { ...useFriends.getState().titles, ...added } });
  return ids as number[];
}

// ------------------------------------------------------------------ Ratings and reviews
type Local = Entry & { rating?: number; review?: string };

/** Everything you rated or wrote a few words about. */
function localTakes(): Local[] {
  const { shows, movies, books, games } = useLibrary.getState();
  const of = <T extends Shareable & { rating?: number; review?: string }>(kind: MediaKind, list: T[]) =>
    list.filter((i) => i.rating != null || !!i.review?.trim()).map((item) => ({ kind, item, rating: item.rating, review: item.review?.trim() || undefined }));
  return [...of('show', Object.values(shows)), ...of('movie', Object.values(movies)), ...of('book', Object.values(books)), ...of('game', Object.values(games))];
}

/** New reviews sent in one pass: the server caps posts per day, the rest go at the next sync. */
const NEW_REVIEWS = 40;
const REVIEW_MAX = 1000;

let pushing: Promise<void> | undefined;

/**
 * Make the server's copy of your ratings and reviews match what you chose to show: all of them when you
 * share them, none when you don't, and either way the ones you decided on one by one.
 */
export function pushRatings() {
  return (pushing ??= (async () => {
    const { me, shareRatings, shareReviews, shared, ratings, reviews } = useFriends.getState();
    // An unread library has no ratings: sending that would wipe yours from the server.
    if (!me || !useLibrary.persist.hasHydrated()) return;
    const mine = new Map(ratings.filter((r) => r.user === me).map((r) => [r.title, r.rating]));
    const myReviews = reviews.filter((r) => r.user === me);
    const local = localTakes().filter((l) => shared[localKey(l.kind, l.item)] ?? shareRatings);
    if (!local.length && !mine.size && !myReviews.length) return;
    const ids = await ensureTitles(local);

    const wanted = new Map<number, number>();
    const words = new Map<number, { body: string; rating?: number }>();
    local.forEach((l, i) => {
      if (l.rating != null) wanted.set(ids[i], Math.max(l.rating, wanted.get(ids[i]) ?? 0));
      // Reviews were private before 1.11: they leave the phone only once you said so (shareReviews).
      if (shareReviews && l.review && !words.has(ids[i])) words.set(ids[i], { body: l.review.slice(0, REVIEW_MAX), rating: l.rating });
    });

    const changed = [...wanted].filter(([title, rating]) => mine.get(title) !== rating);
    const gone = [...mine.keys()].filter((title) => !wanted.has(title));
    if (changed.length) await api('ratings?on_conflict=user_id,title_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: changed.map(([title_id, rating]) => ({ title_id, rating })) });
    for (let from = 0; from < gone.length; from += 100) await api(`ratings?user_id=eq.${me}&title_id=in.(${gone.slice(from, from + 100).join(',')})`, { method: 'DELETE' });
    if (changed.length || gone.length) {
      const now = Date.now();
      const kept = new Map(useFriends.getState().ratings.filter((r) => r.user === me).map((r) => [r.title, r]));
      useFriends.getState().set({
        ratings: [
          ...useFriends.getState().ratings.filter((r) => r.user !== me),
          ...[...wanted].map(([title, rating]): SharedRating => (kept.get(title)?.rating === rating ? kept.get(title)! : { user: me, title, rating, at: now })),
        ],
      });
    }

    // Reviews: one post per title; an edit brings it back to the top of the feed.
    if (!reviewsRead) return;
    const held = new Map<number, TitlePost>();
    const extra: number[] = [];
    for (const r of myReviews) {
      if (!held.has(r.title) && words.has(r.title)) held.set(r.title, r);
      else extra.push(r.id);
    }
    const edits = [...words].filter(([title, w]) => held.has(title) && (held.get(title)!.body !== w.body || held.get(title)!.rating !== w.rating));
    const fresh = [...words].filter(([title]) => !held.has(title)).slice(0, NEW_REVIEWS);
    const updated = new Map<number, TitlePost>();
    for (const [title, w] of edits) {
      const at = new Date().toISOString();
      await api(`posts?id=eq.${held.get(title)!.id}`, { method: 'PATCH', body: { body: w.body, rating: w.rating ?? null, created_at: at } });
      updated.set(title, { ...held.get(title)!, body: w.body, rating: w.rating, at: ms(at) });
    }
    const made = fresh.length
      ? await api<PostRow[]>('posts', { method: 'POST', prefer: 'return=representation', body: fresh.map(([title_id, w]) => ({ title_id, episode_id: REVIEW, body: w.body, rating: w.rating ?? null })) })
      : [];
    for (let from = 0; from < extra.length; from += 100) await api(`posts?id=in.(${extra.slice(from, from + 100).join(',')})`, { method: 'DELETE' });
    if (edits.length || made.length || extra.length) {
      const dropped = new Set(extra);
      useFriends.getState().set({
        reviews: [...made.map(titlePostOf), ...useFriends.getState().reviews.filter((r) => !dropped.has(r.id)).map((r) => (r.user === me && updated.get(r.title)?.id === r.id ? updated.get(r.title)! : r))],
      });
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      pushing = undefined;
    }));
}

/** Share every rating and review, or none (except those decided one by one). */
export function setShareRatings(shareRatings: boolean) {
  useFriends.getState().set(shareRatings ? { shareRatings, shareReviews: true } : { shareRatings });
  return pushRatings();
}

/** Show or hide one rating and review, whatever the general rule. */
export function setRatingShared(kind: MediaKind, item: Shareable, on: boolean) {
  useFriends.getState().set({ shared: { ...useFriends.getState().shared, [localKey(kind, item)]: on }, ...(on && { shareReviews: true }) });
  return pushRatings();
}

// ------------------------------------------------------------------ Joining
export type JoinError = 'full' | 'taken' | 'offline';

/** Choosing a name is joining: everyone is in the same group. Resolves to an error name, or nothing. */
export async function joinFriends(name: string, retry = true): Promise<JoinError | undefined> {
  try {
    const me = await signIn();
    const result = await rpc<{ ok: boolean; error?: string }>('join_base', { name });
    if (!result.ok) return result.error === 'full' || result.error === 'taken' ? result.error : 'offline';
    useFriends.getState().set({ me, syncedAt: 0 });
    await syncFriends(true);
    return undefined;
  } catch (err) {
    // The server answered but refuses this device's account (it was deleted there): start over with a new one.
    if (retry && err instanceof ApiError && [401, 403, 409].includes(err.status)) {
      await forgetSession();
      return joinFriends(name, false);
    }
    return 'offline';
  }
}

/** Change your name (it has to be free). Resolves to an error name, or nothing. */
export async function rename(name: string): Promise<JoinError | undefined> {
  const { me, members } = useFriends.getState();
  if (!me) return undefined;
  const result = await rpc<{ ok: boolean; error?: string }>('join_base', { name });
  if (!result.ok) return result.error === 'taken' ? 'taken' : 'offline';
  useFriends.getState().set({ members: { ...members, [me]: { ...members[me], name } } });
  return undefined;
}

/** Leave: everything you shared is deleted from the server, and the app is back to what it was. */
export async function leaveFriends() {
  const me = await currentUser();
  if (me) await api(`members?user_id=eq.${me}`, { method: 'DELETE' });
  useFriends.getState().reset();
}

// ------------------------------------------------------------------ Episode talk
interface PostRow {
  id: number;
  title_id?: number;
  user_id: string;
  episode_id: number;
  body: string;
  rating: number | null;
  created_at: string;
  post_reactions?: { user_id: string; emoji: string }[];
}
const postOf = (r: PostRow): Post => ({
  id: r.id,
  user: r.user_id,
  episode: r.episode_id,
  body: r.body,
  rating: r.rating ?? undefined,
  at: ms(r.created_at),
  reactions: Object.fromEntries((r.post_reactions ?? []).map((x) => [x.user_id, x.emoji])),
});
const titlePostOf = (r: PostRow): TitlePost => ({ ...postOf(r), title: r.title_id ?? 0 });
/** A change to one post, wherever it is shown: a show's thread, the reviews, the feed. */
const setPosts = (title: number, fn: (posts: Post[]) => Post[]) => {
  const { posts, reviews, talk } = useFriends.getState();
  const apply = (list: TitlePost[]) => {
    const others = list.filter((p) => p.title !== title);
    const changed = fn(list.filter((p) => p.title === title));
    return [...others, ...changed.map((p) => ({ ...p, title }))].sort((a, b) => b.at - a.at || b.id - a.id);
  };
  useFriends.getState().set({ posts: posts[title] ? { ...posts, [title]: fn(posts[title]) } : posts, reviews: apply(reviews), talk: apply(talk) });
};

/** Everything said about a show's episodes. What you may read (episodes you have seen) is decided on the device. */
export async function loadPosts(title: number) {
  try {
    const rows = await all<PostRow>(`posts?select=id,user_id,episode_id,body,rating,created_at,post_reactions(user_id,emoji)&title_id=eq.${title}&episode_id=gt.${REVIEW}&order=created_at.asc,id.asc`);
    const { posts } = useFriends.getState();
    useFriends.getState().set({ posts: { ...posts, [title]: rows.map(postOf) } });
  } catch {
    // Offline: the thread shows what it had.
  }
}

export async function addPost(show: Shareable, episode: number, body: string, rating?: number) {
  const [title] = await ensureTitles([{ kind: 'show', item: show }]);
  const [row] = await api<PostRow[]>('posts', { method: 'POST', prefer: 'return=representation', body: { title_id: title, episode_id: episode, body: body.trim(), rating: rating ?? null } });
  const { posts, talk } = useFriends.getState();
  useFriends.getState().set({ posts: { ...posts, [title]: [...(posts[title] ?? []), postOf(row)] }, talk: [{ ...postOf(row), title }, ...talk].slice(0, TALK) });
}

export async function removePost(title: number, id: number) {
  await api(`posts?id=eq.${id}`, { method: 'DELETE' });
  setPosts(title, (posts) => posts.filter((p) => p.id !== id));
}

/** React to a post with one emoji; the same one again takes it back. */
export async function react(title: number, post: Post, emoji: string) {
  const { me } = useFriends.getState();
  if (!me) return;
  const off = post.reactions[me] === emoji;
  if (off) await api(`post_reactions?post_id=eq.${post.id}&user_id=eq.${me}`, { method: 'DELETE' });
  else await api('post_reactions?on_conflict=post_id,user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { post_id: post.id, emoji } });
  setPosts(title, (posts) =>
    posts.map((p) => {
      if (p.id !== post.id) return p;
      const reactions = { ...p.reactions };
      if (off) delete reactions[me];
      else reactions[me] = emoji;
      return { ...p, reactions };
    }),
  );
}


// ------------------------------------------------------------------ Lifecycle
/** Keeps friends in step: at launch, when the app comes back, and a moment after a rating changes. */
export function startFriends() {
  // A launch always reads; coming back to the app reads again only once what it has is a few minutes old.
  const launch = () => void syncFriends(true);
  if (useFriends.persist.hasHydrated()) launch();
  const unhydrate = useFriends.persist.onFinishHydration(launch);
  const sub = AppState.addEventListener('change', (s) => s === 'active' && void syncFriends());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = useLibrary.subscribe((s, prev) => {
    const { me } = useFriends.getState();
    if (!me || (s.shows === prev.shows && s.movies === prev.movies && s.books === prev.books && s.games === prev.games)) return;
    clearTimeout(timer);
    timer = setTimeout(pushRatings, 4000);
  });
  return () => {
    unhydrate();
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
