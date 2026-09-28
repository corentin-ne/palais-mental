/**
 * Procedural decor for the niches: small, recognisable objects that a niche earns as
 * it fills (see lib/milestones). Each object is a handful of primitives, merged per
 * material so one object costs 2–4 draw calls. Units are metres; origin is the centre
 * of the object's footprint, resting on y = 0, front facing +z.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { softBox } from './itemGeometry';

export interface DecorMaterial {
  color: string;
  metal?: boolean;
  glow?: boolean;
  rough?: number;
}

export interface DecorModel {
  parts: { geometry: BufferGeometry; material: DecorMaterial }[];
  /** Footprint width, for spacing. */
  width: number;
}

type V3 = [number, number, number];
interface Part {
  geo: BufferGeometry;
  mat: DecorMaterial;
}

// ------------------------------------------------------------------ Materials
const M = {
  walnut: { color: '#6E4B32', rough: 0.6 },
  oak: { color: '#C9A77C', rough: 0.6 },
  ink: { color: '#232327', rough: 0.45 },
  charcoal: { color: '#3A3D44', rough: 0.5 },
  ivory: { color: '#F2EEE6', rough: 0.55 },
  cream: { color: '#EDE3CF', rough: 0.7 },
  brass: { color: '#C29B5A', metal: true, rough: 0.32 },
  gold: { color: '#D7B04A', metal: true, rough: 0.25 },
  silver: { color: '#B8BBC2', metal: true, rough: 0.3 },
  terracotta: { color: '#C8745A', rough: 0.75 },
  leaf: { color: '#5F8F63', rough: 0.6 },
  leafLight: { color: '#86B27F', rough: 0.6 },
  red: { color: '#C83E36', rough: 0.5 },
  blue: { color: '#2F5D8C', rough: 0.5 },
  yellow: { color: '#E6B23A', rough: 0.5 },
  green: { color: '#3E8E6B', rough: 0.5 },
  glass: { color: '#DCE9EE', rough: 0.1 },
  sand: { color: '#E0B66A', rough: 0.9 },
  screen: { color: '#9CC5D6', glow: true },
  bulb: { color: '#FFD98F', glow: true },
  flame: { color: '#FFB24A', glow: true },
} satisfies Record<string, DecorMaterial>;

// ------------------------------------------------------------------ Primitive helpers
function place(geo: BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale?: V3) {
  if (scale) geo.scale(...scale);
  if (rot[0]) geo.rotateX(rot[0]);
  if (rot[1]) geo.rotateY(rot[1]);
  if (rot[2]) geo.rotateZ(rot[2]);
  geo.translate(...pos);
  return geo;
}
const box = (w: number, h: number, d: number, mat: DecorMaterial, pos: V3, rot?: V3, round = 0.18): Part => ({
  geo: place(softBox(w, h, d, round, 2), pos, rot),
  mat,
});
const cyl = (rTop: number, rBottom: number, h: number, mat: DecorMaterial, pos: V3, rot?: V3, seg = 28): Part => ({
  geo: place(new CylinderGeometry(rTop, rBottom, h, seg), pos, rot),
  mat,
});
const ball = (r: number, mat: DecorMaterial, pos: V3, scale?: V3): Part => ({
  geo: place(new SphereGeometry(r, 16, 12), pos, undefined, scale),
  mat,
});
const torus = (r: number, tube: number, mat: DecorMaterial, pos: V3, rot?: V3, arc = Math.PI * 2): Part => ({
  geo: place(new TorusGeometry(r, tube, 10, 32, arc), pos, rot),
  mat,
});
const lathe = (profile: [number, number][], mat: DecorMaterial, pos: V3 = [0, 0, 0]): Part => ({
  geo: place(new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), 32), pos),
  mat,
});
const extrude = (shape: Shape, depth: number, mat: DecorMaterial, pos: V3, rot?: V3): Part => {
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  return { geo: place(geo, pos, rot), mat };
};

