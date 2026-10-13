/** Pure helpers deriving where you are in a show. */
import { Episode, Show, ShowState } from './types';

export const hasAired = (e: Episode, now = Date.now()) => !!e.airstamp && e.airstamp <= now;
export const isWatched = (show: Show, e: Episode) => !!show.watched[e.id];
export const episodeCode = (e: Pick<Episode, 'season' | 'number'>) =>
  `S${String(e.season).padStart(2, '0')}E${String(e.number).padStart(2, '0')}`;

const byOrder = (a: Episode, b: Episode) => a.season - b.season || a.number - b.number;

/** In viewing order. Lists come sorted from the source: one already in order is returned as is. */
export function sortEpisodes(list: Episode[]) {
  for (let i = 1; i < list.length; i++) if (byOrder(list[i - 1], list[i]) > 0) return [...list].sort(byOrder);
  return list;
}

export interface Progress {
  aired: number;
  watched: number;
  /** Aired episodes not yet watched after the furthest one you watched. */
  left: number;
  /** The first of those: you pick up where you left off, not at the first gap. */
  next?: Episode;
  /** Those episodes, in order. */
  ahead: Episode[];
  /** Aired episodes left unwatched before the furthest one you watched (started mid-way, skipped). */
  skipped: Episode[];
  /** Next episode still to air. */
  upcoming?: Episode;
  /** How far along you are: skipped episodes count as behind you. */
  fraction: number;
}

/**
 * Progress per show, worked out again only when that show changes (a show is replaced, never edited,
 * when anything about it does) or when one of its episodes airs: ticking an episode costs one show,
 * not the whole library.
 */
const cache = new WeakMap<Show, { p: Progress; from: number; until: number }>();

export function progressOf(show: Show, now = Date.now()): Progress {
  const hit = cache.get(show);
  if (hit && now >= hit.from && now < hit.until) return hit.p;
  // The answer holds from the latest airing up to now until the next one.
  let from = -Infinity;
  let until = Infinity;
  for (const e of show.episodes) {
    if (!e.airstamp) continue;
    if (e.airstamp <= now) from = Math.max(from, e.airstamp);
    else until = Math.min(until, e.airstamp);
  }
  const p = computeProgress(show, now);
  cache.set(show, { p, from, until });
  return p;
}

function computeProgress(show: Show, now: number): Progress {
  const list = sortEpisodes(show.episodes);
  let furthest = -1;
  list.forEach((e, i) => {
    if (isWatched(show, e)) furthest = i;
  });
  let aired = 0;
  let watched = 0;
  let upcoming: Episode | undefined;
  const ahead: Episode[] = [];
  const skipped: Episode[] = [];
  list.forEach((e, i) => {
    const seen = isWatched(show, e);
    if (seen) watched++;
    if (hasAired(e, now)) {
      aired++;
      if (!seen) (i > furthest ? ahead : skipped).push(e);
    } else if (!upcoming && e.airstamp && i > furthest) upcoming = e;
  });
  const left = ahead.length;
  return { aired, watched, left, next: ahead[0], ahead, skipped, upcoming, fraction: aired ? Math.min(1, (aired - left) / aired) : 0 };
}

/** `p`: the show's progress when the caller already worked it out. */
export function showState(show: Show, now = Date.now(), p = progressOf(show, now)): ShowState {
  if (show.droppedAt) return 'dropped';
  if (p.watched === 0) return 'notStarted';
  if (p.next) return 'watching';
  return show.status === 'Ended' && !p.upcoming ? 'finished' : 'upToDate';
}

/** Minutes spent, from each watched episode's own runtime (or the show's). */
export function minutesWatched(show: Show) {
  let total = 0;
  for (const e of show.episodes) if (show.watched[e.id]) total += e.runtime ?? show.runtime ?? 0;
  return total;
}

/** Seasons as ordered groups. */
export function seasonsOf(episodes: Episode[]) {
  const map = new Map<number, Episode[]>();
  for (const e of sortEpisodes(episodes)) {
    const list = map.get(e.season) ?? [];
    list.push(e);
    map.set(e.season, list);
  }
  return [...map.entries()].map(([season, list]) => ({ season, episodes: list }));
}

const activities = new WeakMap<Show, number>();
/** When you last did something with a show: added it or ticked an episode. */
export function lastActivity(show: Show) {
  let at = activities.get(show);
  if (at == null) {
    at = show.addedAt;
    for (const id in show.watched) if (show.watched[id] > at) at = show.watched[id];
    activities.set(show, at);
  }
  return at;
}

/** Shows you are watching, last touched first, each with the episode you pick up at. */
export function upNextShows(shows: Record<string, Show>, now = Date.now()) {
  return Object.values(shows)
    .map((show) => ({ show, progress: progressOf(show, now) }))
    .map((s) => ({ ...s, state: showState(s.show, now, s.progress) }))
    .filter((s) => s.state === 'watching' && s.progress.next)
    .map((s) => ({ ...s, activity: lastActivity(s.show) }))
    .sort((a, b) => b.activity - a.activity)
    .map(({ show, progress }) => ({ show, next: progress.next!, left: progress.left }));
}
