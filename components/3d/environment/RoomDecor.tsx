import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { RoomDimsRef } from '../MentalPalace';
import { buildPlant } from './RoomShell';
import { COVE_RADIUS } from '@/lib/palaceLayout';
import { softBox } from '@/lib/itemGeometry';
import { artFragment, artVertex } from '@/shaders/art';

// ------------------------------------------------------------------ Geometry helpers
const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Vector3();

/** Place a geometry: translate, optional rotation (Euler XYZ) and uniform-ish scale. */
function put<T extends BufferGeometry>(geo: T, [x, y, z]: number[], rot: number[] = [0, 0, 0], scale: number[] = [1, 1, 1]): T {
  _q.setFromEuler(new Euler(rot[0], rot[1], rot[2]));
  _m.compose(new Vector3(x, y, z), _q, _e.set(scale[0], scale[1], scale[2]));
  return geo.applyMatrix4(_m) as T;
}

/** Flat vertex colour so differently coloured parts share one draw call. */
function paint<T extends BufferGeometry>(geo: T, hex: string): T {
  const c = new Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo;
}

/** mergeGeometries needs matching attributes: drop everything but position/normal/uv/color. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.uv) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  return mergeGeometries(clean)!;
}

const cyl = (rTop: number, rBottom: number, h: number, seg = 32) => new CylinderGeometry(rTop, rBottom, h, seg);

// ------------------------------------------------------------------ Pieces (local +z faces the room's centre)
function buildArmchair() {
  const boucle = merge([
    put(softBox(0.66, 0.24, 0.58, 0.45, 4), [0, 0.12, 0]),
    put(softBox(0.74, 0.16, 0.62, 0.48, 4), [0, 0.32, 0.02]),
    put(softBox(0.76, 0.56, 0.18, 0.48, 4), [0, 0.6, -0.25], [-0.16, 0, 0]),
    put(softBox(0.15, 0.36, 0.64, 0.48, 4), [-0.36, 0.42, 0]),
    put(softBox(0.15, 0.36, 0.64, 0.48, 4), [0.36, 0.42, 0]),
  ]);
  // A folded throw over one arm and a small cushion.
  const textile = merge([
    paint(put(softBox(0.18, 0.05, 0.5, 0.5, 3), [0.37, 0.62, 0.02], [0, 0, -0.08]), '#D9A48B'),
    paint(put(new SphereGeometry(1, 20, 14), [-0.12, 0.5, -0.1], [-0.3, 0.3, 0.1], [0.15, 0.13, 0.06]), '#C9D5BE'),
  ]);
  return { boucle, textile };
}

function buildFloorLamp() {
  const brass = merge([put(cyl(0.14, 0.15, 0.022, 40), [0, 0.011, 0]), put(cyl(0.011, 0.011, 1.42, 12), [0, 0.72, 0])]);
  const shade = put(new CylinderGeometry(0.16, 0.23, 0.32, 40, 1, true), [0, 1.52, 0]);
  const bulb = put(new SphereGeometry(0.07, 16, 12), [0, 1.46, 0]);
  return { brass, shade, bulb };
}

function buildSideTable() {
  const oak = merge([put(cyl(0.24, 0.24, 0.03, 48), [0, 0.53, 0]), put(cyl(0.15, 0.16, 0.022, 40), [0, 0.011, 0])]);
  const brass = put(cyl(0.016, 0.016, 0.5, 12), [0, 0.27, 0]);
  const books = merge([
    paint(put(softBox(0.2, 0.035, 0.27, 0.3, 2), [0.04, 0.563, 0.02], [0, 0.2, 0]), '#2E4057'),
    paint(put(softBox(0.18, 0.03, 0.24, 0.3, 2), [0.04, 0.595, 0.02], [0, -0.15, 0]), '#E8DCC8'),
    paint(put(softBox(0.16, 0.028, 0.22, 0.3, 2), [0.05, 0.624, 0.02], [0, 0.35, 0]), '#C8553D'),
  ]);
  return { oak, brass, books };
}

/** Round coffee table on three brass legs, with a vase of dried stems and two art books. */
function buildCoffeeTable() {
  const oak = put(cyl(0.46, 0.46, 0.04, 64), [0, 0.36, 0]);
  const legs = merge(
    [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      return put(cyl(0.014, 0.01, 0.34, 10), [Math.cos(a) * 0.32, 0.17, Math.sin(a) * 0.32], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
    }),
  );
  const vase = put(
    new LatheGeometry(
      [
        [0.001, 0],
        [0.06, 0],
        [0.085, 0.05],
        [0.09, 0.11],
        [0.06, 0.2],
        [0.035, 0.24],
        [0.04, 0.26],
      ].map(([x, y]) => new Vector2(x, y)),
      40,
    ),
    [0.14, 0.38, -0.08],
  );
  const stems = merge(
    [
      [0.1, 0.28],
      [-0.12, 0.25],
      [0.02, 0.36],
      [0.2, 0.3],
    ].map(([tilt, len], i) =>
      put(cyl(0.003, 0.004, len, 5), [0.14 + tilt * len * 0.5, 0.62 + len * 0.5, -0.08 + (i - 1.5) * 0.02], [0, 0, -tilt]),
    ),
  );
  const heads = merge(
    [
      [0.1, 0.28],
      [-0.12, 0.25],
      [0.02, 0.36],
      [0.2, 0.3],
    ].map(([tilt, len], i) =>
      put(new SphereGeometry(1, 10, 8), [0.14 + tilt * len, 0.62 + len, -0.08 + (i - 1.5) * 0.02], [0, 0, 0], [0.03, 0.05, 0.03]),
    ),
  );
  const books = merge([
    paint(put(softBox(0.3, 0.035, 0.24, 0.3, 2), [-0.14, 0.4, 0.08], [0, 0.3, 0]), '#F2C57C'),
    paint(put(softBox(0.26, 0.03, 0.2, 0.3, 2), [-0.13, 0.433, 0.08], [0, 0.1, 0]), '#7B9E89'),
  ]);
  return { oak, legs, vase, stems, heads, books };
}

