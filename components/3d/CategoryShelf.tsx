import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Color, Group, InstancedMesh, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { useShallow } from 'zustand/react/shallow';

import type { RoomDimsRef } from './MentalPalace';
import { CategoryId, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemHeightScale } from '@/lib/itemVisuals';
import { getItemGeometry, softBox } from '@/lib/itemGeometry';
import { PLANK_THICKNESS, SHELF_BASE_Y, getShelfLayout, getSlotLocalPosition, getZoneTransform } from '@/lib/palaceLayout';
import { safeDelta } from '@/lib/easing';
import { usePalaceStore } from '@/store/usePalaceStore';

const CAPACITY_CHUNK = 64;
const OAK = '#F3E2C8';
const CREAM = new Color('#FFF6EA');
const SIDE_T = 0.045;

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
    out.lerp(_white, 0.25);
  }
  return out;
}

interface Props {
  category: CategoryId;
  dimsRef: RoomDimsRef;
}

/**
 * The category's rounded container + all of its items. Every settled item is ONE
 * instance of a single InstancedMesh (1 draw call for hundreds of items). Items still
 * owned by the HeroItemSpawner are skipped until `completeHero` flips them to settled.
 *
 * Growth: frame geometry is rebuilt at the NEW size (rounded corners stay true), then
 * scaled from old/new → 1 so the container visibly swells to make room.
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
  const sideL = useRef<Mesh>(null);
  const sideR = useRef<Mesh>(null);
  const back = useRef<Mesh>(null);
  const base = useRef<Mesh>(null);
  const planks = useRef<(Mesh | null)[]>([]);
  const grow = useRef({ x: 1, y: 1, length: layout.length, height: layout.height });

  const geometry = getItemGeometry(category);
  const colorArray = useMemo(() => new Float32Array(capacity * 3), [capacity]);

  // ---- Soft, rounded container geometry at the current target size.
  const frame = useMemo(() => {
    const innerH = layout.height - SHELF_BASE_Y + PLANK_THICKNESS;
    const side = softBox(SIDE_T, innerH, layout.depth, 0.45);
    side.translate(0, innerH / 2, 0); // anchored at the base plank: grows upward
    const backPanel = softBox(layout.length + SIDE_T, innerH, 0.03, 0.45);
    backPanel.translate(0, innerH / 2, 0);
    const cabinet = softBox(layout.length + SIDE_T * 2, SHELF_BASE_Y, layout.depth + 0.04, 0.3);
    cabinet.translate(0, SHELF_BASE_Y / 2, 0);
    const plank = softBox(layout.length, PLANK_THICKNESS, layout.depth, 0.45);
    return { side, backPanel, cabinet, plank };
  }, [layout.length, layout.height, layout.depth]);

  const mats = useMemo(
    () => ({
      oak: new MeshStandardMaterial({ color: OAK, roughness: 0.65 }),
      // A pastel wash of the category accent lines the back of each container.
      back: new MeshStandardMaterial({ color: new Color(spec.accent).lerp(CREAM, 0.72), roughness: 0.9 }),
      items: new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5, metalness: 0 }),
    }),
    [spec.accent],
  );

  // Start the swell from the previous size whenever the target changes.
  useLayoutEffect(() => {
    const g = grow.current;
    g.x = g.length / layout.length;
    g.y = (g.height - SHELF_BASE_Y) / (layout.height - SHELF_BASE_Y);
    g.length = layout.length;
    g.height = layout.height;
    invalidate();
    return () => Object.values(frame).forEach((geo) => geo.dispose());
  }, [frame, layout.length, layout.height, invalidate]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

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

  // ---- Follow the (animated) room + swell the container smoothly.
  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const zone = getZoneTransform(category, dimsRef.current);
    if (zoneRef.current) {
      zoneRef.current.position.set(...zone.position);
      zoneRef.current.rotation.y = zone.rotationY;
    }

    const g = grow.current;
    g.x = MathUtils.damp(g.x, 1, 5, dt);
    g.y = MathUtils.damp(g.y, 1, 5, dt);
    const half = (layout.length * g.x) / 2 + SIDE_T / 2;
    const zMid = layout.depth / 2;
    sideL.current?.position.set(-half, SHELF_BASE_Y - PLANK_THICKNESS / 2, zMid);
    sideR.current?.position.set(half, SHELF_BASE_Y - PLANK_THICKNESS / 2, zMid);
    sideL.current?.scale.set(1, g.y, 1);
    sideR.current?.scale.set(1, g.y, 1);
    back.current?.scale.set(g.x, g.y, 1);
    base.current?.scale.set(g.x, 1, 1);
    planks.current.forEach((p, i) => {
      if (!p) return;
      p.scale.set(g.x, 1, 1);
      p.position.y = SHELF_BASE_Y + i * layout.tierHeight * g.y;
    });

    if (Math.abs(g.x - 1) > 1e-3 || Math.abs(g.y - 1) > 1e-3) invalidate();
  });

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setFocus(category);
  };

  return (
    <group ref={zoneRef}>
      {/* Pillowy cabinet the shelf stands on */}
      <mesh ref={base} geometry={frame.cabinet} material={mats.oak} position={[0, 0, layout.depth / 2]} />
      <mesh ref={back} geometry={frame.backPanel} material={mats.back} position={[0, SHELF_BASE_Y - PLANK_THICKNESS / 2, 0.015]} />
      <mesh ref={sideL} geometry={frame.side} material={mats.oak} />
      <mesh ref={sideR} geometry={frame.side} material={mats.oak} />
      {Array.from({ length: layout.tiers + 1 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            planks.current[i] = m;
          }}
          geometry={frame.plank}
          material={mats.oak}
          position={[0, SHELF_BASE_Y + i * layout.tierHeight, layout.depth / 2]}
        />
      ))}

      {/* Soft accent glow under the top plank: a bloom-friendly line, zero light cost. */}
      <mesh position={[0, layout.height - PLANK_THICKNESS, layout.depth - 0.02]} rotation-z={Math.PI / 2} scale={[1, layout.length * 0.9, 1]}>
        <capsuleGeometry args={[0.006, 1, 4, 8]} />
        <meshBasicMaterial color={spec.accent} toneMapped={false} />
      </mesh>

      {/* All items of this category: a single draw call. */}
      <instancedMesh key={capacity} ref={meshRef} args={[geometry, mats.items, capacity]} frustumCulled>
        <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
      </instancedMesh>

      {/* Tap target: the room itself is the menu. Invisible (no draw call) but still raycast. */}
      <mesh visible={false} position={[0, layout.height / 2, layout.depth + 0.02]} onClick={onTap}>
        <planeGeometry args={[layout.length + 0.3, layout.height + 0.3]} />
      </mesh>
    </group>
  );
}
