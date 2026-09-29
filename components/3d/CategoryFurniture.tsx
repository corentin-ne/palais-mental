import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useShallow } from 'zustand/react/shallow';

import type { RoomDimsRef } from './MentalPalace';
import FeaturedCover from './FeaturedCover';
import FurnitureTop from './FurnitureTop';
import { CategoryId, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemScale } from '@/lib/itemVisuals';
import { BODY_ROUGHNESS, getItemParts } from '@/lib/itemGeometry';
import { buildPieceGeometry } from '@/lib/furnitureGeometry';
import {
  CROWN_HEIGHT,
  FurniturePiece,
  PieceMaterial,
  getCollectionLayout,
  getFurniturePieces,
  getSlotLocalPosition,
  getZoneTransform,
} from '@/lib/palaceLayout';
import { Spring, safeDelta, spring, springSettled, stepSpring } from '@/lib/easing';
import { useSceneLook } from '@/lib/sceneLook';
import { sceneSignals } from '@/lib/sceneSignals';
import { usePalaceStore } from '@/store/usePalaceStore';

const CAPACITY_CHUNK = 64;
const OAK = '#E8D0AE';
const BRASS = '#C9A56A';

const _m = new Matrix4();
const _q = new Quaternion();
const _c = new Color();
const _white = new Color('#FFFFFF');

/** Completed series read a little brighter on the shelf. */
function instanceColor(item: PalaceItem, out: Color) {
  out.set(getItemColor(item));
  if (item.category === 'series' && item.seasons.every((s) => s.watched === s.episodeCount)) out.lerp(_white, 0.22);
  return out;
}

