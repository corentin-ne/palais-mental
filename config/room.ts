/**
 * The room: size and growth, the window, the sun, and where each collection stands.
 * Every value here can be changed freely; the layout, camera and shaders read from it.
 */
import type { CategoryId } from '@/lib/types';

/** Total object counts at which the room grows one level. */
export const ROOM_LEVEL_THRESHOLDS = [0, 20, 50, 100, 200, 400, 800] as const;

export const ROOM = {
  /** Radius of the round wall at level 0, and how much it widens per level (m). */
  radius: 5.6,
  radiusPerLevel: 0.8,
  /** Height where the wall starts curving into the dome, and its growth per level. */
  wallHeight: 3.9,
  wallHeightPerLevel: 0.15,
  domeHeight: 2.4,
  /** Radius of the floor-to-wall cove. */
  coveRadius: 0.9,
} as const;

/**
 * The arched window, in window-plane coords (x centered, y from the floor).
 * Shape = rounded-bottom rectangle [sill, springLine] topped by a semicircular arch.
 */
export const WINDOW = {
  halfWidth: 1.2,
  sill: 0.62,
  springLine: 2.25,
  cornerRadius: 0.26,
  frame: 0.16,
} as const;

/**
 * Direction sunlight travels into the room, and where the sun is drawn in the sky.
 * Art-directed rather than physical: the visible sun sits low in the arch while the
 * shafts fall steeply and pool on the floor between the viewer and the window.
 */
export const SUN = {
  light: [0.2, -0.58, 1] as [number, number, number],
  visual: [-0.06, 0.2, -1] as [number, number, number],
};

/**
 * Fixed pieces that collections can gather around, by angle (degrees clockwise from the
 * window, seen from above) and width along the wall (m). Drawn by config/decor.
 */
export const ANCHORS = {
  tv: { angle: 104, width: 1.5 },
  hifi: { angle: 150, width: 0.9 },
} as const;
export type AnchorId = keyof typeof ANCHORS;

/**
 * Where each collection stands: either at a fixed angle, or right beside an anchor or
 * another collection (`side` -1 = to its left, 1 = to its right, as seen from the room).
 * Beside-placed furniture slides along the wall as its neighbours grow.
 */
export type ZonePlacement = { angle: number } | { beside: AnchorId | CategoryId; side: -1 | 1 };

export const ZONES: Record<CategoryId, ZonePlacement> = {
  movies: { beside: 'tv', side: -1 },
  series: { beside: 'movies', side: -1 },
  videogames: { beside: 'tv', side: 1 },
  music: { beside: 'hifi', side: 1 },
  boardgames: { angle: -104 },
  books: { angle: -54 },
};

/** Space left between neighbours placed side by side (m). */
export const ZONE_GAP = 0.14;

/** Home first, then every collection in the order a swipe walks through them. */
export const ZONE_SEQUENCE = ['window', 'series', 'movies', 'videogames', 'music', 'boardgames', 'books'] as const;
