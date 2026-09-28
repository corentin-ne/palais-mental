/**
 * Geometry cache shared by the Hero Object and the shelf InstancedMesh.
 * Using the exact same BufferGeometry on both sides is what makes the Hero Swap invisible.
 */
import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { CategoryId } from './types';
import { CATEGORY_SPECS } from './itemVisuals';

const itemCache = new Map<CategoryId, BoxGeometry>();

export function getItemGeometry(category: CategoryId): BoxGeometry {
  let geo = itemCache.get(category);
  if (!geo) {
    const [x, y, z] = CATEGORY_SPECS[category].size;
    geo = new BoxGeometry(x, y, z);
    itemCache.set(category, geo);
  }
  return geo;
}

export const DISC = { outer: 0.058, inner: 0.009, thickness: 0.0024 } as const;

const sliceCache = new Map<string, BufferGeometry>();

/**
 * Annular sector for episode `index` of `count` — a pie slice of the season disc,
 * lying in the XY plane and extruded along +Z.
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
    geo = new ExtrudeGeometry(shape, {
      depth: DISC.thickness,
      bevelEnabled: false,
      curveSegments: Math.max(4, Math.ceil(48 / count)),
    });
    geo.translate(0, 0, -DISC.thickness / 2);
    sliceCache.set(key, geo);
  }
  return geo;
}