// ------------------------------------------------------------------ Objects
function plant(): Part[] {
  const parts: Part[] = [
    lathe([[0.001, 0], [0.045, 0], [0.058, 0.07], [0.062, 0.085], [0.052, 0.085], [0.001, 0.08]], M.terracotta),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tilt = 0.5 + (i % 2) * 0.25;
    const leaf = new SphereGeometry(1, 16, 12);
    leaf.scale(0.022, 0.008 + tilt * 0.01, 0.055);
    leaf.rotateX(-0.35);
    parts.push({ geo: place(leaf, [Math.sin(a) * 0.045, 0.14 + (i % 3) * 0.02, Math.cos(a) * 0.045], [0, a, 0]), mat: i % 2 ? M.leaf : M.leafLight });
  }
  parts.push(cyl(0.004, 0.005, 0.07, M.leaf, [0, 0.1, 0]));
  return parts;
}

function clapper(): Part[] {
  const p: Part[] = [box(0.15, 0.1, 0.014, M.ink, [0, 0.05, 0], [-0.08, 0, 0], 0.1)];
  const stick = (y: number, rotZ: number) => {
    p.push(box(0.152, 0.024, 0.014, M.ink, [0, y, 0], [-0.08, 0, rotZ], 0.1));
    for (let i = 0; i < 4; i++) p.push(box(0.02, 0.026, 0.016, M.ivory, [-0.055 + i * 0.038, y, 0], [-0.08, 0, rotZ - 0.5], 0.05));
  };
  stick(0.115, 0);
  stick(0.145, 0.22);
  p.push(box(0.11, 0.004, 0.015, M.ivory, [0, 0.05, 0.001], [-0.08, 0, 0], 0.1));
  return p;
}

function popcorn(): Part[] {
  const p: Part[] = [];
  const tub = new CylinderGeometry(0.05, 0.036, 0.11, 4, 1);
  tub.rotateY(Math.PI / 4);
  p.push({ geo: place(tub, [0, 0.055, 0]), mat: M.red });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.push(box(0.012, 0.11, 0.004, M.ivory, [Math.sin(a) * 0.037, 0.055, Math.cos(a) * 0.037], [0, a, 0], 0.1));
  }
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4;
    const r = 0.012 + (i % 5) * 0.007;
    p.push(ball(0.013, M.cream, [Math.sin(a) * r, 0.118 + (i % 3) * 0.008, Math.cos(a) * r]));
  }
  return p;
}

