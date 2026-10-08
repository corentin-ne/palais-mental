/** Pure helpers deriving where you are in a show. */
import { Episode, Show, ShowState } from './types';

export const hasAired = (e: Episode, now = Date.now()) => !!e.airstamp && e.airstamp <= now;
export const isWatched = (show: Show, e: Episode) => !!show.watched[e.id];
export const episodeCode = (e: Pick<Episode, 'season' | 'number'>) =>
  `S${String(e.season).padStart(2, '0')}E${String(e.number).padStart(2, '0')}`;

export function sortEpisodes(list: Episode[]) {
  return [...list].sort((a, b) => a.season - b.season || a.number - b.number);
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

export function progressOf(show: Show, now = Date.now()): Progress {
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

export function showState(show: Show, now = Date.now()): ShowState {
  if (show.droppedAt) return 'dropped';
  const p = progressOf(show, now);
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
