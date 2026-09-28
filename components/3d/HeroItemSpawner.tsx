import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  MeshStandardMaterial,
  Plane,
  PointLight,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';

import { HeroEvent, PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemHeightScale } from '@/lib/itemVisuals';
import { DISC, getDiscSliceGeometry, getItemGeometry } from '@/lib/itemGeometry';
import { getRoomDims, getRoomLevel, getShelfLayout, getSlotLocalPosition, getZoneTransform, zoneToWorld } from '@/lib/palaceLayout';
import { clamp01, cubicBezier, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, safeDelta } from '@/lib/easing';
import { sceneSignals } from '@/lib/sceneSignals';
import { selectActiveHero, usePalaceStore } from '@/store/usePalaceStore';

// ------------------------------------------------------------------ Tuning
const HERO_DISTANCE = 1.25; // meters in front of the camera
const LID_OPEN_ANGLE = 1.95; // ~112°
const UP = new Vector3(0, 1, 0);

type PhaseName = 'materialize' | 'open' | 'slice' | 'insert' | 'close' | 'hold' | 'fly';
type Timeline = Partial<Record<PhaseName, { start: number; dur: number }>>;

/**
 * Item:     materialize → hold → fly
 * Episode:  materialize → open → slice → hold → close (disc dissolves)          → fly
 * Season:   materialize → open → slice → insert → close (snap + flash) → hold → fly
 */
function buildTimeline(event: HeroEvent): Timeline {
  const seq: [PhaseName, number][] = [['materialize', 0.95]];
  if (event.kind === 'episode') {
    seq.push(['open', 0.45], ['slice', 0.75]);
    if (event.completesSeason) seq.push(['insert', 0.6], ['close', 0.3], ['hold', 0.45]);
    else seq.push(['hold', 0.25], ['close', 0.35]);
  } else {
    seq.push(['hold', 0.55]);
  }
  seq.push(['fly', 1.05]);

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

// ------------------------------------------------------------------ Spawn beam shader
const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vN, vV)), 2.0);
    float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    float scan = 0.7 + 0.3 * sin(vUv.y * 90.0 - uTime * 7.0);
    float a = (0.12 + fresnel) * fade * scan * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// ------------------------------------------------------------------ Public component
