/**
 * Pure layout math shared by the store, the furniture, the camera and the hero.
 * Everything here is deterministic from item counts, so the hero can compute its
 * landing slot without touching scene-graph refs.
 *
 * The palace is a single round, cornerless space: a flat floor that curves up into
 * a cylindrical wall and closes in a soft dome. The window is cut into the wall at
 * the front (-z); the six collections stand around the circle, all facing the center.
 */
import { CategoryId, PalaceItem } from './types';
import { CATEGORY_SPECS, getItemScale } from './itemVisuals';

import { ANCHORS, AnchorId, ROOM, ROOM_LEVEL_THRESHOLDS, SUN, WINDOW, ZONES, ZONE_GAP, ZONE_SEQUENCE } from '@/config/room';
import { CARCASS, FurnitureStage, STAGES, STAGE_THRESHOLDS } from '@/config/furniture';

export { ROOM_LEVEL_THRESHOLDS, STAGE_THRESHOLDS, WINDOW, ZONE_SEQUENCE };
export type { FurnitureStage };

// ---------------------------------------------------------------- Global expansion
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
  return {
    radius: ROOM.radius + level * ROOM.radiusPerLevel,
    wallHeight: ROOM.wallHeight + level * ROOM.wallHeightPerLevel,
    domeHeight: ROOM.domeHeight,
  };
}

/** Radius of the floor-to-wall cove. Nothing in the room meets at an angle. */
export const COVE_RADIUS = ROOM.coveRadius;

// ---------------------------------------------------------------- Window & sun
export const WINDOW_TOP = WINDOW.springLine + WINDOW.halfWidth;
export const WINDOW_CENTER_Y = (WINDOW.sill + WINDOW_TOP) / 2;

