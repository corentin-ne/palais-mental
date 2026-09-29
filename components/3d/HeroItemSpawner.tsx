import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { HeroEvent, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemScale } from '@/lib/itemVisuals';
import { BODY_ROUGHNESS, DISC, getDiscSliceGeometry } from '@/lib/itemGeometry';
import { getRoomDims, getRoomLevel, getSlotWorld } from '@/lib/palaceLayout';
import CoverFace from './CoverFace';
import ItemModel from './ItemModel';
import {
  clamp01,
  cubicBezier,
  easeInCubic,
  easeInOutCubic,
  easeInOutQuint,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  easeOutElastic,
  easeOutQuint,
  lerp,
  safeDelta,
} from '@/lib/easing';
import { ARRIVAL } from '@/config/motion';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import {
  ImplodeUniforms,
  applyImplode,
  haloFragment,
  haloVertex,
  pearlFragment,
  pearlVertex,
  shockFragment,
  shockVertex,
  sparkleFragment,
  sparkleVertex,
} from '@/shaders/heroFx';
import { selectActiveHero, usePalaceStore } from '@/store/usePalaceStore';

// ------------------------------------------------------------------ Tuning
const HERO_DISTANCE = ARRIVAL.distance;
const LID_OPEN_ANGLE = ARRIVAL.lidAngle;
const SPARKLE_COUNT = ARRIVAL.sparkles;
const START_AT_CAMERA_PROGRESS = ARRIVAL.startAtCameraProgress;
const SUNLIGHT = ARRIVAL.sunlight;
const UP = new Vector3(0, 1, 0);

type PhaseName = 'gather' | 'burst' | 'open' | 'slice' | 'insert' | 'close' | 'hold' | 'fly';
type Timeline = Partial<Record<PhaseName, { start: number; dur: number }>>;

/**
 * Item:     gather → burst → hold → fly
 * Episode:  gather → burst → open → slice → hold → close (disc dissolves)          → fly
 * Season:   gather → burst → open → slice → insert → close (snap + flash) → hold → fly
 *
 * gather: light spirals into a small pearl. burst: the pearl collapses and the object
 * unwinds out of it with an elastic pop and a ring of light.
 */
