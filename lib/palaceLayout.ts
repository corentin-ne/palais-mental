/**
 * Pure layout math shared by the store, the shelves, the camera and the hero.
 * Everything here is deterministic from item counts, so the hero can compute its
 * landing slot without touching scene-graph refs.
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
  width: number;
  depth: number;
  height: number;
}

export function getRoomDims(level: number): RoomDims {
  return {
    width: 10 + level * 2.5,
    depth: 9 + level * 2,
    height: 4.2 + level * 0.6,
  };
}

// ---------------------------------------------------------------- Zones
type Wall = 'back' | 'left' | 'right';
const ZONE_WALLS: Record<CategoryId, { wall: Wall; along: number }> = {
  // `along` = normalized offset along the wall, -0.5..0.5
  movies: { wall: 'back', along: -0.24 },
  series: { wall: 'back', along: 0.24 },
  music: { wall: 'left', along: -0.22 },
  books: { wall: 'left', along: 0.2 },
  boardgames: { wall: 'right', along: 0.2 },
  videogames: { wall: 'right', along: -0.22 },
};

export interface ZoneTransform {
  position: [number, number, number];
  rotationY: number;
  /** World-space direction the shelf faces (into the room). */
  normal: [number, number, number];
}

const WALL_GAP = 0.05;

export function getZoneTransform(category: CategoryId, dims: RoomDims): ZoneTransform {
  const { wall, along } = ZONE_WALLS[category];
  const hw = dims.width / 2;
  const hd = dims.depth / 2;
  switch (wall) {
    case 'back':
      return { position: [along * dims.width, 0, -hd + WALL_GAP], rotationY: 0, normal: [0, 0, 1] };
    case 'left':
      return { position: [-hw + WALL_GAP, 0, along * dims.depth], rotationY: Math.PI / 2, normal: [1, 0, 0] };
    case 'right':
      return { position: [hw - WALL_GAP, 0, along * dims.depth], rotationY: -Math.PI / 2, normal: [-1, 0, 0] };
  }
}

// ---------------------------------------------------------------- Shelf ("Fill" mechanic)
export const SHELF_BASE_Y = 0.55;
export const PLANK_THICKNESS = 0.035;
const BASE_SLOTS = 8;
const GROWTH_STEP = 4;
const MAX_SLOTS_PER_TIER = 20;

export interface ShelfLayout {
  tiers: number;
  slotsPerTier: number;
  length: number;
  tierHeight: number;
  /** Total height from floor to the top plank. */
  height: number;
  depth: number;
}

/**
 * The shelf first grows longer in GROWTH_STEP increments; once a tier holds
 * MAX_SLOTS_PER_TIER items a new tier spawns above it.
 */
export function getShelfLayout(category: CategoryId, count: number): ShelfLayout {
  const spec = CATEGORY_SPECS[category];
  const tiers = Math.max(1, Math.ceil(count / MAX_SLOTS_PER_TIER));
  const slotsPerTier =
    tiers > 1
      ? MAX_SLOTS_PER_TIER
      : Math.min(MAX_SLOTS_PER_TIER, Math.max(BASE_SLOTS, Math.ceil((count + 1) / GROWTH_STEP) * GROWTH_STEP));
  const tierHeight = spec.size[1] * spec.maxHeightScale + 0.1;
  return {
    tiers,
    slotsPerTier,
    length: slotsPerTier * spec.pitch + 0.12,
    tierHeight,
    height: SHELF_BASE_Y + tiers * tierHeight,
    depth: spec.size[2] + 0.08,
  };
}

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
  const x = -layout.length / 2 + 0.06 + spec.pitch * (col + 0.5);
  const y = SHELF_BASE_Y + tier * layout.tierHeight + PLANK_THICKNESS / 2 + (spec.size[1] * heightScale) / 2;
  const z = layout.depth / 2;
  return [x, y, z];
}

/** Rotate a zone-local point into world space. */
export function zoneToWorld(zone: ZoneTransform, local: [number, number, number]): [number, number, number] {
  const c = Math.cos(zone.rotationY);
  const s = Math.sin(zone.rotationY);
  const [lx, ly, lz] = local;
  return [zone.position[0] + lx * c + lz * s, zone.position[1] + ly, zone.position[2] - lx * s + lz * c];
}
