import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, MeshBasicMaterial, MeshStandardMaterial, Vector2 } from 'three';

import { buildPlant } from './environment/RoomShell';
import { FurnitureLayout } from '@/lib/palaceLayout';
import { Spring, safeDelta, spring, springSettled, stepSpring } from '@/lib/easing';

/** Shared by every piece of furniture: built once, never disposed (they live as long as the app). */
let shared: ReturnType<typeof build> | null = null;
function build() {
  const vase = new LatheGeometry(
    [
      [0.001, 0],
      [0.035, 0],
      [0.05, 0.03],
      [0.052, 0.07],
      [0.03, 0.13],
      [0.02, 0.15],
      [0.024, 0.16],
    ].map(([x, y]) => new Vector2(x, y)),
    32,
  );
  const stem = new CylinderGeometry(0.0022, 0.003, 0.22, 5);
  stem.translate(0, 0.27, 0);
  const candle = new CylinderGeometry(0.016, 0.016, 0.14, 20);
  candle.translate(0, 0.07, 0);
  const holder = new CylinderGeometry(0.03, 0.034, 0.02, 24);
  holder.translate(0, 0.01, 0);
  const flame = new CylinderGeometry(0.001, 0.006, 0.022, 8);
  flame.translate(0, 0.155, 0);
  return {
    vase,
    stem,
    candle,
    holder,
    flame,
    plant: buildPlant(8, 0.42, 0.09, 53),
    mats: {
      ceramic: new MeshStandardMaterial({ color: '#EADFD1', roughness: 0.35 }),
      stem: new MeshStandardMaterial({ color: '#B89A74', roughness: 0.8 }),
      wax: new MeshStandardMaterial({ color: '#FBF6EE', roughness: 0.6 }),
      brass: new MeshStandardMaterial({ color: '#C9A56A', metalness: 0.9, roughness: 0.3 }),
      flame: new MeshBasicMaterial({ color: '#FFD9A0', toneMapped: false }),
      pot: new MeshStandardMaterial({ color: '#E7BCA6', roughness: 0.6 }),
      leaf: new MeshStandardMaterial({ color: '#8FBC8B', roughness: 0.55, side: DoubleSide }),
      plantStem: new MeshStandardMaterial({ color: '#7FA36E', roughness: 0.7 }),
    },
  };
}

/** Grows its children in from nothing with a small overshoot. */
function Grow({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const s = useRef<Spring>(spring(0));
  const delay = useRef(0.35);
  const invalidate = useThree((st) => st.invalidate);
  useFrame((_, raw) => {
    const dt = safeDelta(raw);
    if (delay.current > 0) {
      delay.current -= dt;
      invalidate();
      return;
    }
    if (springSettled(s.current, 1)) return;
    stepSpring(s.current, 1, dt, 240, 16);
    ref.current?.scale.setScalar(Math.max(1e-4, s.current.x));
    invalidate();
  });
  return (
    <group ref={ref} position={position} scale={1e-4}>
      {children}
    </group>
  );
}

function Vase({ geo, mats }: { geo: NonNullable<typeof shared>; mats: NonNullable<typeof shared>['mats'] }) {
  return (
    <>
      <mesh geometry={geo.vase} material={mats.ceramic} />
      {[-0.25, 0.1, 0.35].map((r, i) => (
        <mesh key={i} geometry={geo.stem} material={mats.stem} rotation={[0.1 * i - 0.1, i, r]} />
      ))}
    </>
  );
}

function Plant({ geo, mats }: { geo: NonNullable<typeof shared>; mats: NonNullable<typeof shared>['mats'] }) {
  const p = geo.plant;
  return (
    <group scale={0.42}>
      <mesh geometry={p.pot as BufferGeometry} material={mats.pot} />
      <mesh geometry={p.stems} material={mats.plantStem} />
      <mesh geometry={p.leaves} material={mats.leaf} />
    </group>
  );
}

function Candles({ geo, mats }: { geo: NonNullable<typeof shared>; mats: NonNullable<typeof shared>['mats'] }) {
  return (
    <>
      {[
        [0, 0, 1],
        [0.07, 0.02, 0.75],
      ].map(([x, z, h], i) => (
        <group key={i} position={[x, 0, z]} scale={[1, h, 1]}>
          <mesh geometry={geo.holder} material={mats.brass} />
          <mesh geometry={geo.candle} material={mats.wax} />
          <mesh geometry={geo.flame} material={mats.flame} />
        </group>
      ))}
    </>
  );
}

/**
 * Small things that gather on top of a piece of furniture as it evolves: a vase on the
 * console, a plant joining it on the bookcase, candles on the cabinet. They keep clear of
 * the featured cover in the middle.
 */
export default function FurnitureTop({ layout }: { layout: FurnitureLayout }) {
  shared ??= build();
  const geo = shared;
  const { mats } = geo;
  const { stage, height: y, length, depth } = layout;
  // Narrow pieces keep their top for the featured cover alone.
  if (stage === 0 || length < 0.62) return null;
  const edge = length / 2 - 0.09;
  const z = depth * 0.5;
  return (
    <>
      <Grow key={`vase-${stage >= 2}`} position={[edge, y, z]}>
        <Vase geo={geo} mats={mats} />
      </Grow>
      {stage >= 2 && (
        <Grow key="plant" position={[-edge + 0.02, y, z]}>
          <Plant geo={geo} mats={mats} />
        </Grow>
      )}
      {stage >= 3 && (
        <Grow key="candles" position={[edge - 0.13, y, z - 0.03]}>
          <Candles geo={geo} mats={mats} />
        </Grow>
      )}
    </>
  );
}
