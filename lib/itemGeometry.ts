/**
 * Geometry cache shared by the Hero Object, the inspector and the shelf InstancedMeshes.
 * Using the exact same BufferGeometry on both sides is what makes the Hero Swap invisible.
 *
 * Every object is two parts:
 *  - body   → tinted per item (instance color), the object's own colour
 *  - detail → fixed trims painted with vertex colours (labels, page blocks, a vinyl
 *             peeking out of its sleeve, lid seams)
 * so each collection costs exactly two draw calls however large it grows.
 */
import { BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CategoryId } from './types';
import { CATEGORY_SPECS } from './itemVisuals';
import { WINDOW } from './palaceLayout';

/** Pillowy box: the corner radius is a fixed share of the thinnest side. */
export function softBox(x: number, y: number, z: number, roundness = 0.42, segments = 3): RoundedBoxGeometry {
  return new RoundedBoxGeometry(x, y, z, segments, Math.min(x, y, z) * roundness);
}

const TRIM = '#FFFBF4';
const PAGES = '#F6EEDD';
const GILT = '#E2C48E';
const VINYL = '#2B2630';
const LABEL = '#F3ECDD';
const CASE = '#DAD7D2';

/** Bake a flat vertex colour so trims of different colours share one draw call. */
function paint<T extends BufferGeometry>(geo: T, hex: string): T {
  const c = new Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo;
}

const at = <T extends BufferGeometry>(geo: T, x: number, y: number, z: number) => {
  geo.translate(x, y, z);
  return geo;
};

export interface ItemParts {
  body: BufferGeometry;
  detail: BufferGeometry;
}

/** Physical feel of each collection's body (cases are glossy, sleeves and covers are paper). */
export const BODY_ROUGHNESS: Record<CategoryId, number> = {
  movies: 0.28,
  series: 0.3,
  music: 0.58,
  books: 0.62,
  boardgames: 0.5,
  videogames: 0.26,
};

function buildParts(category: CategoryId, halfSeries = false): ItemParts {
  const [t, h, d] = CATEGORY_SPECS[category].size;
  switch (category) {
    case 'movies':
      return {
        body: softBox(t, h, d, 0.14, 2),
        detail: mergeGeometries([
          paint(at(softBox(t * 1.04, 0.036, 0.006, 0.12, 2), 0, h * 0.3, d / 2), TRIM),
          paint(at(softBox(t * 1.04, 0.008, 0.006, 0.12, 2), 0, -h * 0.38, d / 2), TRIM),
          paint(at(softBox(t * 1.02, 0.004, d * 1.004, 0.12, 1), 0, h / 2 - 0.002, 0), CASE),
          paint(at(softBox(t * 1.02, 0.004, d * 1.004, 0.12, 1), 0, -h / 2 + 0.002, 0), CASE),
        ])!,
      };
    case 'series': {
      const w = halfSeries ? t / 2 : t;
      return {
        body: softBox(w, h, d, 0.14, 2),
        detail: mergeGeometries([
          paint(at(softBox(w * 1.02, 0.012, 0.006, 0.12, 2), 0, h * 0.4, d / 2), TRIM),
          paint(at(softBox(w * 1.02, 0.012, 0.006, 0.12, 2), 0, -h * 0.4, d / 2), TRIM),
          paint(at(softBox(w * 1.02, 0.05, 0.006, 0.12, 2), 0, h * 0.12, d / 2), TRIM),
        ])!,
      };
    }
    case 'music': {
      const r = 0.145;
      const y = h / 2 + CATEGORY_SPECS.music.peek - r;
      const disc = at(new CylinderGeometry(r, r, 0.0035, 72).rotateZ(Math.PI / 2), 0, y, 0);
      const label = at(new CylinderGeometry(0.048, 0.048, 0.0042, 48).rotateZ(Math.PI / 2), 0, y, 0);
      return {
        body: softBox(t, h, d, 0.14, 2),
        detail: mergeGeometries([paint(disc, VINYL), paint(label, '#F3E3C8')])!,
      };
    }
    case 'books': {
      const board = 0.0045;
      return {
        body: mergeGeometries([
          at(softBox(board, h, d, 0.14, 2), -t / 2 + board / 2, 0, 0),
          at(softBox(board, h, d, 0.14, 2), t / 2 - board / 2, 0, 0),
          at(softBox(t, h, 0.006, 0.14, 2), 0, 0, d / 2 - 0.003),
        ])!,
        detail: mergeGeometries([
          paint(at(softBox(t - board * 2, h - 0.012, d - 0.01, 0.2, 1), 0, 0, -0.004), PAGES),
          paint(at(softBox(t * 1.01, 0.007, 0.004, 0.12, 1), 0, h * 0.36, d / 2), GILT),
          paint(at(softBox(t * 1.01, 0.007, 0.004, 0.12, 1), 0, -h * 0.36, d / 2), GILT),
          paint(at(softBox(t * 0.62, h * 0.16, 0.003, 0.12, 1), 0, h * 0.14, d / 2 + 0.001), LABEL),
        ])!,
      };
    }
    case 'boardgames':
      return {
        body: softBox(t, h, d, 0.07, 2),
        detail: mergeGeometries([
          paint(at(softBox(t * 1.025, 0.014, d * 1.012, 0.12, 2), 0, h / 2 - 0.07, 0), TRIM),
          paint(at(softBox(t * 0.62, h * 0.4, 0.006, 0.12, 2), 0, -0.03, d / 2), TRIM),
        ])!,
      };
    case 'videogames':
      return {
        body: softBox(t, h, d, 0.14, 2),
        detail: mergeGeometries([paint(at(softBox(t * 1.03, 0.028, d * 1.008, 0.12, 2), 0, h / 2 - 0.016, 0), TRIM)])!,
      };
  }
}

const partsCache = new Map<string, ItemParts>();

export function getItemParts(category: CategoryId): ItemParts {
  let parts = partsCache.get(category);
  if (!parts) {
    parts = buildParts(category);
    partsCache.set(category, parts);
  }
  return parts;
}

/** One half (tray or lid) of the TV Series media box; both halves together equal the shelf box. */
export function getSeriesHalfParts(): ItemParts {
  let parts = partsCache.get('series/half');
  if (!parts) {
    parts = buildParts('series', true);
    partsCache.set('series/half', parts);
  }
  return parts;
}

// ---------------------------------------------------------------- Season discs
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

// ---------------------------------------------------------------- Outlines
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

/**
 * Soft niche outline: centered on x, from y=0 to y=h, with small bottom corners and
 * generous top corners (a flattened arch). Counter-clockwise.
 */
export function nicheOutline<T extends Path>(target: T, w: number, h: number, rBottom: number, rTop: number, y0 = 0): T {
  const hw = w / 2;
  const rb = Math.min(rBottom, hw, h / 2);
  const rt = Math.min(rTop, hw, h - rb);
  target.moveTo(-hw + rb, y0);
  target.lineTo(hw - rb, y0);
  target.absarc(hw - rb, y0 + rb, rb, -Math.PI / 2, 0, false);
  target.lineTo(hw, y0 + h - rt);
  target.absarc(hw - rt, y0 + h - rt, rt, 0, Math.PI / 2, false);
  target.lineTo(-hw + rt, y0 + h);
  target.absarc(-hw + rt, y0 + h - rt, rt, Math.PI / 2, Math.PI, false);
  target.lineTo(-hw, y0 + rb);
  target.absarc(-hw + rb, y0 + rb, rb, Math.PI, Math.PI * 1.5, false);
  return target;
}