/** Soft warm contact shadow grounding the furniture on the floor. */
function contactShadowMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 p = abs(vUv - 0.5) * 2.0;
        vec2 q = max(p - vec2(0.62, 0.3), 0.0) / vec2(0.38, 0.7);
        float a = pow(1.0 - clamp(length(q), 0.0, 1.0), 2.0) * 0.28;
        gl_FragColor = vec4(0.36, 0.25, 0.17, a);
      }`,
  });
}

interface PieceAnim {
  /** Animated centre. */
  c: Spring[];
  /** Scale relative to the piece's current geometry (≠ 1 while morphing to a new size). */
  s: Spring[];
  /** 0 → 1 as the piece grows in, back to 0 as it leaves. */
  appear: Spring;
  delay: number;
  size: [number, number, number];
  dying: boolean;
}

interface Props {
  category: CategoryId;
  dimsRef: RoomDimsRef;
}

/**
 * One collection: a piece of furniture that evolves with it (pedestal → console →
 * bookcase → arched cabinet → wall unit), plus all of its objects.
 *
 * Furniture parts keep stable ids across stages and are driven by springs, so an
 * evolution morphs: planks slide, legs retract, an arch rises, towers grow. Each part's
 * geometry is rebuilt at its new size (rounded corners never stretch), then scaled from
 * the old size back to 1.
 *
 * Objects: every settled item is one instance in each of two InstancedMeshes (tinted body
 * + vertex-coloured trims). Items owned by the hero or lifted out by the inspector are
 * skipped; the others glide to their slots whenever the layout changes.
 */
export default function CategoryFurniture({ category, dimsRef }: Props) {
  const spec = CATEGORY_SPECS[category];
  const look = useSceneLook();
  const invalidate = useThree((s) => s.invalidate);
  const setFocus = usePalaceStore((s) => s.setFocus);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const focused = usePalaceStore((s) => s.focus === category);

  const order = usePalaceStore((s) => s.order[category]);
  const visibleIds = usePalaceStore(
    useShallow((s) => {
      const heroItemId = s.heroQueue[0]?.itemId;
      return s.order[category].filter((id) => s.items[id]?.settled && id !== heroItemId && id !== s.inspectId);
    }),
  );
  const items = usePalaceStore((s) => s.items);

  // Most recent object with artwork, displayed face-out on top of the furniture.
  const featuredUrl = usePalaceStore((s) => {
    let best: PalaceItem | undefined;
    for (const id of s.order[category]) {
      const it = s.items[id];
      if (it?.settled && it.coverUrl && (!best || it.createdAt > best.createdAt)) best = it;
    }
    return best?.coverUrl;
  });

  const count = order.length; // includes reserved (in-flight) slots
  const layout = useMemo(() => getCollectionLayout(category, order, items), [category, order, items]);
  const pieces = useMemo(() => getFurniturePieces(layout), [layout]);
  const capacity = Math.ceil((count + 1) / CAPACITY_CHUNK) * CAPACITY_CHUNK;

  const mats = useMemo<Record<PieceMaterial, Material> & { body: MeshStandardMaterial; detail: MeshStandardMaterial; shadow: ShaderMaterial }>(
    () => ({
      lacquer: new MeshStandardMaterial({ color: look.lacquer, roughness: look.lacquerRoughness, envMapIntensity: 1.1 }),
      lining: new MeshStandardMaterial({ color: new Color(spec.accent).lerp(_white, 1 - look.liningAccent), roughness: 0.92, envMapIntensity: 0.35 }),
      oak: new MeshStandardMaterial({ color: OAK, roughness: 0.55 }),
      brass: new MeshStandardMaterial({ color: BRASS, metalness: 0.9, roughness: 0.3 }),
      glow: new MeshBasicMaterial({ color: new Color(spec.accent).lerp(_white, 0.55).multiplyScalar(1.6), toneMapped: false }),
      body: new MeshStandardMaterial({ color: '#FFFFFF', roughness: BODY_ROUGHNESS[category] }),
      detail: new MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }),
      shadow: contactShadowMaterial(),
    }),
    [spec.accent, category, look],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const zoneRef = useRef<Group>(null);
  const bodyGroup = useRef<Group>(null);
  const bodyRef = useRef<InstancedMesh>(null);
  const detailRef = useRef<InstancedMesh>(null);
  const shadowRef = useRef<Mesh>(null);
  const pieceMeshes = useRef(new Map<string, Mesh>());
  const parts = getItemParts(category);
  const colorArray = useMemo(() => new Float32Array(capacity * 3), [capacity]);
  const shadowGeo = useMemo(() => new PlaneGeometry(1, 1), []);
  useEffect(() => () => shadowGeo.dispose(), [shadowGeo]);

  const anim = useRef({
    pieces: new Map<string, PieceAnim>(),
    bounce: spring(0),
    width: spring(layout.outerWidth),
    stage: layout.stage,
    started: false,
    active: true,
    current: new Map<string, Vector3>(),
    targets: new Map<string, { p: Vector3; s: Vector3 }>(),
  });

  // ---- Pieces: everything currently in the layout, plus parts still animating out.
  const [rendered, setRendered] = useState<FurniturePiece[]>(pieces);
  useLayoutEffect(() => {
    const a = anim.current;
    const ids = new Set(pieces.map((p) => p.id));
    pieces.forEach((piece, i) => {
      const pa = a.pieces.get(piece.id);
      if (!pa) {
        a.pieces.set(piece.id, {
          c: piece.center.map(spring),
          s: [spring(1), spring(1), spring(1)],
          appear: spring(0),
          // Assemble bottom-up, a beat after the camera starts turning.
          delay: (a.started ? 0.08 : 0.3) + i * 0.03 + piece.center[1] * 0.12,
          size: piece.size,
          dying: false,
        });
      } else {
        // New geometry is built at the new size: start from the old visual size, spring to 1.
        piece.size.forEach((v, k) => {
          pa.s[k].x = (pa.size[k] * pa.s[k].x) / v;
        });
        pa.size = piece.size;
        pa.dying = false;
      }
    });
    a.pieces.forEach((pa, id) => {
      if (!ids.has(id)) {
        pa.dying = true;
        pa.delay = 0;
      }
    });
    setRendered((prev) => [...pieces, ...prev.filter((p) => !ids.has(p.id) && a.pieces.get(p.id)?.dying)]);
    if (a.started && layout.stage !== a.stage) a.bounce.v += 1.6;
    a.stage = layout.stage;
    a.started = true;
    a.active = true;
    invalidate();
  }, [pieces, layout.stage, invalidate]);

  const geometries = useMemo(() => new Map<string, BufferGeometry>(), []);
  const geometryFor = (p: FurniturePiece) => {
    const key = `${p.id}|${p.shape}|${p.size.map((v) => v.toFixed(4)).join(',')}`;
    let g = geometries.get(key);
    if (!g) {
      g = buildPieceGeometry(p.shape, p.size);
      geometries.set(key, g);
    }
    return { key, geometry: g };
  };
  // Drop geometries no longer referenced.
  useEffect(() => {
    const live = new Set(rendered.map((p) => geometryFor(p).key));
    geometries.forEach((g, k) => {
      if (!live.has(k)) {
        g.dispose();
        geometries.delete(k);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  // ---- Objects: recompute slot targets; brand-new instances appear exactly in place.
  const writeInstances = () => {
    const body = bodyRef.current;
    const detail = detailRef.current;
    if (!body || !detail) return;
    const { current, targets } = anim.current;
    _q.identity();
    visibleIds.forEach((id, i) => {
      const t = targets.get(id);
      const p = current.get(id);
      if (!t || !p) return;
      _m.compose(p, _q, t.s);
      body.setMatrixAt(i, _m);
      detail.setMatrixAt(i, _m);
    });
    body.count = detail.count = visibleIds.length;
    body.instanceMatrix.needsUpdate = true;
    detail.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const detail = detailRef.current;
    if (!body || !detail) return;
    const a = anim.current;
    const slotOf = new Map(order.map((id, i) => [id, i]));
    const next = new Map<string, { p: Vector3; s: Vector3 }>();
    visibleIds.forEach((id, i) => {
      const item = items[id];
      const [sx, sy, sz] = getItemScale(item);
      const p = new Vector3(...getSlotLocalPosition(category, slotOf.get(id)!, layout, sy, sz));
      next.set(id, { p, s: new Vector3(sx, sy, sz) });
      if (!a.current.has(id)) a.current.set(id, p.clone());
      if (sceneSignals.justLanded.delete(id)) a.bounce.v -= 1.1;
      body.setColorAt(i, instanceColor(item, _c));
    });
    for (const id of a.current.keys()) if (!next.has(id)) a.current.delete(id);
    a.targets = next;
    writeInstances();
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.computeBoundingSphere();
    detail.computeBoundingSphere();
    a.active = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, items, order, layout, category, capacity, invalidate]);

  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const a = anim.current;

    stepSpring(a.width, layout.outerWidth, dt, 180, 20);
    const zone = getZoneTransform(category, dimsRef.current, a.width.x);
    if (zoneRef.current) {
      zoneRef.current.position.set(...zone.position);
      zoneRef.current.rotation.y = zone.rotationY;
    }
    if (!a.active) return;
    let moving = !springSettled(a.width, layout.outerWidth);

    // A soft squash and stretch around the floor when an object lands or the piece evolves.
    stepSpring(a.bounce, 0, dt, 300, 16);
    if (!springSettled(a.bounce, 0)) moving = true;
    const b = MathUtils.clamp(a.bounce.x * 0.035, -0.08, 0.08);
    bodyGroup.current?.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);

    const targetOf = new Map(pieces.map((p) => [p.id, p]));
    let removed = false;
    a.pieces.forEach((pa, id) => {
      const target = targetOf.get(id);
      if (pa.delay > 0) {
        pa.delay -= dt;
        moving = true;
      } else {
        stepSpring(pa.appear, pa.dying ? 0 : 1, dt, 220, 19);
        for (let k = 0; k < 3; k++) {
          if (target) stepSpring(pa.c[k], target.center[k], dt, 190, 20);
          stepSpring(pa.s[k], 1, dt, 190, 20);
        }
        const settled =
          springSettled(pa.appear, pa.dying ? 0 : 1) &&
          pa.s.every((sp) => springSettled(sp, 1)) &&
          (!target || pa.c.every((sp, k) => springSettled(sp, target.center[k])));
        if (!settled) moving = true;
        else if (pa.dying) {
          a.pieces.delete(id);
          removed = true;
          return;
        }
      }
      const mesh = pieceMeshes.current.get(id);
      if (!mesh) return;
      const ap = Math.max(0, pa.appear.x);
      const [sx, sy, sz] = pa.s.map((sp) => Math.max(1e-4, sp.x));
      const line = mesh.userData.glow as boolean;
      if (line) {
        // Light lines draw themselves along their length.
        const alongX = pa.size[0] >= pa.size[1];
        mesh.scale.set(alongX ? sx * ap : sx, alongX ? sy : sy * ap, sz);
        mesh.position.set(pa.c[0].x, pa.c[1].x, pa.c[2].x);
      } else {
        // Solid parts grow up from the floor of their own footprint.
        const h = pa.size[1] * sy;
        mesh.scale.set(sx, Math.max(1e-4, sy * ap), sz);
        mesh.position.set(pa.c[0].x, pa.c[1].x - (h * (1 - ap)) / 2, pa.c[2].x);
      }
      mesh.visible = ap > 0.001;
    });
    if (removed) setRendered((prev) => prev.filter((p) => a.pieces.has(p.id)));

    // Objects glide to new slots.
    let reflow = false;
    a.targets.forEach((t, id) => {
      const p = a.current.get(id);
      if (!p || p.distanceToSquared(t.p) < 1e-8) return;
      p.x = MathUtils.damp(p.x, t.p.x, 10, dt);
      p.y = MathUtils.damp(p.y, t.p.y, 10, dt);
      p.z = MathUtils.damp(p.z, t.p.z, 10, dt);
      if (p.distanceToSquared(t.p) < 1e-8) p.copy(t.p);
      reflow = true;
    });
    if (reflow) writeInstances();

    shadowRef.current?.scale.set(a.width.x + 0.5, layout.depth + 0.6, 1);

    a.active = moving || reflow;
    if (a.active) invalidate();
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

  const coverBox =
    layout.stage >= 3
      ? { w: layout.length * 0.5, h: CROWN_HEIGHT * 0.72 }
      : layout.stage >= 1
        ? { w: layout.length * 0.4, h: 0.26 }
        : null;

  return (
    <group ref={zoneRef}>
      <mesh ref={shadowRef} geometry={shadowGeo} material={mats.shadow} rotation-x={-Math.PI / 2} position={[0, 0.006, layout.depth / 2]} />

      <group ref={bodyGroup}>
        {rendered.map((p) => (
          <mesh
            key={p.id}
            ref={(m) => {
              if (m) {
                m.userData.glow = p.mat === 'glow';
                pieceMeshes.current.set(p.id, m);
              } else pieceMeshes.current.delete(p.id);
            }}
            geometry={geometryFor(p).geometry}
            material={mats[p.mat]}
            visible={false}
          />
        ))}

        <FurnitureTop layout={layout} />

        {featuredUrl && coverBox && (
          <FeaturedCover url={featuredUrl} maxWidth={coverBox.w} maxHeight={coverBox.h} position={[0, layout.height + 0.004, layout.depth * 0.42]} />
        )}

        {/* All objects of this collection: two draw calls. */}
        <instancedMesh key={`b${capacity}`} ref={bodyRef} args={[parts.body, mats.body, capacity]} onClick={focused ? onItemTap : undefined}>
          <instancedBufferAttribute attach="instanceColor" args={[colorArray, 3]} />
        </instancedMesh>
        <instancedMesh key={`d${capacity}`} ref={detailRef} args={[parts.detail, mats.detail, capacity]} onClick={focused ? onItemTap : undefined} />
      </group>

      {/* Tap target while unfocused: the room itself is the menu. Invisible but raycast. */}
      {!focused && (
        <mesh visible={false} position={[0, layout.top / 2, layout.depth + 0.05]} onClick={onFocusTap}>
          <planeGeometry args={[layout.outerWidth + 0.3, layout.top + 0.4]} />
        </mesh>
      )}
    </group>
  );
}
