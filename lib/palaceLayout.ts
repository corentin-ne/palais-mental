/**
 * Pure layout math shared by the store, the niches, the camera and the hero.
 * Everything here is deterministic from item counts, so the hero can compute its
 * landing slot without touching scene-graph refs.
 *
 * The palace is a single round, cornerless space: a flat floor that curves up into
 * a cylindrical wall and closes in a soft dome. The window is cut into the wall at
 * the front (-z); the six collections stand around the circle, all facing the center.
 */
import { CategoryId } from './types';
import { CATEGORY_SPECS } from './itemVisuals';

// ---------------------------------------------------------------- Global expansion
/** Total-item thresholds; reaching index N unlocks room level N. */
export const ROOM_LEVEL_THRESHOLDS = [0, 20, 50, 100, 200, 400, 800] as const;

export function getRoomLevel(totalItems: number): number {
  let level = 0;
  ROOM_LEVEL_THRESHOLDS.forEach((threshold, i) => {
    if (totalItems >= threshold) level = i;
  });
  return level;
}

export interface RoomDims {
  /** Radius of the cylindrical wall. */
  radius: number;
  /** Height at which the wall starts curving into the dome. */
  wallHeight: number;
  /** Rise of the dome above the wall. */
  domeHeight: number;
}

/** The space breathes outward as the palace fills. */
export function getRoomDims(level: number): RoomDims {
  return { radius: 5.6 + level * 0.8, wallHeight: 3.9 + level * 0.15, domeHeight: 2.4 };
}

/** Radius of the floor-to-wall cove. Nothing in the room meets at an angle. */
export const COVE_RADIUS = 0.9;

// ---------------------------------------------------------------- Window & sun
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
export const WINDOW_TOP = WINDOW.springLine + WINDOW.halfWidth;
export const WINDOW_CENTER_Y = (WINDOW.sill + WINDOW_TOP) / 2;

/**
 * Direction sunlight travels INTO the room (steep, from above the window).
 * Art-directed rather than physical: the visible sun sits low in the arch
 * (SUN_VISUAL_DIR) while the shafts fall steeply and pool on the floor between
 * the viewer and the window instead of washing over the camera.
 */
export const SUN_LIGHT_DIR: [number, number, number] = normalize3([0.2, -0.58, 1]);
export const SUN_VISUAL_DIR: [number, number, number] = normalize3([-0.06, 0.2, -1]);

function normalize3([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** World-space z of the window plane. */
export const windowPlaneZ = (dims: RoomDims) => -dims.radius;

// ---------------------------------------------------------------- Zones
/**
 * Angle of each collection around the circle, clockwise from the window (0°) when
 * seen from above. Walking this list is also the swipe order in the UI.
 */
export const ZONE_ANGLES: Record<CategoryId, number> = {
  movies: 52,
  series: 104,
  music: 156,
  videogames: -156,
  boardgames: -104,
  books: -52,
};

/** Home first, then every collection in turn-of-the-head order. */
export const ZONE_SEQUENCE = ['window', 'movies', 'series', 'music', 'videogames', 'boardgames', 'books'] as const;

export interface ZoneTransform {
  position: [number, number, number];
  rotationY: number;
  /** World-space direction the niche faces (toward the center of the room). */
  normal: [number, number, number];
}

/**
 * A niche's back sits against the curved wall. Its outer corners are kept just
 * inside the cylinder, so wider niches step slightly toward the center.
 */
export function getZoneTransform(category: CategoryId, dims: RoomDims, outerWidth = 0): ZoneTransform {
  const theta = (ZONE_ANGLES[category] * Math.PI) / 180;
  const r = dims.radius - 0.04;
  const d = Math.sqrt(Math.max(1, r * r - (outerWidth / 2) ** 2)) - 0.03;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  return { position: [d * sin, 0, -d * cos], rotationY: -theta, normal: [-sin, 0, cos] };
}

/** Rotate a zone-local point into world space. */
export function zoneToWorld(zone: ZoneTransform, local: [number, number, number]): [number, number, number] {
  const c = Math.cos(zone.rotationY);
  const s = Math.sin(zone.rotationY);
  const [lx, ly, lz] = local;
  return [zone.position[0] + lx * c + lz * s, zone.position[1] + ly, zone.position[2] - lx * s + lz * c];
}

// ---------------------------------------------------------------- Niches ("Fill" mechanic)
/** Inner floor of every niche: contents meet the eye-level camera. */
export const NICHE_BASE_Y = 0.82;
export const NICHE_BORDER = 0.075;
export const PLANK_THICKNESS = 0.028;
const SIDE_PADDING = 0.07;
const BASE_SLOTS = 8;
const GROWTH_STEP = 4;
const MAX_SLOTS_PER_TIER = 20;

export interface ShelfLayout {
  tiers: number;
  slotsPerTier: number;
  /** Inner width of the niche. */
  length: number;
  tierHeight: number;
  /** Clear space under the arch above the top tier. */
  archSpace: number;
  /** Inner height of the niche (tiers + arch). */
  innerHeight: number;
  /** World height of the niche's outer top. */
  height: number;
  depth: number;
}

/**
 * The niche first grows wider in GROWTH_STEP increments; once a tier holds
 * MAX_SLOTS_PER_TIER items a new tier spawns and the arch rises.
 */
export function getShelfLayout(category: CategoryId, count: number): ShelfLayout {
  const spec = CATEGORY_SPECS[category];
  const tiers = Math.max(1, Math.ceil(count / MAX_SLOTS_PER_TIER));
  const slotsPerTier =
    tiers > 1
      ? MAX_SLOTS_PER_TIER
      : Math.min(MAX_SLOTS_PER_TIER, Math.max(BASE_SLOTS, Math.ceil((count + 1) / GROWTH_STEP) * GROWTH_STEP));
  const length = slotsPerTier * spec.pitch + SIDE_PADDING * 2;
  const tierHeight = spec.size[1] * spec.maxHeightScale + spec.peek + PLANK_THICKNESS + 0.06;
  const archSpace = Math.min(length / 2, 0.36);
  const innerHeight = tiers * tierHeight + archSpace;
  return {
    tiers,
    slotsPerTier,
    length,
    tierHeight,
    archSpace,
    innerHeight,
    height: NICHE_BASE_Y + innerHeight + NICHE_BORDER,
    depth: spec.size[2] + 0.1,
  };
}

export const nicheOuterWidth = (layout: Pick<ShelfLayout, 'length'>) => layout.length + NICHE_BORDER * 2;

/** Local (zone-space) position of slot `index`. Items rest on their tier plank. */
export function getSlotLocalPosition(
  category: CategoryId,
  index: number,
  layout: ShelfLayout,
  heightScale: number,
): [number, number, number] {
  const spec = CATEGORY_SPECS[category];
  const tier = Math.floor(index / layout.slotsPerTier);
  const col = index % layout.slotsPerTier;
  const x = -layout.length / 2 + SIDE_PADDING + spec.pitch * (col + 0.5);
  const y = NICHE_BASE_Y + tier * layout.tierHeight + PLANK_THICKNESS + (spec.size[1] * heightScale) / 2;
  const z = 0.035 + spec.size[2] / 2;
  return [x, y, z];
}

/** Zone transform + slot for an item, as the hero and the inspector need it. */
export function getSlotWorld(category: CategoryId, index: number, count: number, dims: RoomDims, heightScale: number) {
  const layout = getShelfLayout(category, count);
  const zone = getZoneTransform(category, dims, nicheOuterWidth(layout));
  return { zone, layout, position: zoneToWorld(zone, getSlotLocalPosition(category, index, layout, heightScale)) };
}