/**
 * Owns the "Hero" half of the Hero Swap pattern: the head of the hero queue is rendered
 * as a standalone high-fidelity object in front of the camera, animated, flown to its
 * shelf slot, then unmounted as `completeHero` hands it to the shelf's InstancedMesh.
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
  const beam = useRef<Mesh>(null);
  const anim = useRef({ elapsed: 0, done: false, scale: 1, flight: null as FlightPlan | null });

  // ---- GPU resources owned by this hero
  const res = useMemo(() => {
    const color = new Color(item ? getItemColor(item) : '#FFFFFF');
    const accent = new Color(spec.accent);
    const scanPlane = new Plane(new Vector3(0, -1, 0), 1e4);
    const body = new MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.05,
      emissive: accent,
      emissiveIntensity: 0,
      clippingPlanes: [scanPlane],
    });
    const discMat = new MeshStandardMaterial({ color: '#E6E9F2', roughness: 0.18, metalness: 0.35 });
    const sliceMat = discMat.clone();
    sliceMat.emissive = accent.clone();
    const ghostMat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.14, side: DoubleSide, depthWrite: false });
    const ringMat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
    const beamMat = new ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      uniforms: { uColor: { value: accent }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const radius = Math.max(t, d) * 0.75;
    const beamGeo = new CylinderGeometry(radius, radius, h * 1.7, 40, 1, true);
    // Series case split in two halves (tray + hinged lid); together they equal the shelf box.
    const halfGeo = new BoxGeometry(t / 2, h, d);
    return { accent, scanPlane, body, discMat, sliceMat, ghostMat, ringMat, beamMat, beamGeo, halfGeo, radius };
  }, [item, spec.accent, t, h, d]);

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
    const layout = getShelfLayout(category, order.length);
    const zone = getZoneTransform(category, getRoomDims(getRoomLevel(Object.keys(s.items).length)));
    const hs = getItemHeightScale(item!);
    const p3 = new Vector3(...zoneToWorld(zone, getSlotLocalPosition(category, slot, layout, hs)));
    const p0 = from.position.clone();
    const normal = new Vector3(...zone.normal);
    const lift = Math.min(1.2, p0.distanceTo(p3) * 0.25);
    return {
      p0,
      p1: p0.clone().addScaledVector(UP, lift * 0.6),
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

    // Hold the reward until the cinematic camera has landed on the zone.
    if (a.elapsed === 0 && sceneSignals.cameraTransitioning) return;
    // Rewards queued behind this one play faster so rapid logging never feels sluggish.
    const backlog = usePalaceStore.getState().heroQueue.length > 1 ? 1.8 : 1;
    if (a.elapsed === 0) {
      // Fit the largest face to ~30% of viewport height / ~50% of width, using the landed lens.
      const cam = camera as PerspectiveCamera;
      const visH = 2 * HERO_DISTANCE * Math.tan((cam.fov * Math.PI) / 360);
      a.scale = Math.min(visH * 0.3, visH * cam.aspect * 0.5) / Math.max(h, d);
    }
    const heroScale = a.scale;
    const dt = safeDelta(rawDelta) * backlog;
    a.elapsed += dt;
    const el = a.elapsed;
    const p = (n: PhaseName) => phaseProgress(timeline, n, el);

    const pMat = p('materialize');
    const pFly = p('fly');
    const eFly = easeInOutCubic(pFly);

    // ---------------- Placement
    if (pFly === 0) {
      camera.getWorldDirection(_v);
      g.position.copy(camera.position).addScaledVector(_v, HERO_DISTANCE);
      _n.copy(camera.up).applyQuaternion(camera.quaternion);
      g.position.addScaledVector(_n, 0.05 + Math.sin(el * 2.2) * 0.006); // gentle float
      g.quaternion.copy(camera.quaternion);
      g.scale.setScalar(heroScale * lerp(0.86, 1, easeOutCubic(pMat)));
    } else {
      if (!a.flight) a.flight = planFlight(g);
      const f = a.flight;
      cubicBezier(g.position, f.p0, f.p1, f.p2, f.p3, eFly);
      g.quaternion.slerpQuaternions(f.q0, f.q1, eFly);
      g.scale.setScalar(lerp(heroScale, 1, eFly));
      c.scale.y = lerp(1, f.heightScale, eFly);
    }
    // Cover faces the camera (-π/2), with a reveal turn; unwinds to spine-out (0) in flight.
    const facing = -Math.PI / 2 - 0.7 * (1 - easeOutCubic(pMat));
    c.rotation.y = lerp(facing, 0, eFly);
    g.updateMatrixWorld();

    // ---------------- Materialization: clip-plane scan + ring + beam + light
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
      res.ringMat.opacity = Math.sin(Math.PI * pMat) * 0.95;
    }

    const holdEnd = timeline.fly!.start;
    const beamIn = easeOutCubic(clamp01(pMat * 3));
    const beamOut = 1 - clamp01((el - timeline.materialize!.dur) / Math.max(0.3, holdEnd - timeline.materialize!.dur));
    const beamOpacity = beamIn * beamOut;
    res.beamMat.uniforms.uOpacity.value = beamOpacity;
    res.beamMat.uniforms.uTime.value = el;
    if (beam.current) beam.current.visible = beamOpacity > 0.002;

    // Season completion: a flash when the case snaps shut.
    const closePh = timeline.close;
    const closeEnd = closePh ? closePh.start + closePh.dur : Infinity;
    const flash =
      event.kind === 'episode' && event.completesSeason && el >= closeEnd ? Math.max(0, 1 - (el - closeEnd) / 0.45) : 0;

    res.body.emissiveIntensity = 1.3 * (1 - easeOutCubic(pMat)) + flash * 0.9;
    if (light.current) {
      // Key the light from above/in front so it grazes the hero instead of blowing out near faces.
      camera.getWorldDirection(_v);
      light.current.position.copy(g.position).addScaledVector(_v, -0.5).addScaledVector(UP, 0.35);
      light.current.color.copy(res.accent);
      light.current.intensity = (1.4 * beamOpacity + 2.2 * flash) * (1 - eFly);
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
        // Hover beside the open case, then slide into the tray.
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
        res.sliceMat.emissiveIntensity = 2.6 * (1 - pSlice) + 0.15;
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
      <group ref={content}>
        {isSeries ? (
          <>
            {/* Tray */}
            <mesh geometry={res.halfGeo} material={res.body} position={[-t / 4, 0, 0]} />
            {/* Lid, hinged on the spine edge (content +z) */}
            <group ref={lid} position={[0, 0, d / 2]}>
              <mesh geometry={res.halfGeo} material={res.body} position={[t / 4, 0, -d / 2]} />
            </group>
          </>
        ) : (
          <mesh geometry={getItemGeometry(category)} material={res.body} dispose={null} />
        )}
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

      {/* Spawn FX */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} material={res.ringMat} visible={false}>
        <ringGeometry args={[res.radius * 0.92, res.radius * 1.05, 64]} />
      </mesh>
      <mesh ref={beam} geometry={res.beamGeo} material={res.beamMat} visible={false} />
    </group>
  );
}
