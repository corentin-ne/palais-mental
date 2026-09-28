import { useLayoutEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Color, Group, InstancedMesh, MathUtils, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { useShallow } from 'zustand/react/shallow';

import type { RoomDimsRef } from './MentalPalace';
import { CategoryId, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemHeightScale } from '@/lib/itemVisuals';
import { getItemGeometry } from '@/lib/itemGeometry';
import { PLANK_THICKNESS, SHELF_BASE_Y, getShelfLayout, getSlotLocalPosition, getZoneTransform } from '@/lib/palaceLayout';
import { safeDelta } from '@/lib/easing';
import { usePalaceStore } from '@/store/usePalaceStore';

const CAPACITY_CHUNK = 64;
const WOOD = '#2B2520';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();
const _white = new Color('#FFFFFF');

/** Completed series glow a little brighter on the shelf. */
function instanceColor(item: PalaceItem, out: Color) {
  out.set(getItemColor(item));
  if (item.category === 'series' && item.seasons.every((s) => s.watched === s.episodeCount)) {
    out.lerp(_white, 0.18);
  }
  return out;
}

interface Props {
  category: CategoryId;
  dimsRef: RoomDimsRef;
}

/**
 * Static storage for one category. Every settled item is ONE instance of a single
 * InstancedMesh (1 draw call for hundreds of items). Items still owned by the
 * HeroItemSpawner are skipped until `completeHero` flips them to settled.
 */
export default function CategoryShelf({ category, dimsRef }: Props) {
  const spec = CATEGORY_SPECS[category];
  const invalidate = useThree((s) => s.invalidate);
  const setFocus = usePalaceStore((s) => s.setFocus);

  const order = usePalaceStore((s) => s.order[category]);
  // Stable (shallow-compared) list of ids that the InstancedMesh should draw.
  const visibleIds = usePalaceStore(
    useShallow((s) => {
      const heroItemId = s.heroQueue[0]?.itemId;
      return s.order[category].filter((id) => s.items[id]?.settled && id !== heroItemId);
    }),
  );
  const items = usePalaceStore((s) => s.items);

  const count = order.length; // includes reserved (in-flight) slots
  const layout = useMemo(() => getShelfLayout(category, count), [category, count]);
  const capacity = Math.ceil((count + 1) / CAPACITY_CHUNK) * CAPACITY_CHUNK;

  const zoneRef = useRef<Group>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const frame = useRef({ length: layout.length, height: layout.height });
  const sideL = useRef<Mesh>(null);
  const sideR = useRef<Mesh>(null);
  const planks = useRef<(Mesh | null)[]>([]);

  const geometry = getItemGeometry(category);
  const colorArray = useMemo(() => new Float32Array(capacity * 3), [capacity]);

  // ---- Hero Swap receiver: write every visible instance matrix in one pass.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const slotOf = new Map(order.map((id, i) => [id, i]));
    _q.identity();

    visibleIds.forEach((id, i) => {
      const item = items[id];
      const hs = getItemHeightScale(item);
      _p.set(...getSlotLocalPosition(category, slotOf.get(id)!, layout, hs));
      _s.set(1, hs, 1);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, instanceColor(item, _c));
    });

    mesh.count = visibleIds.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); // keep frustum culling correct as the shelf grows
    invalidate();
  }, [visibleIds, items, order, layout, category, capacity, invalidate]);

  useLayoutEffect(() => invalidate(), [layout, invalidate]);

  // ---- Follow the (animated) room + grow the frame smoothly.
  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const zone = getZoneTransform(category, dimsRef.current);
    zoneRef.current?.position.set(...zone.position);
    if (zoneRef.current) zoneRef.current.rotation.y = zone.rotationY;

    const f = frame.current;
    f.length = MathUtils.damp(f.length, layout.length, 5, dt);
    f.height = MathUtils.damp(f.height, layout.height, 5, dt);
    const half = f.length / 2;
    sideL.current?.position.set(-half, f.height / 2, layout.depth / 2);
    sideR.current?.position.set(half, f.height / 2, layout.depth / 2);
    sideL.current?.scale.set(1, f.height, 1);
    sideR.current?.scale.set(1, f.height, 1);
    planks.current.forEach((p) => p?.scale.set(f.length, 1, 1));

    if (Math.abs(f.length - layout.length) > 1e-3 || Math.abs(f.height - layout.height) > 1e-3) invalidate();
  });

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setFocus(category);
  };

  const plankYs = Array.from({ length: layout.tiers + 1 }, (_, i) => SHELF_BASE_Y + i * layout.tierHeight);

  return (
    <group ref={zoneRef}>
      {/* Frame: unit-length planks scaled on X so the shelf can stretch without new geometry. */}
      {plankYs.map((y, i) => (
        <mesh
          key={i}
          ref={(m) => {
            planks.current[i] = m;
          }}
          position={[0, y, layout.depth / 2]}
          scale={[frame.current.length, 1, 1]}
        >
          <boxGeometry args={[1, PLANK_THICKNESS, layout.depth]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
      ))}
      <mesh ref={sideL}>
        <boxGeometry args={[0.03, 1, layout.depth]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
      <mesh ref={sideR}>
        <boxGeometry args={[0.03, 1, layout.depth]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>

      {/* Accent LED strip under the base plank: cheap cinematic light, zero light cost. */}
      <RoundedBox
        args={[layout.length * 0.96, 0.012, 0.012]}
        radius={0.005}
        position={[0, SHELF_BASE_Y - PLANK_THICKNESS, layout.depth - 0.01]}
      >
        <meshBasicMaterial color={spec.accent} toneMapped={false} />
      </RoundedBox>

      {/* All items of this category: a single draw call. */}
      <instancedMesh key={capacity} ref={meshRef} args={[geometry, undefined, capacity]} frustumCulled>
        <meshStandardMaterial color="#FFFFFF" roughness={0.45} metalness={0.05} />
        <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
      </instancedMesh>

      {/* Tap target: the room itself is the menu. Invisible (no draw call) but still raycast. */}
      <mesh visible={false} position={[0, layout.height / 2, layout.depth + 0.02]} onClick={onTap}>
        <planeGeometry args={[layout.length + 0.3, layout.height + 0.3]} />
      </mesh>
    </group>
  );
}