function normalize3([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** Direction sunlight travels into the room, and where the sun is drawn (config/room). */
export const SUN_LIGHT_DIR = normalize3(SUN.light);
export const SUN_VISUAL_DIR = normalize3(SUN.visual);

/** World-space z of the window plane. */
export const windowPlaneZ = (dims: RoomDims) => -dims.radius;

// ---------------------------------------------------------------- Zones
export interface ZoneTransform {
  position: [number, number, number];
  rotationY: number;
  /** World-space direction the furniture faces (toward the center of the room). */
  normal: [number, number, number];
}

/** Outer width of every collection's furniture along the wall (m), from the live collection. */
export type ZoneWidths = Partial<Record<CategoryId, number>>;

export function getZoneWidths(order: Record<CategoryId, string[]>, items: Record<string, PalaceItem>): ZoneWidths {
  return Object.fromEntries(
    (Object.keys(ZONES) as CategoryId[]).map((c) => [c, getCollectionLayout(c, order[c] ?? [], items).outerWidth]),
  ) as ZoneWidths;
}

/** Radius of the circle along which furniture is laid out (the edge of the flat floor). */
const zoneRadius = (dims: RoomDims) => dims.radius - COVE_RADIUS - 0.2;

const widthOf = (id: AnchorId | CategoryId, widths: ZoneWidths) =>
  id in ANCHORS ? ANCHORS[id as AnchorId].width : (widths[id as CategoryId] ?? 0.6);

/**
 * Angle (degrees) where a collection stands: fixed, or chained beside its neighbour so
 * the two never overlap and never drift apart as either one grows.
 */
export function getZoneAngle(category: CategoryId, dims: RoomDims, widths: ZoneWidths, depth = 0): number {
  const place = ZONES[category];
  if ('angle' in place) return place.angle;
  const neighbour = place.beside;
  const base = neighbour in ANCHORS ? ANCHORS[neighbour as AnchorId].angle : depth > 6 ? 0 : getZoneAngle(neighbour as CategoryId, dims, widths, depth + 1);
  const arc = widthOf(neighbour, widths) / 2 + ZONE_GAP + widthOf(category, widths) / 2;
  return base + place.side * ((arc / zoneRadius(dims)) * 180) / Math.PI;
}

/**
 * Furniture stands on the flat floor, just in front of the cove where the floor curves
 * up into the wall. Its back corners stay on that circle, so wider pieces step slightly
 * toward the center.
 */
export function zoneTransformAt(angle: number, dims: RoomDims, outerWidth = 0): ZoneTransform {
  const theta = (angle * Math.PI) / 180;
  const r = dims.radius - COVE_RADIUS - 0.02;
  const d = Math.sqrt(Math.max(1, r * r - (outerWidth / 2) ** 2)) - 0.03;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  return { position: [d * sin, 0, -d * cos], rotationY: -theta, normal: [-sin, 0, cos] };
}

export function getZoneTransform(category: CategoryId, dims: RoomDims, widths: ZoneWidths): ZoneTransform {
  return zoneTransformAt(getZoneAngle(category, dims, widths), dims, widths[category] ?? 0);
}

/** Rotate a zone-local point into world space. */
export function zoneToWorld(zone: ZoneTransform, local: [number, number, number]): [number, number, number] {
  const c = Math.cos(zone.rotationY);
  const s = Math.sin(zone.rotationY);
  const [lx, ly, lz] = local;
  return [zone.position[0] + lx * c + lz * s, zone.position[1] + ly, zone.position[2] - lx * s + lz * c];
}

// ---------------------------------------------------------------- Furniture
/**
 * Each collection owns one piece of furniture that changes shape as it fills
 * (stages and proportions in config/furniture).
 * Everything below is pure math on the collection, so the furniture, the camera, the
 * hero and the inspector all agree on slot positions without sharing scene-graph state.
 */
export const PLANK_THICKNESS = CARCASS.plank;
export const SIDE_THICKNESS = CARCASS.side;
const SIDE_PADDING = CARCASS.sidePadding;
export const BAY_GAP = CARCASS.bayGap;
export const CROWN_HEIGHT = CARCASS.crownHeight;
export const TOWER_WIDTH = CARCASS.towerWidth;

export function getFurnitureStage(count: number): FurnitureStage {
  let stage = 0;
  STAGE_THRESHOLDS.forEach((threshold, i) => {
    if (count >= threshold) stage = i;
  });
  return stage as FurnitureStage;
}

export interface FurnitureLayout {
  stage: FurnitureStage;
  tiers: number;
  slotsPerTier: number;
  /** Bays per tier and the usable width of one bay. */
  bays: number;
  runWidth: number;
  /** Top surface of the first plank. */
  baseY: number;
  tierHeight: number;
  /** Inner width between the side panels. */
  length: number;
  /** Top surface of the carcass (excluding crown and towers). */
  height: number;
  /** Highest point of the whole piece. */
  top: number;
  /** Full footprint along the wall, towers included. */
  outerWidth: number;
  depth: number;
  /** Packed slot centres (x) and tiers, when real item thicknesses are known. */
  xs?: number[];
  tierOf?: number[];
}

/** Natural gap between two neighbouring objects. */
const gapOf = (category: CategoryId) => {
  const spec = CATEGORY_SPECS[category];
  return Math.max(0.005, spec.pitch - spec.size[0]);
};

/** Shelf footprint (thickness + gap) of each item, in slot order. */
export function itemWidths(category: CategoryId, ids: string[], items: Record<string, PalaceItem>) {
  const spec = CATEGORY_SPECS[category];
  const gap = gapOf(category);
  return ids.map((id) => (items[id] ? spec.size[0] * getItemScale(items[id])[0] + gap : spec.pitch));
}

/**
 * Stage and tier count follow the item count. With `widths`, objects are packed by their
 * real thickness, bay by bay, tier by tier (a fat hardcover takes more room than a paperback).
 */
export function getFurnitureLayout(category: CategoryId, count: number, widths?: number[]): FurnitureLayout {
  const spec = CATEGORY_SPECS[category];
  const stage = getFurnitureStage(count);
  const base = STAGES[stage];
  const k = spec.slotScale;
  const st = { ...base, slots: Math.round(base.slots * k), bay: Math.round(base.bay * k) };
  const need = Math.max(1, count);

  let tiers = Math.min(st.maxTiers, Math.max(st.minTiers, Math.ceil(need / st.slots)));
  let slotsPerTier = st.slots;
  if (tiers * slotsPerTier < need) slotsPerTier = Math.ceil(need / tiers / (st.bay || 4)) * (st.bay || 4);
  const bays = st.bay ? Math.ceil(slotsPerTier / st.bay) : 1;
  const runWidth = (st.bay || slotsPerTier) * spec.pitch;

  let xs: number[] | undefined;
  let tierOf: number[] | undefined;
  const length = bays * runWidth + (bays - 1) * BAY_GAP + SIDE_PADDING * 2;
  if (widths) {
    xs = [];
    tierOf = [];
    let tier = 0;
    let bay = 0;
    let cursor = 0;
    for (const w of widths) {
      if (cursor > 0 && cursor + w > runWidth + 1e-6) {
        cursor = 0;
        bay += 1;
        if (bay >= bays) {
          bay = 0;
          tier += 1;
        }
      }
      xs.push(-length / 2 + SIDE_PADDING + bay * (runWidth + BAY_GAP) + cursor + w / 2);
      tierOf.push(tier);
      cursor += w;
    }
    tiers = Math.max(tiers, tier + 1);
    // A pedestal shows its few objects centred rather than packed to one side.
    if (stage === 0 && widths.length) {
      const used = widths.reduce((sum, w) => sum + w, 0);
      const shift = Math.max(0, (runWidth - used) / 2);
      xs = xs.map((x) => x + shift);
    }
  }

  const tierHeight = spec.size[1] * spec.maxHeightScale + PLANK_THICKNESS + CARCASS.headroom;
  const height = st.baseY + tiers * tierHeight;
  const crown = stage >= 3 ? CROWN_HEIGHT : 0;
  const towers = stage >= 4 ? TOWER_WIDTH * 2 + 0.02 : 0;
  return {
    stage,
    tiers,
    slotsPerTier,
    bays,
    runWidth,
    baseY: st.baseY,
    tierHeight,
    length,
    height,
    top: height + crown + (stage >= 4 ? 0.14 : 0),
    outerWidth: length + SIDE_THICKNESS * 2 + towers,
    depth: spec.size[2] * spec.maxDepthScale + 0.1,
    xs,
    tierOf,
  };
}

/** Local (zone-space) position of slot `index`. Items rest on their tier plank, against the back. */
export function getSlotLocalPosition(
  category: CategoryId,
  index: number,
  layout: FurnitureLayout,
  heightScale: number,
  depthScale = 1,
): [number, number, number] {
  const spec = CATEGORY_SPECS[category];
  const tier = layout.tierOf?.[index] ?? Math.floor(index / layout.slotsPerTier);
  const x = layout.xs?.[index] ?? -layout.length / 2 + SIDE_PADDING + spec.pitch * ((index % layout.slotsPerTier) + 0.5);
  const y = layout.baseY + tier * layout.tierHeight + (spec.size[1] * heightScale) / 2;
  const z = 0.04 + (spec.size[2] * depthScale) / 2;
  return [x, y, z];
}

/** Layout from the live collection (what the furniture, camera, hero and inspector all use). */
export function getCollectionLayout(category: CategoryId, ids: string[], items: Record<string, PalaceItem>) {
  return getFurnitureLayout(category, ids.length, itemWidths(category, ids, items));
}

/** Zone transform + slot for an item, as the hero and the inspector need it. */
export function getSlotWorld(
  category: CategoryId,
  id: string,
  collection: { order: Record<CategoryId, string[]>; items: Record<string, PalaceItem> },
  dims: RoomDims,
) {
  const { order, items } = collection;
  const ids = order[category];
  const layout = getCollectionLayout(category, ids, items);
  const zone = getZoneTransform(category, dims, getZoneWidths(order, items));
  const index = Math.max(0, ids.indexOf(id));
  const item = items[id];
  const [, sy, sz] = item ? getItemScale(item) : [1, 1, 1];
  return { zone, layout, position: zoneToWorld(zone, getSlotLocalPosition(category, index, layout, sy, sz)) };
}

// ---------------------------------------------------------------- Furniture pieces
export type PieceMaterial = 'lacquer' | 'lining' | 'oak' | 'brass' | 'glow' | 'jelly';
/** box: rounded block · plinth: very soft block · leg: capsule · arch: panel with a round top · archRing: arched frame. */
export type PieceShape = 'box' | 'plinth' | 'leg' | 'arch' | 'archRing';

export interface FurniturePiece {
  /** Stable across stages, so a piece morphs instead of popping when the furniture evolves. */
  id: string;
  shape: PieceShape;
  mat: PieceMaterial;
  center: [number, number, number];
  size: [number, number, number];
}

/** Every part of the furniture for a layout, in zone space (back at z = 0, front at z = depth). */
export function getFurniturePieces(layout: FurnitureLayout): FurniturePiece[] {
  const { stage, tiers, baseY, tierHeight, length: L, depth: D, height: H } = layout;
  const T = PLANK_THICKNESS;
  const S = SIDE_THICKNESS;
  const W = L + S * 2;
  const out: FurniturePiece[] = [];
  const add = (id: string, shape: PieceShape, mat: PieceMaterial, center: [number, number, number], size: [number, number, number]) =>
    out.push({ id, shape, mat, center, size });

  // Planks: tier i's items stand on plank i; the top plank closes the carcass.
  const plankY = (i: number) => baseY + i * tierHeight - T / 2;
  const lastPlank = stage === 0 ? 0 : tiers;
  for (let i = 0; i <= lastPlank; i++) add(`plank-${i}`, 'box', 'oak', [0, plankY(i), D / 2], [i === lastPlank && stage > 0 ? W + 0.02 : W, T, D + 0.01]);

  // Warm light lines under every upper plank.
  for (let i = 1; i <= lastPlank; i++) add(`glow-${i}`, 'leg', 'glow', [0, plankY(i) - T / 2 - 0.006, D - 0.03], [L * 0.9, 0.007, 0.007]);

  if (stage === 0) {
    // Pedestal: a soft plinth and an arched backdrop behind the objects.
    const h = baseY - T;
    add('base', 'plinth', 'jelly', [0, h / 2, D / 2], [W - 0.03, h, D - 0.02]);
    add('back', 'arch', 'lining', [0, baseY + tierHeight * 0.55, 0.015], [W * 0.9, tierHeight * 1.1, 0.02]);
    return out;
  }

  // Back panel of the carcass.
  add('back', 'box', 'lining', [0, (baseY + H) / 2 - T / 2, 0.012], [L, H - baseY + T, 0.018]);

  if (stage === 1) {
    // Console: carcass floating on four slim brass legs.
    const legH = baseY - T;
    for (const [sx, sz] of [[-1, 0], [1, 0], [-1, 1], [1, 1]] as const) {
      add(`leg-${sx}-${sz}`, 'leg', 'brass', [sx * (W / 2 - 0.06), legH / 2, sz ? D - 0.06 : 0.06], [0.028, legH, 0.028]);
    }
    const sideH = H - baseY + T;
    add('side-L', 'box', 'lacquer', [-L / 2 - S / 2, baseY - T + sideH / 2, D / 2], [S, sideH, D]);
    add('side-R', 'box', 'lacquer', [L / 2 + S / 2, baseY - T + sideH / 2, D / 2], [S, sideH, D]);
    return out;
  }

  // Stage 2+: full-height carcass on a recessed plinth.
  add('side-L', 'box', 'lacquer', [-L / 2 - S / 2, H / 2, D / 2], [S, H, D]);
  add('side-R', 'box', 'lacquer', [L / 2 + S / 2, H / 2, D / 2], [S, H, D]);
  add('base', 'box', 'lacquer', [0, (baseY - T) / 2, D / 2 - 0.02], [L, baseY - T, D - 0.04]);

  for (let b = 1; b < layout.bays; b++) {
    const x = -L / 2 + SIDE_PADDING + b * (layout.runWidth + BAY_GAP) - BAY_GAP / 2;
    add(`div-${b}`, 'box', 'lacquer', [x, (baseY + H) / 2, D / 2], [0.022, H - baseY, D - 0.02]);
  }

  if (stage >= 3) {
    // Cabinet: an arch rises from the top plank, lined like the back, framed in lacquer.
    add('crown-back', 'arch', 'lining', [0, H + CROWN_HEIGHT / 2, 0.012], [W - 0.06, CROWN_HEIGHT, 0.018]);
    add('crown', 'archRing', 'lacquer', [0, H + CROWN_HEIGHT / 2, D / 2], [W + 0.02, CROWN_HEIGHT, D * 0.6]);
  }

  if (stage >= 4) {
    // Wall unit: arched towers on both sides with a vertical light line each.
    const towerH = H + CROWN_HEIGHT * 0.6;
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + TOWER_WIDTH / 2 + 0.01);
      add(`tower-${sx}`, 'arch', 'jelly', [x, towerH / 2, D / 2], [TOWER_WIDTH, towerH, D + 0.02]);
      add(`tower-glow-${sx}`, 'leg', 'glow', [x, towerH * 0.45, D + 0.016], [0.007, towerH * 0.62, 0.007]);
      add(`tower-cap-${sx}`, 'leg', 'brass', [x, towerH + 0.08, D / 2], [0.05, 0.05, 0.05]);
    }
  }
  return out;
}
