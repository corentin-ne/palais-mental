/**
 * Procedural bodies for the animals that come by. Each faces +x, belly toward -y,
 * centred on its middle, 1 unit long (scale at use).
 */
import { BufferGeometry, ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function spindle(profile: (t: number) => number, segments = 18, radial = 14): BufferGeometry {
  const pts: Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push(new Vector2(Math.max(profile(t), 0.0005), t));
  }
  const g = new LatheGeometry(pts, radial);
  // Lathe axis is +y (t = 0 at the bottom). Lay it along x with the head (t = 0) at +x.
  g.rotateZ(Math.PI / 2);
  g.translate(0.5, 0, 0);
  return g.toNonIndexed();
}

function fin(shape: Shape, depth: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

function clean(g: BufferGeometry) {
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

/** Bottlenose-ish: short beak, melon, tapering tail stock, dorsal fin and flukes. */
export function dolphinGeometry(): BufferGeometry {
  const body = spindle((t) => {
    const beak = 0.022 + 0.05 * Math.min(t / 0.1, 1);
    const main = 0.1 * Math.pow(Math.sin(Math.PI * Math.min(Math.pow(t, 0.8), 1)), 0.75);
    return t < 0.1 ? beak : Math.max(main, 0.012);
  }, 24, 16);

  const dorsal = new Shape();
  dorsal.moveTo(0.12, 0);
  dorsal.quadraticCurveTo(0.02, 0.05, -0.08, 0.13);
  dorsal.quadraticCurveTo(-0.07, 0.05, -0.12, 0);
  const d = fin(dorsal, 0.012);
  d.translate(0, 0.085, 0);

  const fluke = new Shape();
  fluke.moveTo(0, 0);
  fluke.quadraticCurveTo(-0.06, 0.1, -0.12, 0.13);
  fluke.quadraticCurveTo(-0.08, 0.05, -0.1, 0);
  fluke.quadraticCurveTo(-0.08, -0.05, -0.12, -0.13);
  fluke.quadraticCurveTo(-0.06, -0.1, 0, 0);
  const f = fin(fluke, 0.01);
  f.rotateX(Math.PI / 2);
  f.translate(-0.47, 0, 0);

  const pec = new Shape();
  pec.moveTo(0, 0);
  pec.quadraticCurveTo(-0.04, 0.02, -0.1, 0.06);
  pec.quadraticCurveTo(-0.05, 0, 0, 0);
  const pl = fin(pec, 0.008);
  pl.rotateX(Math.PI / 2 + 0.5);
  pl.translate(0.22, -0.05, 0.06);
  const pr = fin(pec, 0.008);
  pr.rotateX(-Math.PI / 2 - 0.5);
  pr.translate(0.22, -0.05, -0.06);

  return mergeGeometries([clean(body), clean(d), clean(f), clean(pl), clean(pr)])!;
}

/** A small silver fish with a forked tail. */
export function fishGeometry(): BufferGeometry {
  const body = spindle((t) => 0.11 * Math.pow(Math.sin(Math.PI * Math.min(Math.pow(t, 0.7), 1)), 0.9), 12, 10);
  body.scale(1, 1, 0.55);
  const tail = new Shape();
  tail.moveTo(0, 0);
  tail.lineTo(-0.16, 0.1);
  tail.lineTo(-0.1, 0);
  tail.lineTo(-0.16, -0.1);
  tail.lineTo(0, 0);
  const t = fin(tail, 0.01);
  t.translate(-0.45, 0, 0);
  return mergeGeometries([clean(body), clean(t)])!;
}

/** Gull body; the wings are separate so they can flap. */
export function gullBodyGeometry(): BufferGeometry {
  const g = new SphereGeometry(0.5, 10, 8);
  g.scale(1, 0.3, 0.3);
  return clean(g.index ? g.toNonIndexed() : g);
}

/** One wing (right side, +z), hinged at the body: a bent, tapering blade. */
export function gullWingGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0.12, 0);
  s.quadraticCurveTo(0.1, 0.5, -0.05, 1.05);
  s.quadraticCurveTo(-0.08, 0.55, -0.16, 0);
  const g = fin(s, 0.015);
  g.rotateX(Math.PI / 2);
  return g;
}
