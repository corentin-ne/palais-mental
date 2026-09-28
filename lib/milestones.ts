/**
 * Small, visible goals. Each niche earns a new decorative object as it fills, and the
 * room itself grows at fixed totals. Showing "2 more" rather than a bare count uses the
 * goal-gradient effect: people speed up as the next reward gets close.
 */
import { ROOM_LEVEL_THRESHOLDS } from './palaceLayout';
import { CategoryId } from './types';

/** Item counts at which a niche unlocks its next decorative object. */
export const DECOR_THRESHOLDS = [1, 3, 7, 12, 20] as const;

/** Decor ids per niche, in unlock order (see components/3d/NicheDecor). */
export const DECOR: Record<CategoryId, readonly string[]> = {
  movies: ['plant', 'clapper', 'popcorn', 'reel', 'projector'],
  series: ['plant', 'remote', 'tv', 'mug', 'headphones'],
  music: ['plant', 'speaker', 'turntable', 'cassette', 'headphones'],
  books: ['plant', 'bookends', 'lamp', 'glasses', 'candle'],
  boardgames: ['plant', 'dice', 'meeples', 'hourglass', 'trophy'],
  videogames: ['plant', 'controller', 'cartridge', 'console', 'trophy'],
};

export function unlockedDecorCount(count: number) {
  return DECOR_THRESHOLDS.filter((t) => count >= t).length;
}

export function nextDecor(category: CategoryId, count: number) {
  const index = unlockedDecorCount(count);
  if (index >= DECOR_THRESHOLDS.length) return null;
  return { id: DECOR[category][index], at: DECOR_THRESHOLDS[index], remaining: DECOR_THRESHOLDS[index] - count };
}

/** Decor that the item just added unlocked, if any. */
export function decorUnlockedAt(category: CategoryId, countAfter: number) {
  const i = DECOR_THRESHOLDS.indexOf(countAfter as (typeof DECOR_THRESHOLDS)[number]);
  return i >= 0 ? DECOR[category][i] : null;
}

export function roomProgress(total: number) {
  let level = 0;
  ROOM_LEVEL_THRESHOLDS.forEach((t, i) => {
    if (total >= t) level = i;
  });
  const from = ROOM_LEVEL_THRESHOLDS[level];
  const to = ROOM_LEVEL_THRESHOLDS[level + 1];
  if (to === undefined) return { level, from, to: null as number | null, fraction: 1, remaining: 0 };
  return { level, from, to, fraction: (total - from) / (to - from), remaining: to - total };
}
