import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, MathUtils, MeshStandardMaterial } from 'three';

import { DecorMaterial, getDecorModel } from '@/lib/decorGeometry';
import { safeDelta } from '@/lib/easing';
import { softBox } from '@/lib/itemGeometry';
import { DECOR } from '@/lib/milestones';
import { NICHE_BASE_Y, NICHE_BORDER } from '@/lib/palaceLayout';
import { CategoryId } from '@/lib/types';

/** Height of the ledge top under each niche, and where each earned object sits on it (fraction of ledge width). */
export const LEDGE_TOP = NICHE_BASE_Y - NICHE_BORDER - 0.2;
const LEDGE_DEPTH = 0.27;
const SLOTS = [-0.37, 0.37, 0, -0.21, 0.21];

const materials = new Map<DecorMaterial, MeshStandardMaterial>();
function materialFor(m: DecorMaterial) {
  let mat = materials.get(m);
  if (!mat) {
    mat = new MeshStandardMaterial({
      color: m.color,
      roughness: m.rough ?? 0.5,
      metalness: m.metal ? 0.9 : 0,
      emissive: m.glow ? m.color : '#000000',
      emissiveIntensity: m.glow ? 1.4 : 0,
      toneMapped: !m.glow,
    });
    materials.set(m, mat);
  }
  return mat;
}

/**
 * The oak ledge under a niche and the objects the niche has earned so far. A newly
 * earned object grows into place with a small overshoot, so the reward is seen.
 */
export default function NicheDecor({ category, unlocked, width }: { category: CategoryId; unlocked: number; width: number }) {
  const ledgeWidth = Math.max(width, 1.1);
  const ledge = useMemo(() => softBox(ledgeWidth, 0.036, LEDGE_DEPTH, 0.3, 2), [ledgeWidth]);
  const bracket = useMemo(() => softBox(0.03, 0.09, LEDGE_DEPTH * 0.8, 0.2, 2), []);
  const oak = useMemo(() => new MeshStandardMaterial({ color: '#D9BE98', roughness: 0.55 }), []);
  useEffect(() => () => ledge.dispose(), [ledge]);
  useEffect(
    () => () => {
      bracket.dispose();
      oak.dispose();
    },
    [bracket, oak],
  );

  return (
    <group>
      <mesh geometry={ledge} material={oak} position={[0, LEDGE_TOP - 0.018, LEDGE_DEPTH / 2]} />
      <mesh geometry={bracket} material={oak} position={[-ledgeWidth * 0.3, LEDGE_TOP - 0.08, LEDGE_DEPTH * 0.42]} />
      <mesh geometry={bracket} material={oak} position={[ledgeWidth * 0.3, LEDGE_TOP - 0.08, LEDGE_DEPTH * 0.42]} />
      {DECOR[category].slice(0, unlocked).map((id, i) => (
        <DecorPiece key={id} id={id} position={[SLOTS[i] * ledgeWidth, LEDGE_TOP, LEDGE_DEPTH * 0.5]} yaw={(i % 2 ? -1 : 1) * 0.18} />
      ))}
    </group>
  );
}

function DecorPiece({ id, position, yaw }: { id: string; position: [number, number, number]; yaw: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const model = getDecorModel(id);
  const ref = useRef<Group>(null);
  const anim = useRef({ s: 0.001, v: 0 });

  useEffect(() => invalidate(), [invalidate]);

  // Critically under-damped spring: grows in with a little bounce.
  useFrame((_, raw) => {
    const g = ref.current;
    const a = anim.current;
    if (!g || (Math.abs(a.s - 1) < 1e-3 && Math.abs(a.v) < 1e-3)) return;
    const dt = safeDelta(raw);
    a.v += (1 - a.s) * 180 * dt - a.v * 14 * dt;
    a.s = MathUtils.clamp(a.s + a.v * dt, 0.001, 1.3);
    g.scale.setScalar(a.s);
    invalidate();
  });

  if (!model) return null;
  return (
    <group ref={ref} position={position} rotation-y={yaw} scale={0.001}>
      {model.parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={materialFor(p.material)} dispose={null} />
      ))}
    </group>
  );
}