/** Paper lantern hanging from the dome on a thin cord. */
function buildPendant(drop: number) {
  const lantern = put(new SphereGeometry(0.26, 40, 24), [0, 0, 0], [0, 0, 0], [1, 0.88, 1]);
  const ribs = merge(
    [-0.14, -0.07, 0, 0.07, 0.14].map((y) => {
      const r = Math.sqrt(Math.max(0, 0.26 * 0.26 - (y / 0.88) ** 2)) + 0.002;
      return put(new CylinderGeometry(r, r, 0.004, 48, 1, true), [0, y, 0]);
    }),
  );
  const cord = put(cyl(0.004, 0.004, drop, 6), [0, 0.22 + drop / 2, 0]);
  return { lantern, ribs, cord };
}

// ------------------------------------------------------------------ Placement
/** Angles clockwise from the window, like the furniture zones (see palaceLayout ZONE_ANGLES). */
const READING_CORNER = 180;
const ART = [
  { angle: 78, w: 0.8, h: 1.06, seed: 0.13 },
  { angle: -78, w: 0.8, h: 1.06, seed: 0.57 },
  { angle: 130, w: 0.64, h: 0.84, seed: 0.81 },
  { angle: -130, w: 0.64, h: 0.84, seed: 0.34 },
];
const PLANTS = [118, -118];
const ART_Y = 1.62;

const polar = (angle: number, dist: number): [number, number, number] => {
  const t = (angle * Math.PI) / 180;
  return [Math.sin(t) * dist, 0, -Math.cos(t) * dist];
};

interface Props {
  dimsRef: RoomDimsRef;
}

/**
 * The lived-in part of the room, placed in the gaps between the collections: a reading
 * corner opposite the window, a coffee table on the rug, a paper lantern, framed prints
 * on the wall and two tall plants. Everything follows the room as it grows.
 */