function reel(): Part[] {
  const p: Part[] = [cyl(0.075, 0.075, 0.006, M.silver, [0, 0.078, -0.012], [Math.PI / 2, 0, 0], 40)];
  p.push(cyl(0.075, 0.075, 0.006, M.silver, [0, 0.078, 0.012], [Math.PI / 2, 0, 0], 40));
  p.push(cyl(0.03, 0.03, 0.022, M.ink, [0, 0.078, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.push(cyl(0.013, 0.013, 0.008, M.ink, [Math.cos(a) * 0.048, 0.078 + Math.sin(a) * 0.048, 0.013], [Math.PI / 2, 0, 0], 16));
  }
  p.push(box(0.12, 0.003, 0.02, M.ink, [0.05, 0.002, 0.03], [0, -0.4, 0], 0.1));
  return p;
}

function projector(): Part[] {
  return [
    box(0.17, 0.09, 0.12, M.charcoal, [0, 0.055, 0], undefined, 0.2),
    cyl(0.026, 0.032, 0.05, M.ink, [0.04, 0.055, 0.08], [Math.PI / 2, 0, 0]),
    cyl(0.02, 0.02, 0.003, M.glass, [0.04, 0.055, 0.106], [Math.PI / 2, 0, 0]),
    cyl(0.05, 0.05, 0.008, M.silver, [-0.04, 0.15, 0], [0, 0, Math.PI / 2], 36),
    cyl(0.04, 0.04, 0.008, M.silver, [0.05, 0.14, 0], [0, 0, Math.PI / 2], 36),
    cyl(0.006, 0.006, 0.03, M.ink, [-0.04, 0.1, 0]),
    cyl(0.006, 0.006, 0.03, M.ink, [0.05, 0.1, 0]),
    box(0.03, 0.012, 0.03, M.ink, [-0.06, 0.004, 0.04], undefined, 0.2),
    box(0.03, 0.012, 0.03, M.ink, [0.06, 0.004, 0.04], undefined, 0.2),
  ];
}

function remote(): Part[] {
  const p: Part[] = [box(0.045, 0.014, 0.17, M.ink, [0, 0.008, 0], [0, 0.35, 0], 0.3)];
  const colors = [M.red, M.ivory, M.ivory, M.ivory, M.blue];
  colors.forEach((c, i) => p.push(cyl(0.006, 0.006, 0.006, c, [Math.sin(0.35) * (0.05 - i * 0.022), 0.016, Math.cos(0.35) * (0.05 - i * 0.022)], undefined, 12)));
  return p;
}

function tv(): Part[] {
  return [
    box(0.2, 0.15, 0.13, M.ivory, [0, 0.1, 0], undefined, 0.35),
    box(0.15, 0.105, 0.01, M.screen, [-0.012, 0.102, 0.063], undefined, 0.3),
    cyl(0.008, 0.008, 0.012, M.brass, [0.08, 0.13, 0.066], [Math.PI / 2, 0, 0], 12),
    cyl(0.008, 0.008, 0.012, M.brass, [0.08, 0.09, 0.066], [Math.PI / 2, 0, 0], 12),
    cyl(0.0025, 0.0025, 0.12, M.silver, [-0.03, 0.22, 0], [0, 0, 0.5], 8),
    cyl(0.0025, 0.0025, 0.12, M.silver, [0.03, 0.22, 0], [0, 0, -0.5], 8),
    cyl(0.006, 0.004, 0.025, M.walnut, [-0.07, 0.012, 0.04]),
    cyl(0.006, 0.004, 0.025, M.walnut, [0.07, 0.012, 0.04]),
    cyl(0.006, 0.004, 0.025, M.walnut, [-0.07, 0.012, -0.04]),
    cyl(0.006, 0.004, 0.025, M.walnut, [0.07, 0.012, -0.04]),
  ];
}

function mug(): Part[] {
  return [
    lathe([[0.001, 0], [0.036, 0], [0.039, 0.004], [0.04, 0.09], [0.035, 0.09], [0.034, 0.012], [0.001, 0.012]], M.ivory),
    torus(0.024, 0.006, M.ivory, [0.042, 0.048, 0], [0, 0, -Math.PI / 2], Math.PI),
    cyl(0.033, 0.033, 0.002, M.walnut, [0, 0.075, 0]),
  ];
}

function headphones(): Part[] {
  return [
    torus(0.075, 0.007, M.ink, [0, 0.085, 0], [0, 0, 0], Math.PI),
    cyl(0.036, 0.036, 0.03, M.ink, [-0.075, 0.07, 0], [0, 0, Math.PI / 2]),
    cyl(0.036, 0.036, 0.03, M.ink, [0.075, 0.07, 0], [0, 0, Math.PI / 2]),
    cyl(0.03, 0.03, 0.012, M.walnut, [-0.058, 0.07, 0], [0, 0, Math.PI / 2]),
    cyl(0.03, 0.03, 0.012, M.walnut, [0.058, 0.07, 0], [0, 0, Math.PI / 2]),
    box(0.03, 0.035, 0.06, M.walnut, [0, 0.0175, 0], undefined, 0.2),
  ];
}

function speaker(): Part[] {
  return [
    box(0.12, 0.19, 0.11, M.walnut, [0, 0.095, 0], undefined, 0.12),
    box(0.1, 0.17, 0.004, M.charcoal, [0, 0.095, 0.056], undefined, 0.2),
    cyl(0.038, 0.038, 0.01, M.ink, [0, 0.07, 0.06], [Math.PI / 2, 0, 0], 32),
    cyl(0.014, 0.014, 0.012, M.silver, [0, 0.07, 0.062], [Math.PI / 2, 0, 0], 20),
    cyl(0.016, 0.016, 0.01, M.ink, [0, 0.145, 0.06], [Math.PI / 2, 0, 0], 24),
  ];
}

function turntable(): Part[] {
  return [
    box(0.32, 0.055, 0.25, M.walnut, [0, 0.0275, 0], undefined, 0.12),
    cyl(0.112, 0.112, 0.012, M.silver, [-0.035, 0.061, 0], undefined, 48),
    cyl(0.105, 0.105, 0.004, M.ink, [-0.035, 0.069, 0], undefined, 48),
    cyl(0.035, 0.035, 0.0045, M.red, [-0.035, 0.0695, 0], undefined, 32),
    cyl(0.018, 0.018, 0.02, M.silver, [0.12, 0.065, -0.08]),
    cyl(0.0035, 0.0035, 0.2, M.silver, [0.07, 0.078, -0.02], [Math.PI / 2, 0.55, 0], 8),
    box(0.012, 0.01, 0.025, M.ink, [0.025, 0.076, 0.058], [0, 0.55, 0], 0.2),
    cyl(0.012, 0.012, 0.01, M.silver, [0.13, 0.058, 0.09], undefined, 16),
  ];
}

function cassette(): Part[] {
  return [
    box(0.1, 0.064, 0.013, M.ivory, [0, 0.034, 0], [-0.12, 0, 0], 0.12),
    box(0.08, 0.026, 0.002, M.yellow, [0, 0.046, 0.007], [-0.12, 0, 0], 0.1),
    box(0.05, 0.016, 0.002, M.ink, [0, 0.026, 0.008], [-0.12, 0, 0], 0.1),
    cyl(0.007, 0.007, 0.004, M.ivory, [-0.017, 0.026, 0.009], [Math.PI / 2 - 0.12, 0, 0], 12),
    cyl(0.007, 0.007, 0.004, M.ivory, [0.017, 0.026, 0.009], [Math.PI / 2 - 0.12, 0, 0], 12),
  ];
}

function bookends(): Part[] {
  const p: Part[] = [];
  for (const s of [-1, 1]) {
    p.push(box(0.016, 0.14, 0.1, M.brass, [s * 0.1, 0.07, 0], undefined, 0.2));
    p.push(box(0.06, 0.01, 0.1, M.brass, [s * 0.075, 0.005, 0], undefined, 0.2));
  }
  const books: [number, DecorMaterial, number, number][] = [
    [-0.066, M.blue, 0.026, 0.12],
    [-0.036, M.red, 0.03, 0.13],
    [-0.006, M.cream, 0.026, 0.11],
    [0.024, M.green, 0.03, 0.125],
    [0.06, M.yellow, 0.022, 0.1],
  ];
  books.forEach(([x, m, w, h], i) => p.push(box(w, h, 0.085, m, [x, h / 2 + 0.01, 0], [0, 0, i === 4 ? -0.18 : 0], 0.12)));
  return p;
}

function lamp(): Part[] {
  return [
    cyl(0.055, 0.06, 0.014, M.brass, [0, 0.007, 0], undefined, 36),
    cyl(0.005, 0.005, 0.24, M.brass, [0, 0.13, 0], undefined, 10),
    cyl(0.005, 0.005, 0.1, M.brass, [0.035, 0.26, 0], [0, 0, -1.1], 10),
    cyl(0.035, 0.07, 0.085, M.cream, [0.085, 0.27, 0], [0, 0, -0.3], 36),
    ball(0.018, M.bulb, [0.085, 0.245, 0]),
  ];
}

function glasses(): Part[] {
  return [
    torus(0.022, 0.003, M.ink, [-0.026, 0.004, 0], [Math.PI / 2, 0, 0]),
    torus(0.022, 0.003, M.ink, [0.026, 0.004, 0], [Math.PI / 2, 0, 0]),
    { geo: place(new CylinderGeometry(0.02, 0.02, 0.002, 24), [-0.026, 0.004, 0]), mat: M.glass },
    { geo: place(new CylinderGeometry(0.02, 0.02, 0.002, 24), [0.026, 0.004, 0]), mat: M.glass },
    box(0.012, 0.003, 0.004, M.ink, [0, 0.006, 0], undefined, 0.2),
    box(0.003, 0.003, 0.07, M.ink, [-0.05, 0.004, -0.035], [0, 0.1, 0], 0.2),
    box(0.003, 0.003, 0.07, M.ink, [0.05, 0.004, -0.035], [0, -0.1, 0], 0.2),
  ];
}

function candle(): Part[] {
  return [
    lathe([[0.001, 0], [0.05, 0], [0.052, 0.008], [0.045, 0.012], [0.001, 0.01]], M.brass),
    cyl(0.024, 0.024, 0.1, M.ivory, [0, 0.06, 0], undefined, 28),
    cyl(0.0015, 0.0015, 0.012, M.ink, [0, 0.114, 0], undefined, 6),
    ball(1, M.flame, [0, 0.128, 0], [0.008, 0.02, 0.008]),
  ];
}

function dice(): Part[] {
  const p: Part[] = [];
  const die = (x: number, z: number, ry: number, faces: number) => {
    const s = 0.032;
    p.push(box(s, s, s, M.ivory, [x, s / 2, z], [0, ry, 0], 0.22));
    const pips: [number, number][] = faces === 5 ? [[0, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]] : [[-1, -1], [0, 0], [1, 1]];
    pips.forEach(([u, v]) => {
      const lx = u * 0.009;
      const lz = v * 0.009;
      p.push(ball(0.0035, M.ink, [x + lx * Math.cos(ry) + lz * Math.sin(ry), s + 0.0005, z - lx * Math.sin(ry) + lz * Math.cos(ry)]));
    });
  };
  die(-0.03, 0, 0.3, 5);
  die(0.03, 0.02, -0.5, 3);
  return p;
}

function meepleShape() {
  const s = new Shape();
  s.moveTo(-0.022, 0);
  s.lineTo(-0.008, 0.016);
  s.lineTo(-0.024, 0.024);
  s.quadraticCurveTo(-0.028, 0.032, -0.02, 0.033);
  s.lineTo(-0.008, 0.03);
  s.quadraticCurveTo(-0.012, 0.046, 0, 0.047);
  s.quadraticCurveTo(0.012, 0.046, 0.008, 0.03);
  s.lineTo(0.02, 0.033);
  s.quadraticCurveTo(0.028, 0.032, 0.024, 0.024);
  s.lineTo(0.008, 0.016);
  s.lineTo(0.022, 0);
  s.lineTo(0.004, 0);
  s.lineTo(0, 0.008);
  s.lineTo(-0.004, 0);
  s.lineTo(-0.022, 0);
  return s;
}
function meeples(): Part[] {
  const shape = meepleShape();
  return [
    extrude(shape, 0.014, M.red, [-0.045, 0, 0], [0, 0.2, 0]),
    extrude(shape, 0.014, M.blue, [0, 0, 0.02], [0, -0.1, 0]),
    extrude(shape, 0.014, M.yellow, [0.045, 0, -0.01], [0, 0.35, 0]),
  ];
}

function hourglass(): Part[] {
  return [
    cyl(0.04, 0.04, 0.01, M.walnut, [0, 0.005, 0], undefined, 24),
    cyl(0.04, 0.04, 0.01, M.walnut, [0, 0.135, 0], undefined, 24),
    cyl(0.028, 0.004, 0.058, M.glass, [0, 0.1, 0], undefined, 24),
    cyl(0.004, 0.028, 0.058, M.glass, [0, 0.04, 0], undefined, 24),
    cyl(0.001, 0.022, 0.025, M.sand, [0, 0.023, 0], undefined, 20),
    ...[0, 1, 2].map((i) => cyl(0.003, 0.003, 0.125, M.walnut, [Math.sin((i / 3) * Math.PI * 2) * 0.034, 0.07, Math.cos((i / 3) * Math.PI * 2) * 0.034], undefined, 8)),
  ];
}

function trophy(): Part[] {
  return [
    box(0.07, 0.03, 0.07, M.ink, [0, 0.015, 0], undefined, 0.15),
    lathe([[0.001, 0.03], [0.022, 0.03], [0.008, 0.045], [0.006, 0.08], [0.012, 0.09], [0.045, 0.1], [0.048, 0.16], [0.044, 0.16], [0.001, 0.105]], M.gold),
    torus(0.018, 0.004, M.gold, [-0.05, 0.13, 0], [0, 0, Math.PI / 2], Math.PI),
    torus(0.018, 0.004, M.gold, [0.05, 0.13, 0], [0, 0, -Math.PI / 2], Math.PI),
  ];
}

function controllerShape() {
  const s = new Shape();
  s.moveTo(-0.05, 0.03);
  s.quadraticCurveTo(-0.075, 0.032, -0.08, 0.005);
  s.quadraticCurveTo(-0.088, -0.035, -0.068, -0.042);
  s.quadraticCurveTo(-0.052, -0.046, -0.04, -0.018);
  s.lineTo(0.04, -0.018);
  s.quadraticCurveTo(0.052, -0.046, 0.068, -0.042);
  s.quadraticCurveTo(0.088, -0.035, 0.08, 0.005);
  s.quadraticCurveTo(0.075, 0.032, 0.05, 0.03);
  s.lineTo(-0.05, 0.03);
  return s;
}
function controller(): Part[] {
  const lie: V3 = [-Math.PI / 2 + 0.15, 0, 0];
  const p: Part[] = [extrude(controllerShape(), 0.024, M.charcoal, [0, 0.014, 0], lie)];
  const top = (x: number, z: number, r: number, m: DecorMaterial) => p.push(cyl(r, r, 0.006, m, [x, 0.03 + z * 0.15, -z], undefined, 14));
  top(0.045, 0.004, 0.005, M.red);
  top(0.055, -0.006, 0.005, M.blue);
  top(0.035, -0.006, 0.005, M.yellow);
  top(0.045, -0.014, 0.005, M.green);
  p.push(box(0.022, 0.006, 0.007, M.ink, [-0.045, 0.03, 0.004], undefined, 0.2));
  p.push(box(0.007, 0.006, 0.022, M.ink, [-0.045, 0.03, 0.004], undefined, 0.2));
  return p;
}

function cartridge(): Part[] {
  return [
    box(0.065, 0.075, 0.014, M.silver, [0, 0.0375, 0], [-0.1, 0, 0], 0.12),
    box(0.05, 0.04, 0.003, M.red, [0, 0.048, 0.007], [-0.1, 0, 0], 0.1),
    box(0.055, 0.006, 0.016, M.charcoal, [0, 0.07, -0.004], [-0.1, 0, 0], 0.1),
  ];
}

function consoleBox(): Part[] {
  return [
    box(0.24, 0.045, 0.17, M.ivory, [0, 0.0225, 0], undefined, 0.2),
    box(0.24, 0.006, 0.171, M.charcoal, [0, 0.03, 0], undefined, 0.1),
    box(0.1, 0.004, 0.004, M.ink, [-0.03, 0.02, 0.086], undefined, 0.1),
    cyl(0.004, 0.004, 0.003, M.green, [0.09, 0.02, 0.086], [Math.PI / 2, 0, 0], 10),
    box(0.02, 0.012, 0.004, M.charcoal, [0.06, 0.02, 0.086], undefined, 0.2),
  ];
}

const BUILDERS: Record<string, () => Part[]> = {
  plant,
  clapper,
  popcorn,
  reel,
  projector,
  remote,
  tv,
  mug,
  headphones,
  speaker,
  turntable,
  cassette,
  bookends,
  lamp,
  glasses,
  candle,
  dice,
  meeples,
  hourglass,
  trophy,
  controller,
  cartridge,
  console: consoleBox,
};

const cache = new Map<string, DecorModel>();

/** Cached, material-merged model for a decor id. */
export function getDecorModel(id: string): DecorModel | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const build = BUILDERS[id];
  if (!build) return null;
  const parts = build();
  const groups = new Map<DecorMaterial, BufferGeometry[]>();
  let minX = Infinity;
  let maxX = -Infinity;
  for (const { geo, mat } of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo).clone();
    g.deleteAttribute('uv');
    g.computeBoundingBox();
    minX = Math.min(minX, g.boundingBox!.min.x);
    maxX = Math.max(maxX, g.boundingBox!.max.x);
    const list = groups.get(mat) ?? [];
    list.push(g);
    groups.set(mat, list);
  }
  const model: DecorModel = {
    parts: [...groups.entries()].map(([material, geos]) => ({ geometry: mergeGeometries(geos)!, material })),
    width: maxX - minX,
  };
  cache.set(id, model);
  return model;
}
