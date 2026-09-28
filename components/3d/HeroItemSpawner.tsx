import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

import { HeroEvent, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemHeightScale } from '@/lib/itemVisuals';
import { BODY_ROUGHNESS, DISC, getDiscSliceGeometry } from '@/lib/itemGeometry';
import { getRoomDims, getRoomLevel, getSlotWorld } from '@/lib/palaceLayout';
import ItemModel from './ItemModel';
import { clamp01, cubicBezier, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, safeDelta } from '@/lib/easing';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { beamFragment, beamVertex, haloFragment, haloVertex, sparkleFragment, sparkleVertex } from '@/shaders/heroFx';
import { selectActiveHero, usePalaceStore } from '@/store/usePalaceStore';

// ------------------------------------------------------------------ Tuning
const HERO_DISTANCE = 1.25; // meters in front of the camera
const LID_OPEN_ANGLE = 1.95; // ~112°
const SPARKLE_COUNT = 90;
const SUNLIGHT = '#FFE2B0';
const UP = new Vector3(0, 1, 0);

type PhaseName = 'materialize' | 'open' | 'slice' | 'insert' | 'close' | 'hold' | 'fly';
type Timeline = Partial<Record<PhaseName, { start: number; dur: number }>>;

/**
 * Item:     materialize → hold → fly
 * Episode:  materialize → open → slice → hold → close (disc dissolves)          → fly
 * Season:   materialize → open → slice → insert → close (snap + flash) → hold → fly
 */
function buildTimeline(event: HeroEvent): Timeline {
  const seq: [PhaseName, number][] = [['materialize', 1.1]];
  if (event.kind === 'episode') {
    seq.push(['open', 0.45], ['slice', 0.75]);
    if (event.completesSeason) seq.push(['insert', 0.6], ['close', 0.3], ['hold', 0.5]);
    else seq.push(['hold', 0.25], ['close', 0.35]);
  } else {
    seq.push(['hold', 0.6]);
  }
  seq.push(['fly', 1.15]);

  const timeline: Timeline = {};
  let t = 0;
  for (const [name, dur] of seq) {
    timeline[name] = { start: t, dur };
    t += dur;
  }
  return timeline;
}

const phaseProgress = (tl: Timeline, name: PhaseName, elapsed: number) => {
  const ph = tl[name];
  return ph ? clamp01((elapsed - ph.start) / ph.dur) : 0;
};

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false } as const;

function buildSparkleGeometry(): BufferGeometry {
  const seeds = new Float32Array(SPARKLE_COUNT * 4);
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    seeds[i * 4] = Math.random() * 2 - 1;
    seeds[i * 4 + 1] = Math.random() * 2 - 1;
    seeds[i * 4 + 2] = Math.random() * 2 - 1;
    seeds[i * 4 + 3] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(SPARKLE_COUNT * 3), 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
  return g;
}

// ------------------------------------------------------------------ Public component
/**
 * Owns the "Hero" half of the Hero Swap pattern: the head of the hero queue is rendered
 * as a standalone high-fidelity object in the center of the screen, bathed in its own
 * sunbeam, then flown to its shelf slot and unmounted as `completeHero` hands it to
 * the shelf's InstancedMesh.
 */
export default function HeroItemSpawner() {
  const event = usePalaceStore(selectActiveHero);
  // The light is permanent (intensity 0 when idle): toggling light count recompiles every shader.
  const light = useRef<PointLight>(null);
  return (
    <>
      <pointLight ref={light} intensity={0} distance={3.5} decay={2} />
      {event && <Hero key={event.id} event={event} light={light} />}
    </>
  );
}

// ------------------------------------------------------------------ Hero
interface FlightPlan {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
  q0: Quaternion;
  q1: Quaternion;
  heightScale: number;
}

