/**
 * Soft geometry for furniture pieces, built at the piece's exact size so rounded
 * corners and arches never stretch. Pieces morph by springing from their old size to
 * the new geometry (see CategoryFurniture).
 */
import { BufferGeometry, CapsuleGeometry, ExtrudeGeometry, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import type { PieceShape } from './palaceLayout';

const ARCH_BORDER = 0.05;

/** Rectangle of width w and height h whose top is a half-ellipse; origin at the bottom centre. */
function archOutline(shape: Shape, w: number, h: number) {
  const rx = w / 2;
  const ry = Math.min(h * 0.95, w / 2);
  const side = h - ry;
  shape.moveTo(-rx, 0);
  shape.lineTo(rx, 0);
  shape.lineTo(rx, side);
  shape.absellipse(0, side, rx, ry, 0, Math.PI, false, 0);
  shape.lineTo(-rx, 0);
  return shape;
}

/** Inverted U: an arched frame standing on its two feet. */
function archRingOutline(shape: Shape, w: number, h: number) {
  const rx = w / 2;
  const ry = Math.min(h * 0.95, w / 2);
  const side = h - ry;
  const b = ARCH_BORDER;
  shape.moveTo(-rx, 0);
  shape.lineTo(-rx + b, 0);
  shape.lineTo(-rx + b, side);
  shape.absellipse(0, side, rx - b, ry - b, Math.PI, 0, true, 0);
  shape.lineTo(rx - b, 0);
  shape.lineTo(rx, 0);
  shape.lineTo(rx, side);
  shape.absellipse(0, side, rx, ry, 0, Math.PI, false, 0);
  shape.lineTo(-rx, 0);
  return shape;
}

function extrudeCentered(shape: Shape, h: number, depth: number) {
  const bevel = Math.min(0.008, depth * 0.25);
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  });
  geo.translate(0, -h / 2, -depth / 2 + bevel);
  return geo;
}

export function buildPieceGeometry(shape: PieceShape, [x, y, z]: [number, number, number]): BufferGeometry {
  switch (shape) {
    case 'box':
      return new RoundedBoxGeometry(x, y, z, 3, Math.min(0.016, Math.min(x, y, z) * 0.45));
    case 'plinth':
      return new RoundedBoxGeometry(x, y, z, 6, Math.min(x, y, z) * 0.28);
    case 'leg': {
      // Capsule along the piece's longest axis.
      const long = Math.max(x, y, z);
      const r = Math.min(x, y, z) / 2;
      const geo = new CapsuleGeometry(r, Math.max(0.0001, long - r * 2), 4, 12);
      if (long === x) geo.rotateZ(Math.PI / 2);
      else if (long === z) geo.rotateX(Math.PI / 2);
      return geo;
    }
    case 'arch':
      return extrudeCentered(archOutline(new Shape(), x, y), y, z);
    case 'archRing':
      return extrudeCentered(archRingOutline(new Shape(), x, y), y, z);
  }
}