export default function RoomDecor({ dimsRef }: Props) {
  const corner = useRef<Group>(null);
  const coffee = useRef<Group>(null);
  const pendant = useRef<Group>(null);
  const skirting = useRef<Group>(null);
  const art = useRef<(Group | null)[]>([]);
  const plants = useRef<(Group | null)[]>([]);
  const lastRadius = useRef(0);

  const res = useMemo(() => {
    const armchair = buildArmchair();
    const lamp = buildFloorLamp();
    const side = buildSideTable();
    const table = buildCoffeeTable();
    const hanging = buildPendant(4.5);
    const plant = buildPlant(15, 1.25, 0.15, 71);
    // Unit-radius oak skirting ring, scaled to the edge of the parquet.
    const skirtingGeo = new CylinderGeometry(1, 1, 0.07, 160, 1, true);
    const artMats = ART.map(
      (a) =>
        new ShaderMaterial({
          vertexShader: artVertex,
          fragmentShader: artFragment,
          uniforms: { uSeed: { value: a.seed }, uAspect: { value: a.w / a.h } },
        }),
    );
    const frameGeos = ART.map((a) => softBox(a.w + 0.06, a.h + 0.06, 0.035, 0.25, 2));
    const artGeos = ART.map((a) => new PlaneGeometry(a.w, a.h));
    const mats = {
      boucle: new MeshStandardMaterial({ color: '#F3ECE2', roughness: 1 }),
      painted: new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
      oak: new MeshStandardMaterial({ color: '#D8B88E', roughness: 0.5 }),
      // Seen from inside the ring.
      skirting: new MeshStandardMaterial({ color: '#D2B088', roughness: 0.55, side: DoubleSide }),
      brass: new MeshStandardMaterial({ color: '#C9A56A', metalness: 0.9, roughness: 0.3 }),
      linen: new MeshStandardMaterial({ color: '#FBF4E8', roughness: 0.9, side: DoubleSide, emissive: '#FFD9A6', emissiveIntensity: 0.55 }),
      bulb: new MeshBasicMaterial({ color: new Color('#FFE3B8').multiplyScalar(2.2), toneMapped: false }),
      ceramic: new MeshStandardMaterial({ color: '#E9DCCB', roughness: 0.35 }),
      stem: new MeshStandardMaterial({ color: '#B89A74', roughness: 0.8 }),
      pampas: new MeshStandardMaterial({ color: '#EADBC2', roughness: 1 }),
      paper: new MeshStandardMaterial({ color: '#FFF8EE', roughness: 0.9, emissive: '#FFE1B5', emissiveIntensity: 0.9 }),
      cord: new MeshStandardMaterial({ color: '#8C7A68', roughness: 0.8 }),
      frame: new MeshStandardMaterial({ color: '#D2B48C', roughness: 0.5 }),
      pot: new MeshStandardMaterial({ color: '#E7BCA6', roughness: 0.6 }),
      leaf: new MeshStandardMaterial({ color: '#8FBC8B', roughness: 0.55, side: DoubleSide }),
      plantStem: new MeshStandardMaterial({ color: '#7FA36E', roughness: 0.7 }),
    };
    return { armchair, lamp, side, table, hanging, plant, skirtingGeo, artMats, frameGeos, artGeos, mats };
  }, []);

  useEffect(
    () => () => {
      const geos = [
        ...Object.values(res.armchair),
        ...Object.values(res.lamp),
        ...Object.values(res.side),
        ...Object.values(res.table),
        ...Object.values(res.hanging),
        ...Object.values(res.plant),
        res.skirtingGeo,
        ...res.frameGeos,
        ...res.artGeos,
      ];
      geos.forEach((g) => g.dispose());
      [...res.artMats, ...Object.values(res.mats)].forEach((m) => m.dispose());
    },
    [res],
  );

  // Follow the room: only touches the scene graph when the radius actually changes.
  useFrame(() => {
    const { radius, wallHeight } = dimsRef.current;
    if (Math.abs(radius - lastRadius.current) < 1e-4) return;
    lastRadius.current = radius;
    const floorEdge = radius - COVE_RADIUS;
    skirting.current?.scale.set(floorEdge + 0.01, 1, floorEdge + 0.01);

    if (corner.current) {
      corner.current.position.set(...polar(READING_CORNER, floorEdge - 0.55));
      corner.current.rotation.y = -(READING_CORNER * Math.PI) / 180;
    }
    coffee.current?.position.set(0.35, 0, -0.55);
    // The lantern hangs from the dome between you and the window, just off-centre.
    pendant.current?.position.set(0.85, Math.min(3.05, wallHeight - 0.8), -radius + 1.9);
    ART.forEach((a, i) => {
      const g = art.current[i];
      if (!g) return;
      const [x, , z] = polar(a.angle, radius - 0.03);
      g.position.set(x, ART_Y, z);
      g.rotation.y = -(a.angle * Math.PI) / 180;
    });
    PLANTS.forEach((angle, i) => {
      const g = plants.current[i];
      if (!g) return;
      g.position.set(...polar(angle, floorEdge - 0.35));
      g.rotation.y = (angle * Math.PI) / 90;
    });
  });

  const { mats } = res;

  return (
    <group>
      {/* Oak skirting where the parquet meets the curved wall */}
      <group ref={skirting} position-y={0.035}>
        <mesh geometry={res.skirtingGeo} material={mats.skirting} />
      </group>

      {/* Reading corner: armchair, floor lamp, side table */}
      <group ref={corner}>
        <group rotation-y={0.25}>
          <mesh geometry={res.armchair.boucle} material={mats.boucle} />
          <mesh geometry={res.armchair.textile} material={mats.painted} />
        </group>
        <group position={[-0.72, 0, -0.12]}>
          <mesh geometry={res.lamp.brass} material={mats.brass} />
          <mesh geometry={res.lamp.shade} material={mats.linen} />
          <mesh geometry={res.lamp.bulb} material={mats.bulb} />
        </group>
        <group position={[0.68, 0, 0.1]}>
          <mesh geometry={res.side.oak} material={mats.oak} />
          <mesh geometry={res.side.brass} material={mats.brass} />
          <mesh geometry={res.side.books} material={mats.painted} />
        </group>
      </group>

      {/* Coffee table on the rug */}
      <group ref={coffee}>
        <mesh geometry={res.table.oak} material={mats.oak} />
        <mesh geometry={res.table.legs} material={mats.brass} />
        <mesh geometry={res.table.vase} material={mats.ceramic} />
        <mesh geometry={res.table.stems} material={mats.stem} />
        <mesh geometry={res.table.heads} material={mats.pampas} />
        <mesh geometry={res.table.books} material={mats.painted} />
      </group>

      {/* Paper lantern */}
      <group ref={pendant}>
        <mesh geometry={res.hanging.lantern} material={mats.paper} />
        <mesh geometry={res.hanging.ribs} material={mats.cord} />
        <mesh geometry={res.hanging.cord} material={mats.cord} />
      </group>

      {/* Framed prints on the wall between collections */}
      {ART.map((a, i) => (
        <group
          key={i}
          ref={(g) => {
            art.current[i] = g;
          }}
        >
          <mesh geometry={res.frameGeos[i]} material={mats.frame} position-z={-0.018} />
          <mesh geometry={res.artGeos[i]} material={res.artMats[i]} position-z={0.001} />
        </group>
      ))}

      {/* Tall plants */}
      {PLANTS.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            plants.current[i] = g;
          }}
          scale={1.2}
        >
          <mesh geometry={res.plant.pot} material={mats.pot} />
          <mesh geometry={res.plant.stems} material={mats.plantStem} />
          <mesh geometry={res.plant.leaves} material={mats.leaf} />
        </group>
      ))}
    </group>
  );
}