function Hero({ event, light }: { event: HeroEvent; light: MutableRefObject<PointLight | null> }) {
  // Snapshot at mount: later store writes (queued episodes) must not alter this hero.
  const item = useMemo<PalaceItem | undefined>(() => usePalaceStore.getState().items[event.itemId], [event.itemId]);
  const completeHero = usePalaceStore((s) => s.completeHero);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);

  const category = item?.category ?? 'movies';
  const spec = CATEGORY_SPECS[category];
  const [t, h, d] = spec.size;
  const isSeries = category === 'series';
  const timeline = useMemo(() => buildTimeline(event), [event]);

  // ---- Scene-graph refs (mutated in useFrame, never through React state)
  const root = useRef<Group>(null);
  const content = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const disc = useRef<Group>(null);
  const newSlice = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const sparkles = useRef<Points>(null);
  const anim = useRef({ elapsed: 0, done: false, scale: 1, flight: null as FlightPlan | null });

  // ---- GPU resources owned by this hero
  const res = useMemo(() => {
    const color = new Color(item ? getItemColor(item) : '#FFFFFF');
    const accent = new Color(spec.accent);
    const sun = new Color(SUNLIGHT);
    const size = Math.max(h, d);
    const scanPlane = new Plane(new Vector3(0, -1, 0), 1e4);
    const body = new MeshStandardMaterial({
      color,
      roughness: BODY_ROUGHNESS[item?.category ?? 'movies'],
      metalness: 0,
      emissive: sun.clone().lerp(accent, 0.35),
      emissiveIntensity: 0,
      clippingPlanes: [scanPlane],
    });
    const detail = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, clippingPlanes: [scanPlane] });
    const discMat = new MeshStandardMaterial({ color: '#F4F1FA', roughness: 0.2, metalness: 0.25 });
    const sliceMat = discMat.clone();
    sliceMat.emissive = accent.clone();
    const ghostMat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, side: DoubleSide, depthWrite: false });
    const ringMat = new MeshBasicMaterial({ color: sun, opacity: 0, side: DoubleSide, ...additive });
    const haloMat = new ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      ...additive,
      uniforms: { uColor: { value: sun }, uAccent: { value: accent }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    const beamMat = new ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      side: DoubleSide,
      ...additive,
      uniforms: { uColor: { value: sun }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    const sparkleMat = new ShaderMaterial({
      vertexShader: sparkleVertex,
      fragmentShader: sparkleFragment,
      ...additive,
      uniforms: {
        uColor: { value: new Color('#FFF6E0') },
        uAccent: { value: accent },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uRadius: { value: size * 0.95 },
        uSize: { value: 0.1 },
        uPixelRatio: { value: 1 },
      },
    });
    // Light pours down from above the hero: narrow at the top, wide around it.
    const beamGeo = new CylinderGeometry(size * 0.3, size * 0.95, size * 4, 40, 1, true);
    beamGeo.translate(0, size * 2 - size * 0.55, 0);
    const haloGeo = new PlaneGeometry(size * 3.2, size * 3.2);
    const ringGeo = new RingGeometry(size * 0.55, size * 0.6, 64);
    const sparkleGeo = buildSparkleGeometry();
    return {
      accent, scanPlane, body, detail, discMat, sliceMat, ghostMat, ringMat, haloMat, beamMat, sparkleMat,
      beamGeo, haloGeo, ringGeo, sparkleGeo,
    };
  }, [item, spec.accent, h, d]);

  useEffect(() => {
    if (!item) {
      completeHero(event.id); // item vanished (e.g. reset) — nothing to animate
      return;
    }
    invalidate();
    return () => {
      Object.values(res).forEach((r) => {
        if (r && typeof (r as { dispose?: () => void }).dispose === 'function') (r as { dispose: () => void }).dispose();
      });
      if (light.current) light.current.intensity = 0;
      invalidate();
    };
  }, [item, event.id, completeHero, invalidate, res, light]);

  const _v = useMemo(() => new Vector3(), []);
  const _n = useMemo(() => new Vector3(), []);

  /** Where the hero lands: computed from the same pure layout the shelf uses. */
  const planFlight = (from: Group): FlightPlan => {
    const s = usePalaceStore.getState();
    const order = s.order[category];
    const slot = Math.max(0, order.indexOf(item!.id));
    const hs = getItemHeightScale(item!);
    const dims = getRoomDims(getRoomLevel(Object.keys(s.items).length));
    const { zone, position } = getSlotWorld(category, slot, order.length, dims, hs);
    const p3 = new Vector3(...position);
    const p0 = from.position.clone();
    const normal = new Vector3(...zone.normal);
    const lift = Math.min(0.6, p0.distanceTo(p3) * 0.2);
    return {
      p0,
      p1: p0.clone().addScaledVector(UP, lift),
      // Glide in along the shelf normal so the item slides into its slot.
      p2: p3.clone().addScaledVector(normal, 0.45).addScaledVector(UP, lift * 0.3),
      p3,
      q0: from.quaternion.clone(),
      q1: new Quaternion().setFromAxisAngle(UP, zone.rotationY),
      heightScale: hs,
    };
  };

  useFrame((_, rawDelta) => {
    const a = anim.current;
    const g = root.current;
    const c = content.current;
    if (a.done || !item || !g || !c) return;
    invalidate(); // a live hero always animates
    sceneSignals.ambientUntil = Math.max(sceneSignals.ambientUntil, Date.now() + 1500); // dust dances along

    // Hold the reward until the cinematic camera has landed on the zone.
    if (a.elapsed === 0 && sceneSignals.cameraTransitioning) return;
    // Rewards queued behind this one play faster so rapid logging never feels sluggish.
    const backlog = usePalaceStore.getState().heroQueue.length > 1 ? 1.8 : 1;
    if (a.elapsed === 0) {
      // Fit the largest face to ~30% of viewport height / ~50% of width, using the landed lens.
      const cam = camera as PerspectiveCamera;
      const visH = 2 * HERO_DISTANCE * Math.tan((cam.fov * Math.PI) / 360);
      a.scale = Math.min(visH * 0.3, visH * cam.aspect * 0.5) / Math.max(h, d);
      wakeAmbient(6);
    }
    const heroScale = a.scale;
    const dt = safeDelta(rawDelta) * backlog;
    a.elapsed += dt;
    const el = a.elapsed;
    const p = (n: PhaseName) => phaseProgress(timeline, n, el);

    const pMat = p('materialize');
    const pFly = p('fly');
    const eFly = easeInOutCubic(pFly);
    const holdEnd = timeline.fly!.start;

    // ---------------- Placement: dead center of the screen, gently bobbing in the light
    if (pFly === 0) {
      camera.getWorldDirection(_v);
      g.position.copy(camera.position).addScaledVector(_v, HERO_DISTANCE);
      _n.copy(UP).applyQuaternion(camera.quaternion);
      g.position.addScaledVector(_n, Math.sin(el * 2.2) * 0.008);
      g.quaternion.copy(camera.quaternion);
      g.scale.setScalar(heroScale * lerp(0.82, 1, easeOutBack(pMat, 1.2)));
    } else {
      if (!a.flight) a.flight = planFlight(g);
      const f = a.flight;
      cubicBezier(g.position, f.p0, f.p1, f.p2, f.p3, eFly);
      g.quaternion.slerpQuaternions(f.q0, f.q1, eFly);
      g.scale.setScalar(lerp(heroScale, 1, eFly));
      c.scale.y = lerp(1, f.heightScale, eFly);
    }
    // Cover faces the camera (-π/2), with a slow reveal turn; unwinds to spine-out (0) in flight.
    const facing = -Math.PI / 2 - 0.8 * (1 - easeOutCubic(pMat)) + Math.sin(el * 1.3) * 0.06 * (1 - eFly);
    c.rotation.y = lerp(facing, 0, eFly);
    g.updateMatrixWorld();
    // Keep the depth of field locked on the hero while it is on stage and in flight.
    sceneSignals.focusPoint.copy(g.position);

    // ---------------- Materialization: light-scan reveal + halo + sunbeam + sparkles
    const scanY = lerp(-h / 2 - 0.01, h / 2 + 0.01, easeInOutCubic(pMat));
    if (pMat < 1) {
      _v.set(0, scanY, 0);
      g.localToWorld(_v);
      _n.copy(UP).applyQuaternion(g.quaternion).negate();
      res.scanPlane.setFromNormalAndCoplanarPoint(_n, _v); // keeps everything below the scan line
    } else {
      res.scanPlane.set(UP.clone().negate(), 1e4); // fully revealed
    }
    if (ring.current) {
      ring.current.position.y = scanY;
      ring.current.visible = pMat > 0 && pMat < 1;
      res.ringMat.opacity = Math.sin(Math.PI * pMat) * 0.9;
    }

    const fxIn = easeOutCubic(clamp01(pMat * 2.5));
    const fxOut = 1 - clamp01((el - timeline.materialize!.dur) / Math.max(0.3, holdEnd - timeline.materialize!.dur + 0.4));
    const fx = fxIn * (0.35 + 0.65 * fxOut) * (1 - eFly);

    res.haloMat.uniforms.uOpacity.value = fx * 0.9;
    res.haloMat.uniforms.uTime.value = el;
    res.beamMat.uniforms.uOpacity.value = fx;
    res.beamMat.uniforms.uTime.value = el;
    if (halo.current) halo.current.visible = fx > 0.002;
    if (beam.current) beam.current.visible = fx > 0.002;

    const sp = clamp01(el / (holdEnd + 0.2));
    res.sparkleMat.uniforms.uProgress.value = sp;
    res.sparkleMat.uniforms.uTime.value = el;
    res.sparkleMat.uniforms.uPixelRatio.value = dpr;
    // Point size is authored in hero-local units; convert to screen space for the current scale.
    res.sparkleMat.uniforms.uSize.value = 70 * Math.max(h, d) * g.scale.x;
    if (sparkles.current) sparkles.current.visible = sp < 1;

    // Season completion: a flash when the case snaps shut.
    const closePh = timeline.close;
    const closeEnd = closePh ? closePh.start + closePh.dur : Infinity;
    const flash =
      event.kind === 'episode' && event.completesSeason && el >= closeEnd ? Math.max(0, 1 - (el - closeEnd) / 0.45) : 0;

    res.body.emissiveIntensity = 1.1 * (1 - easeOutCubic(pMat)) + flash * 0.8 + 0.08 * fx;
    if (light.current) {
      // Key light from above/in front, like the sun catching the object.
      camera.getWorldDirection(_v);
      light.current.position.copy(g.position).addScaledVector(_v, -0.45).addScaledVector(UP, 0.45);
      light.current.color.set(SUNLIGHT).lerp(res.accent, 0.25);
      light.current.intensity = (1.6 * fx + 2.2 * flash) * (1 - eFly);
    }

    // ---------------- TV Series: box opening, slice creation, disc insertion
    if (isSeries && event.kind === 'episode') {
      const pOpen = p('open');
      const pSlice = p('slice');
      const pInsert = p('insert');
      const pClose = p('close');

      if (lid.current) lid.current.rotation.y = -LID_OPEN_ANGLE * easeOutCubic(pOpen) * (1 - easeInCubic(pClose));

      if (disc.current) {
        const dg = disc.current;
        const shrink = event.completesSeason ? 0 : easeInCubic(pClose);
        const s = easeOutBack(pOpen) * (1 - shrink);
        dg.visible = s > 0.001;
        dg.scale.setScalar(Math.max(0.0001, s));
        // Hover above the open case, then slide into the tray.
        const eIns = easeInOutCubic(pInsert);
        dg.position.set(0, lerp(h / 2 + DISC.outer + 0.018, 0, eIns), lerp(0.03, 0.003, eIns));
        dg.rotation.z = 0.9 * (1 - easeOutCubic(pSlice)); // settles as the slice lands
      }
      if (newSlice.current) {
        const ns = newSlice.current;
        const mid = ((event.episodeIndex + 0.5) / event.episodeCount) * Math.PI * 2;
        const out = (1 - easeOutCubic(pSlice)) * 0.05;
        ns.visible = pSlice > 0;
        ns.position.set(Math.cos(mid) * out, Math.sin(mid) * out, (1 - pSlice) * 0.02);
        ns.scale.setScalar(Math.max(0.0001, lerp(0.4, 1, easeOutBack(pSlice))));
        res.sliceMat.emissiveIntensity = 2.4 * (1 - pSlice) + 0.15;
      }
    }

    // ---------------- Hero Swap commit
    if (pFly >= 1) {
      a.done = true;
      if (light.current) light.current.intensity = 0;
      completeHero(event.id); // unmounts this hero; shelf writes the instance in the same commit
    }
  });

  if (!item) return null;

  const episodeEvent = event.kind === 'episode' ? event : null;

  return (
    <group ref={root} scale={0.0001}>
      {/* FX sit behind / around the object in camera space (root copies the camera's rotation). */}
      <mesh ref={halo} geometry={res.haloGeo} material={res.haloMat} position-z={-Math.max(t, d) * 1.2} visible={false} renderOrder={4} />
      <mesh ref={beam} geometry={res.beamGeo} material={res.beamMat} visible={false} renderOrder={4} />
      <points ref={sparkles} geometry={res.sparkleGeo} material={res.sparkleMat} frustumCulled={false} renderOrder={5} />

      <group ref={content}>
        <ItemModel category={category} body={res.body} detail={res.detail} lidRef={isSeries ? lid : undefined} />
      </group>

      {/* Season disc, built from pie slices in the camera-facing plane */}
      {episodeEvent && (
        <group ref={disc} visible={false}>
          <mesh material={res.ghostMat}>
            <ringGeometry args={[DISC.inner, DISC.outer, 64]} />
          </mesh>
          {Array.from({ length: episodeEvent.episodeIndex }, (_, i) => (
            <mesh
              key={i}
              geometry={getDiscSliceGeometry(i, episodeEvent.episodeCount)}
              material={res.discMat}
              dispose={null}
            />
          ))}
          <mesh
            ref={newSlice}
            visible={false}
            geometry={getDiscSliceGeometry(episodeEvent.episodeIndex, episodeEvent.episodeCount)}
            material={res.sliceMat}
            dispose={null}
          />
        </group>
      )}

      {/* Scan ring sweeping up the object as it materializes */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} geometry={res.ringGeo} material={res.ringMat} visible={false} />
    </group>
  );
}
