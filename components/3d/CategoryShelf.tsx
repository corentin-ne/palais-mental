import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { useShallow } from 'zustand/react/shallow';

import type { RoomDimsRef } from './MentalPalace';
import { CategoryId, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemHeightScale } from '@/lib/itemVisuals';
import { BODY_ROUGHNESS, getItemParts, nicheOutline, softBox } from '@/lib/itemGeometry';
import {
  NICHE_BASE_Y,
  NICHE_BORDER,
  PLANK_THICKNESS,
  getShelfLayout,
  getSlotLocalPosition,
  getZoneTransform,
  nicheOuterWidth,
} from '@/lib/palaceLayout';
import { safeDelta } from '@/lib/easing';
import { usePalaceStore } from '@/store/usePalaceStore';

const CAPACITY_CHUNK = 64;
const LACQUER = '#FFFCF7';
const OAK = '#E6CCAA';
const INNER_BOTTOM_RADIUS = 0.05;

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();
const _white = new Color('#FFFFFF');

/** Completed series glow a little brighter on the shelf. */
function instanceColor(item: PalaceItem, out: Color) {
  out.set(getItemColor(item));
  if (item.category === 'series' && item.seasons.every((s) => s.watched === s.episodeCount)) {
    out.lerp(_white, 0.22);
  }
  return out;
}

interface Props {
  category: CategoryId;
  dimsRef: RoomDimsRef;
}

/**
 * One collection: a sculpted, lacquered niche set into the curved wall, lined with the
 * category's pastel and fitted with oak planks — plus all of its items.
 *
 * Items: every settled item is ONE instance in each of two InstancedMeshes (tinted body +
 * vertex-coloured trims), i.e. two draw calls for hundreds of objects. Items still owned by
 * the hero, or lifted out by the inspector, are skipped. When an item is removed the others
 * glide to their new slots instead of jumping.
 *
 * Growth: niche geometry is rebuilt at the NEW size (the arch stays a true arch), then the
 * frame is scaled from old/new → 1 so the niche visibly swells to make room.
 */
