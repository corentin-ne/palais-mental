/**
 * Geometry cache shared by the Hero Object and the shelf InstancedMesh.
 * Using the exact same BufferGeometry on both sides is what makes the Hero Swap invisible.
 * Everything is softly rounded: no hard box edges anywhere in the palace.
 */
import { BufferGeometry, ExtrudeGeometry, Path, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CategoryId } from './types';
import { CATEGORY_SPECS } from './itemVisuals';
import { WINDOW } from './palaceLayout';

/** Pillowy box: the corner radius is a fixed share of the thinnest side. */
export function softBox(x: number, y: number, z: number, roundness = 0.42, segments = 3): RoundedBoxGeometry {
  return new RoundedBoxGeometry(x, y, z, segments, Math.min(x, y, z) * roundness);
}

const itemCache = new Map<CategoryId, BufferGeometry>();

export function getItemGeometry(category: CategoryId): BufferGeometry {
  let geo = itemCache.get(category);
  if (!geo) {
    const [x, y, z] = CATEGORY_SPECS[category].size;
    geo = softBox(x, y, z, 0.45, 2); // 2 segments: instanced by the hundred
    itemCache.set(category, geo);
  }
  return geo;
}

let seriesHalf: BufferGeometry | null = null;
/** One half (tray or lid) of the TV Series media box; both halves equal the shelf box. */
export function getSeriesHalfGeometry(): BufferGeometry {
  if (!seriesHalf) {
    const [x, y, z] = CATEGORY_SPECS.series.size;
    seriesHalf = softBox(x / 2, y, z, 0.45, 2);
  }
  return seriesHalf;
}

export const DISC = { outer: 0.058, inner: 0.009, thickness: 0.0024 } as const;

const sliceCache = new Map<string, BufferGeometry>();

/**
 * Annular sector for episode `index` of `count` — a pie slice of the season disc,
 * lying in the XY plane and extruded along +Z with a soft bevel.
 */
export function getDiscSliceGeometry(index: number, count: number): BufferGeometry {
  const key = `${index}/${count}`;
  let geo = sliceCache.get(key);
  if (!geo) {
    const length = (Math.PI * 2) / count;
    const start = index * length;
    // Hairline gap so individual episodes stay legible on the finished disc.
    const gap = count > 1 ? Math.min(0.02, length * 0.08) : 0;
    const a0 = start + gap / 2;
    const a1 = start + length - gap / 2;
    const shape = new Shape();
    shape.moveTo(Math.cos(a0) * DISC.inner, Math.sin(a0) * DISC.inner);
    shape.absarc(0, 0, DISC.outer, a0, a1, false);
    shape.absarc(0, 0, DISC.inner, a1, a0, true);
    const bevel = DISC.thickness * 0.3;
    geo = new ExtrudeGeometry(shape, {
      depth: DISC.thickness - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: Math.max(4, Math.ceil(48 / count)),
    });
    geo.translate(0, 0, -DISC.thickness / 2 + bevel);
    sliceCache.set(key, geo);
  }
  return geo;
}

// ---------------------------------------------------------------- Window outline
/**
 * Arched window outline in window-plane coords, grown by `offset` (negative = inset).
 * Counter-clockwise: rounded bottom corners, straight jambs, semicircular arch.
 */
export function windowOutline<T extends Path>(target: T, offset = 0): T {
  const hw = WINDOW.halfWidth + offset;
  const y0 = WINDOW.sill - offset;
  const ya = WINDOW.springLine;
  const r = Math.max(0.001, WINDOW.cornerRadius + offset);
  target.moveTo(-hw + r, y0);
  target.lineTo(hw - r, y0);
  target.absarc(hw - r, y0 + r, r, -Math.PI / 2, 0, false);
  target.lineTo(hw, ya);
  target.absarc(0, ya, hw, 0, Math.PI, false);
  target.lineTo(-hw, y0 + r);
  target.absarc(-hw + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}