function buildTimeline(event: HeroEvent): Timeline {
  const d =
    event.kind === 'item' ? ARRIVAL.item : event.completesSeason ? ARRIVAL.season : ARRIVAL.episode;
  const order: PhaseName[] =
    event.kind === 'item'
      ? ['gather', 'burst', 'hold', 'fly']
      : event.completesSeason
        ? ['gather', 'burst', 'open', 'slice', 'insert', 'close', 'hold', 'fly']
        : ['gather', 'burst', 'open', 'slice', 'hold', 'close', 'fly'];
  const seq = order.map((name) => [name, (d as Partial<Record<PhaseName, number>>)[name] ?? 0] as const);

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
 * as a standalone object in the center of the screen, born from a pearl of light, then
 * flown to its slot and unmounted as `completeHero` hands it to the furniture's
 * InstancedMesh.
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
  scale: [number, number, number];
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
  const cover = useRef<Mesh>(null);
  const lid = useRef<Group>(null);
  const disc = useRef<Group>(null);
  const newSlice = useRef<Mesh>(null);
  const pearl = useRef<Mesh>(null);
  const shock = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const sparkles = useRef<Points>(null);
  const anim = useRef({ elapsed: 0, started: false, done: false, scale: 1, flight: null as FlightPlan | null, kick: new Vector3() });

  // ---- GPU resources owned by this hero
  const res = useMemo(() => {
    const color = new Color(item ? getItemColor(item) : '#FFFFFF');
    const accent = new Color(spec.accent);
    const sun = new Color(SUNLIGHT);
    const size = Math.max(h, d);
    const implode: ImplodeUniforms = { uImplode: { value: 1 }, uRadius: { value: 0.5 * Math.hypot(t, h, d) } };
    const body = new MeshStandardMaterial({
      color,
      roughness: BODY_ROUGHNESS[item?.category ?? 'movies'],
      metalness: 0,
      emissive: sun.clone().lerp(accent, 0.35),
      emissiveIntensity: 0,
    });
    const detail = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38 });
    applyImplode(body, implode);
    applyImplode(detail, implode);
    const discMat = new MeshStandardMaterial({ color: '#F4F1FA', roughness: 0.2, metalness: 0.25 });
    const sliceMat = discMat.clone();
    sliceMat.emissive = accent.clone();
    const ghostMat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, side: DoubleSide, depthWrite: false });
    const haloMat = new ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      ...additive,
      uniforms: { uColor: { value: sun }, uAccent: { value: accent }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    const pearlMat = new ShaderMaterial({
      vertexShader: pearlVertex,
      fragmentShader: pearlFragment,
      ...additive,
      uniforms: { uColor: { value: sun }, uAccent: { value: accent }, uOpacity: { value: 0 } },
    });
    const shockMat = new ShaderMaterial({
      vertexShader: shockVertex,
      fragmentShader: shockFragment,
      side: DoubleSide,
      ...additive,
      uniforms: { uColor: { value: sun.clone().lerp(accent, 0.4) }, uProgress: { value: 0 } },
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
    const haloGeo = new PlaneGeometry(size * 3.2, size * 3.2);
    const pearlGeo = new SphereGeometry(size * 0.16, 32, 20);
    const shockGeo = new PlaneGeometry(size * 3, size * 3);
    const sparkleGeo = buildSparkleGeometry();
    return {
      accent, implode, body, detail, discMat, sliceMat, ghostMat, haloMat, pearlMat, shockMat, sparkleMat,
      haloGeo, pearlGeo, shockGeo, sparkleGeo,
    };
  }, [item, spec.accent, t, h, d]);

  useEffect(() => {
    if (!item) {
      completeHero(event.id); // item vanished (e.g. reset) — nothing to animate
      return;
    }
    invalidate();
    const a = anim.current;
    return () => {
      camera.position.sub(a.kick); // never leave the camera displaced
      a.kick.set(0, 0, 0);
      Object.values(res).forEach((r) => {
        if (r && typeof (r as { dispose?: () => void }).dispose === 'function') (r as { dispose: () => void }).dispose();
      });
      if (light.current) light.current.intensity = 0;
      invalidate();
    };
  }, [item, event.id, completeHero, invalidate, res, light, camera]);

  const _v = useMemo(() => new Vector3(), []);
  const _n = useMemo(() => new Vector3(), []);

  /** Where the hero lands: computed from the same pure layout the shelf uses. */
  const planFlight = (from: Group): FlightPlan => {
    const s = usePalaceStore.getState();
    const order = s.order[category];
    const scale = getItemScale(s.items[item!.id] ?? item!);
    const dims = getRoomDims(getRoomLevel(Object.keys(s.items).length));
    const { zone, position } = getSlotWorld(category, item!.id, s, dims);
    const p3 = new Vector3(...position);
    const p0 = from.position.clone();
    const normal = new Vector3(...zone.normal);
    const lift = Math.min(0.6, p0.distanceTo(p3) * 0.2);
    // A short pull back toward the viewer before the dash to the slot.
    camera.getWorldDirection(_n);
    return {
      p0,
      p1: p0.clone().addScaledVector(_n, -0.3).addScaledVector(UP, lift),
      // Glide in along the shelf normal so the item slides into its slot.
      p2: p3.clone().addScaledVector(normal, 0.45).addScaledVector(UP, lift * 0.3),
      p3,
      q0: from.quaternion.clone(),
      q1: new Quaternion().setFromAxisAngle(UP, zone.rotationY),
      scale,
    };
  };

  useFrame((_, rawDelta) => {
    const a = anim.current;
    const g = root.current;
    const c = content.current;
    if (a.done || !item || !g || !c) return;
    invalidate(); // a live hero always animates
    sceneSignals.ambientUntil = Math.max(sceneSignals.ambientUntil, Date.now() + 1500); // dust dances along

    if (!a.started) {
      if (sceneSignals.cameraTransitioning && sceneSignals.cameraProgress < START_AT_CAMERA_PROGRESS) return;
      a.started = true;
      // Fit the largest face to ~30% of viewport height / ~50% of width, using the landing lens.
      const cam = camera as PerspectiveCamera;
      const visH = 2 * HERO_DISTANCE * Math.tan((cam.fov * Math.PI) / 360);
      a.scale = Math.min(visH * 0.3, visH * cam.aspect * 0.5) / Math.max(h, d);
      wakeAmbient(6);
    }
    // Heroes queued behind this one play faster so rapid additions don't pile up.
    const backlog = usePalaceStore.getState().heroQueue.length > 1 ? ARRIVAL.backlogSpeed : 1;
    const heroScale = a.scale;
    const dt = safeDelta(rawDelta) * backlog;
    a.elapsed += dt;
    const el = a.elapsed;
    const p = (n: PhaseName) => phaseProgress(timeline, n, el);

    const pGather = p('gather');
    const pBurst = p('burst');
    const born = pBurst > 0;
    const pFly = p('fly');
    const eFly = easeInOutQuint(pFly);

    camera.position.sub(a.kick);
    a.kick.set(0, 0, 0);

    // ---------------- Placement: center of the screen, bobbing slightly
    if (pFly === 0) {
      camera.getWorldDirection(_v);
      g.position.copy(camera.position).addScaledVector(_v, HERO_DISTANCE);
      _n.copy(UP).applyQuaternion(camera.quaternion);
      g.position.addScaledVector(_n, Math.sin(el * 2.2) * 0.008);
      g.quaternion.copy(camera.quaternion);
      g.scale.setScalar(heroScale);
      const pop = easeOutElastic(Math.min(1, pBurst * 1.1));
      c.scale.setScalar(Math.max(1e-4, pop));
    } else {
      if (!a.flight) a.flight = planFlight(g);
      const f = a.flight;
      cubicBezier(g.position, f.p0, f.p1, f.p2, f.p3, eFly);
      g.quaternion.slerpQuaternions(f.q0, f.q1, eFly);
      g.scale.setScalar(lerp(heroScale, 1, eFly));
      c.scale.set(lerp(1, f.scale[0], eFly), lerp(1, f.scale[1], eFly), lerp(1, f.scale[2], eFly));
    }
    c.visible = born;
    // Artwork settles onto the face once the twist has unwound, and fades as the object flies home spine-out.
    if (cover.current) {
      const m = cover.current.material as MeshStandardMaterial;
      m.opacity = clamp01((pBurst - 0.55) / 0.3) * (1 - clamp01(pFly * 1.6));
      cover.current.visible = m.opacity > 0.01;
    }
    // The twist unwinds with a snap as the object leaves the pearl.
    res.implode.uImplode.value = born ? 1 - easeOutQuint(pBurst) : 1;
    // Cover faces the camera (-π/2) after a spin-in; unwinds to spine-out (0) in flight.
    const facing = -Math.PI / 2 + 1.2 * (1 - easeOutCubic(pBurst)) + Math.sin(el * 1.3) * 0.05 * (1 - eFly);
    c.rotation.y = lerp(facing, 0, eFly);
    g.updateMatrixWorld();
    sceneSignals.focusPoint.copy(g.position);

    // ---------------- Birth: light gathers into a pearl, the pearl collapses, the object bursts out
    const collapse = born ? 1 - easeOutCubic(clamp01(pBurst * 4)) : 1;
    if (pearl.current) {
      const grow = easeOutBack(clamp01(pGather * 1.4), 2.2) * (1 + 0.12 * Math.sin(el * 18) * pGather);
      pearl.current.scale.setScalar(Math.max(1e-4, grow * collapse));
      pearl.current.visible = pGather > 0 && collapse > 0.01;
      res.pearlMat.uniforms.uOpacity.value = 0.6 + 0.8 * easeInQuad(pGather);
    }
    const flash = born ? Math.exp(-pBurst * 6) : easeInQuad(pGather) * 0.45;
    const afterglow = born ? 0.35 * (1 - clamp01((el - timeline.burst!.start - timeline.burst!.dur) / 0.6)) : 0;
    const fx = Math.max(flash, afterglow) * (1 - eFly);
    res.haloMat.uniforms.uOpacity.value = fx;
    res.haloMat.uniforms.uTime.value = el;
    if (halo.current) halo.current.visible = fx > 0.002;

    if (shock.current) {
      shock.current.visible = born && pBurst < 1;
      res.shockMat.uniforms.uProgress.value = easeOutCubic(pBurst);
    }

    // Sparkles spiral in during the gather and are thrown out by the burst.
    const sp = born ? 0.55 + 0.45 * pBurst : 0.55 * pGather;
    res.sparkleMat.uniforms.uProgress.value = sp;
    res.sparkleMat.uniforms.uTime.value = el;
    res.sparkleMat.uniforms.uPixelRatio.value = dpr;
    res.sparkleMat.uniforms.uSize.value = 70 * Math.max(h, d) * g.scale.x;
    if (sparkles.current) sparkles.current.visible = sp < 1;

    // A tiny kick of the camera at the moment of birth.
    if (born && pBurst < 0.3) {
      const k = 0.008 * Math.exp(-pBurst * 14);
      a.kick.set(Math.sin(el * 91) * k, Math.cos(el * 77) * k, 0).applyQuaternion(camera.quaternion);
      camera.position.add(a.kick);
    }

    // Season completion: a flash when the case snaps shut.
    const closePh = timeline.close;
    const closeEnd = closePh ? closePh.start + closePh.dur : Infinity;
    const snap =
      event.kind === 'episode' && event.completesSeason && el >= closeEnd ? Math.max(0, 1 - (el - closeEnd) / 0.45) : 0;

    res.body.emissiveIntensity = (born ? 1.4 * Math.pow(1 - pBurst, 2) : 0) + snap * 0.8;
    if (light.current) {
      // Key light from above/in front, like the sun catching the object.
      camera.getWorldDirection(_v);
      light.current.position.copy(g.position).addScaledVector(_v, -0.45).addScaledVector(UP, 0.45);
      light.current.color.set(SUNLIGHT).lerp(res.accent, 0.25);
      light.current.intensity = (2.4 * flash + 0.8 * afterglow + 2.2 * snap) * (1 - eFly);
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
      sceneSignals.justLanded.add(item.id);
      completeHero(event.id); // unmounts this hero; the furniture shows the instance in the same commit
    }
  });

  if (!item) return null;

  const episodeEvent = event.kind === 'episode' ? event : null;

  return (
    <group ref={root} scale={0.0001}>
      {/* FX sit behind / around the object in camera space (root copies the camera's rotation). */}
      <mesh ref={halo} geometry={res.haloGeo} material={res.haloMat} position-z={-Math.max(t, d) * 1.2} visible={false} renderOrder={4} />
      <mesh ref={shock} geometry={res.shockGeo} material={res.shockMat} visible={false} renderOrder={4} />
      <mesh ref={pearl} geometry={res.pearlGeo} material={res.pearlMat} visible={false} renderOrder={5} />
      <points ref={sparkles} geometry={res.sparkleGeo} material={res.sparkleMat} frustumCulled={false} renderOrder={5} />

      <group ref={content} visible={false}>
        <ItemModel category={category} body={res.body} detail={res.detail} lidRef={isSeries ? lid : undefined} />
        {event.kind === 'item' && <CoverFace ref={cover} url={item.coverUrl} category={category} />}
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
    </group>
  );
}