export default function CategoryShelf({ category, dimsRef }: Props) {
  const spec = CATEGORY_SPECS[category];
  const invalidate = useThree((s) => s.invalidate);
  const setFocus = usePalaceStore((s) => s.setFocus);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const focused = usePalaceStore((s) => s.focus === category);

  const order = usePalaceStore((s) => s.order[category]);
  // Stable (shallow-compared) list of ids that the InstancedMeshes should draw.
  const visibleIds = usePalaceStore(
    useShallow((s) => {
      const heroItemId = s.heroQueue[0]?.itemId;
      return s.order[category].filter((id) => s.items[id]?.settled && id !== heroItemId && id !== s.inspectId);
    }),
  );
  const items = usePalaceStore((s) => s.items);

  const count = order.length; // includes reserved (in-flight) slots
  const layout = useMemo(() => getShelfLayout(category, count), [category, count]);
  const capacity = Math.ceil((count + 1) / CAPACITY_CHUNK) * CAPACITY_CHUNK;

  const zoneRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const bodyRef = useRef<InstancedMesh>(null);
  const detailRef = useRef<InstancedMesh>(null);
  const grow = useRef({ x: 1, y: 1, length: layout.length, innerHeight: layout.innerHeight });
  /** Animated slot positions, keyed by item id (reflow after deletions). */
  const current = useRef(new Map<string, Vector3>());
  const targets = useRef(new Map<string, { p: Vector3; hs: number }>());

  const parts = getItemParts(category);
  const colorArray = useMemo(() => new Float32Array(capacity * 3), [capacity]);

  // ---- Niche geometry at the current target size.
  const niche = useMemo(() => {
    const w = layout.length;
    const h = layout.innerHeight;
    const rt = layout.archSpace;
    const b = NICHE_BORDER;
    const outer = nicheOutline(new Shape(), w + b * 2, h + b * 2, INNER_BOTTOM_RADIUS + b, rt + b);
    outer.holes.push(nicheOutline(new Path(), w, h, INNER_BOTTOM_RADIUS, rt, b));
    const ring = new ExtrudeGeometry(outer, {
      depth: layout.depth,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.018,
      bevelSegments: 4,
      curveSegments: 28,
    });
    const lining = new ShapeGeometry(nicheOutline(new Shape(), w, h, INNER_BOTTOM_RADIUS, rt, b), 28);
    const plank = softBox(w - 0.004, PLANK_THICKNESS, layout.depth - 0.02, 0.45, 2);
    return { ring, lining, plank };
  }, [layout.length, layout.innerHeight, layout.archSpace, layout.depth]);

  const mats = useMemo(
    () => ({
      lacquer: new MeshStandardMaterial({ color: LACQUER, roughness: 0.3, envMapIntensity: 0.9 }),
      lining: new MeshStandardMaterial({ color: spec.tint, roughness: 0.95, envMapIntensity: 0.3 }),
      oak: new MeshStandardMaterial({ color: OAK, roughness: 0.55 }),
      glow: new MeshBasicMaterial({ color: new Color(spec.accent).lerp(_white, 0.45), toneMapped: false }),
      body: new MeshStandardMaterial({ color: '#FFFFFF', roughness: BODY_ROUGHNESS[category] }),
      detail: new MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }),
    }),
    [spec.tint, spec.accent, category],
  );

  // Start the swell from the previous size whenever the target changes.
  useLayoutEffect(() => {
    const g = grow.current;
    g.x = g.length / layout.length;
    g.y = g.innerHeight / layout.innerHeight;
    g.length = layout.length;
    g.innerHeight = layout.innerHeight;
    invalidate();
    return () => Object.values(niche).forEach((geo) => geo.dispose());
  }, [niche, layout.length, layout.innerHeight, invalidate]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  /** Write every visible instance from the animated positions. */
  const writeInstances = () => {
    const body = bodyRef.current;
    const detail = detailRef.current;
    if (!body || !detail) return;
    _q.identity();
    visibleIds.forEach((id, i) => {
      const t = targets.current.get(id);
      const p = current.current.get(id);
      if (!t || !p) return;
      _s.set(1, t.hs, 1);
      _m.compose(p, _q, _s);
      body.setMatrixAt(i, _m);
      detail.setMatrixAt(i, _m);
    });
    body.count = detail.count = visibleIds.length;
    body.instanceMatrix.needsUpdate = true;
    detail.instanceMatrix.needsUpdate = true;
  };

  // ---- Hero Swap receiver: recompute slot targets; brand-new instances appear exactly in place.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const detail = detailRef.current;
    if (!body || !detail) return;
    const slotOf = new Map(order.map((id, i) => [id, i]));
    const nextTargets = new Map<string, { p: Vector3; hs: number }>();
    visibleIds.forEach((id, i) => {
      const item = items[id];
      const hs = getItemHeightScale(item);
      const p = new Vector3(...getSlotLocalPosition(category, slotOf.get(id)!, layout, hs));
      nextTargets.set(id, { p, hs });
      if (!current.current.has(id)) current.current.set(id, p.clone());
      body.setColorAt(i, instanceColor(item, _c));
    });
    // Forget items that left (deleted, or lifted out — they re-enter at their slot).
    for (const id of current.current.keys()) if (!nextTargets.has(id)) current.current.delete(id);
    targets.current = nextTargets;
    writeInstances();
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.computeBoundingSphere(); // keep frustum culling correct as the niche grows
    detail.computeBoundingSphere();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, items, order, layout, category, capacity, invalidate]);

  // ---- Follow the (animated) room, swell the niche, glide reflowing items.
  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const g = grow.current;
    g.x = MathUtils.damp(g.x, 1, 5, dt);
    g.y = MathUtils.damp(g.y, 1, 5, dt);
    frameRef.current?.scale.set(g.x, g.y, 1);

    const zone = getZoneTransform(category, dimsRef.current, nicheOuterWidth({ length: layout.length * g.x }));
    if (zoneRef.current) {
      zoneRef.current.position.set(...zone.position);
      zoneRef.current.rotation.y = zone.rotationY;
    }

    let moving = Math.abs(g.x - 1) > 1e-3 || Math.abs(g.y - 1) > 1e-3;
    let reflow = false;
    targets.current.forEach((t, id) => {
      const p = current.current.get(id);
      if (!p || p.distanceToSquared(t.p) < 1e-8) return;
      p.x = MathUtils.damp(p.x, t.p.x, 9, dt);
      p.y = MathUtils.damp(p.y, t.p.y, 9, dt);
      p.z = MathUtils.damp(p.z, t.p.z, 9, dt);
      if (p.distanceToSquared(t.p) < 1e-8) p.copy(t.p);
      reflow = true;
    });
    if (reflow) writeInstances();
    moving ||= reflow;
    if (moving) invalidate();
  });

  const onFocusTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setFocus(category);
  };
  const onItemTap = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined) return;
    e.stopPropagation();
    const id = visibleIds[e.instanceId];
    if (id) selectItem(id, { inspect: true });
  };

  const b = NICHE_BORDER;
  const glowYs = Array.from({ length: layout.tiers - 1 }, (_, i) => b + (i + 1) * layout.tierHeight - 0.008);

  return (
    <group ref={zoneRef}>
      {/* Niche frame, anchored at its outer bottom so it swells up and out */}
      <group ref={frameRef} position-y={NICHE_BASE_Y - b}>
        <mesh geometry={niche.ring} material={mats.lacquer} />
        <mesh geometry={niche.lining} material={mats.lining} position-z={0.004} />
        {Array.from({ length: layout.tiers }, (_, i) => (
          <mesh
            key={i}
            geometry={niche.plank}
            material={mats.oak}
            position={[0, b + i * layout.tierHeight + PLANK_THICKNESS / 2, layout.depth / 2]}
          />
        ))}
        {/* Warm light lines under each upper plank: bloom-friendly, zero light cost */}
        {glowYs.map((y, i) => (
          <mesh key={i} material={mats.glow} position={[0, y, layout.depth - 0.03]} rotation-z={Math.PI / 2} scale={[1, layout.length * 0.92, 1]}>
            <capsuleGeometry args={[0.004, 1, 4, 8]} />
          </mesh>
        ))}
      </group>

      {/* All items of this category: two draw calls. */}
      <instancedMesh
        key={`b${capacity}`}
        ref={bodyRef}
        args={[parts.body, mats.body, capacity]}
        onClick={focused ? onItemTap : undefined}
      >
        <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
      </instancedMesh>
      <instancedMesh
        key={`d${capacity}`}
        ref={detailRef}
        args={[parts.detail, mats.detail, capacity]}
        onClick={focused ? onItemTap : undefined}
      />

      {/* Tap target while unfocused: the room itself is the menu. Invisible but raycast. */}
      {!focused && (
        <mesh visible={false} position={[0, NICHE_BASE_Y + layout.innerHeight / 2, layout.depth + 0.05]} onClick={onFocusTap}>
          <planeGeometry args={[nicheOuterWidth(layout) + 0.3, layout.innerHeight + 0.6]} />
        </mesh>
      )}
    </group>
  );
}
