import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Camera, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Texture, Vector3 } from 'three';

import { OCEAN } from '@/config/ocean';
import { easeOutBack, safeDelta } from '@/lib/easing';
import { getItemColor } from '@/lib/itemVisuals';
import { impact, ripple } from '@/lib/oceanSignals';
import { loadCoverTexture } from '@/lib/textureCache';
import { HeroEvent } from '@/lib/types';
import { DROP_FRAGMENT, DROP_VERTEX } from '@/shaders/ocean';
import { selectActiveHero, usePalaceStore } from '@/store/usePalaceStore';
import { linearRgb, shared } from './uniforms';

const D = OCEAN.drop;
const SPRAY = 22;

interface Particle {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  r: number;
  alive: boolean;
  kind: 'spray' | 'jet';
}

const ndc = new Vector3();

/** Anywhere on the water you can see right now: a random point of the lower screen, cast onto the water. */
function landingSpot(camera: Camera): { x: number; z: number } {
  for (let i = 0; i < 12; i++) {
    ndc.set(-0.75 + Math.random() * 1.5, -0.75 + Math.random() * 0.8, 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    if (dir.y > -0.05) continue;
    const t = -camera.position.y / dir.y;
    const x = camera.position.x + dir.x * t;
    const z = camera.position.z + dir.z * t;
    if (Math.hypot(x, z) <= D.maxDistance) return { x, z };
  }
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * 1.5;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

function dropMaterial(tint: [number, number, number], opacity: number) {
  return new ShaderMaterial({
    vertexShader: DROP_VERTEX,
    fragmentShader: DROP_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: { ...shared, uTint: { value: new Vector3(...tint) }, uOpacity: { value: opacity }, uStretch: { value: 1 } },
  });
}

/**
 * Every memory you log arrives as a drop: it gathers in the air somewhere over the water you
 * can see, holding its cover, falls, and melts in with a splash, a jet and a bloom of its colour.
 * Consumes the store's hero queue one event at a time, like the room's hero did.
 */
export default function DropSpawner() {
  const event = usePalaceStore(selectActiveHero);
  const completeHero = usePalaceStore((s) => s.completeHero);
  const camera = useThree((s) => s.camera);

  const res = useMemo(() => {
    const sphere = new SphereGeometry(1, 40, 28);
    const small = new SphereGeometry(1, 12, 8);
    const group = new Group();
    const drop = new Mesh(sphere, dropMaterial([1, 1, 1], 0.82));
    drop.renderOrder = 2;
    const coverMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const cover = new Mesh(new PlaneGeometry(1, 1), coverMat);
    cover.renderOrder = 1;
    group.add(cover, drop);
    group.visible = false;
    const particles: Particle[] = Array.from({ length: SPRAY + 1 }, (_, i) => {
      const mesh = new Mesh(small, dropMaterial([1, 1, 1], 0.9));
      mesh.visible = false;
      mesh.renderOrder = 2;
      return { mesh, pos: new Vector3(), vel: new Vector3(), r: 0, alive: false, kind: i === SPRAY ? 'jet' : 'spray' };
    });
    return { sphere, small, group, drop, cover, coverMat, particles };
  }, []);

  useEffect(
    () => () => {
      res.sphere.dispose();
      res.small.dispose();
      res.cover.geometry.dispose();
      res.coverMat.dispose();
      (res.drop.material as ShaderMaterial).dispose();
      res.particles.forEach((p) => (p.mesh.material as ShaderMaterial).dispose());
    },
    [res],
  );

  const live = useRef<{
    event: HeroEvent;
    pos: Vector3;
    vy: number;
    age: number;
    r: number;
    color: [number, number, number];
    phase: 'form' | 'fall' | 'melt';
    melt: number;
  } | null>(null);

  // A new head of the queue: place the drop in front of wherever you are looking.
  useEffect(() => {
    if (!event) return;
    const item = usePalaceStore.getState().items[event.itemId];
    if (!item) {
      completeHero(event.id);
      return;
    }
    const spot = landingSpot(camera);
    const pos = new Vector3(spot.x, D.formHeight, spot.z);
    const color = linearRgb(getItemColor(item));
    const r = event.kind === 'episode' ? D.episodeRadius : D.radius;
    live.current = { event, pos, vy: 0, age: 0, r, color, phase: 'form', melt: 0 };
    (res.drop.material as ShaderMaterial).uniforms.uTint.value.set(...color);
    res.coverMat.map = null;
    res.coverMat.opacity = 0;
    res.coverMat.needsUpdate = true;
    let alive = true;
    if (item.coverUrl && event.kind === 'item') {
      loadCoverTexture(item.coverUrl).then((tex: Texture | null) => {
        if (!alive || !tex || live.current?.event.id !== event.id) return;
        res.coverMat.map = tex;
        res.coverMat.needsUpdate = true;
      });
    }
    return () => {
      alive = false;
    };
  }, [event, camera, completeHero, res]);

  const splash = (x: number, z: number, color: [number, number, number], power: number) => {
    let n = 0;
    for (const p of res.particles) {
      if (p.kind !== 'spray' || p.alive || n >= Math.round(SPRAY * power)) continue;
      const a = (n / (SPRAY * power)) * Math.PI * 2 + Math.random() * 0.4;
      const hs = (0.45 + Math.random() * 0.7) * power;
      p.pos.set(x + Math.cos(a) * 0.07, 0.02, z + Math.sin(a) * 0.07);
      p.vel.set(Math.cos(a) * hs, (1 + Math.random() * 1.2) * power, Math.sin(a) * hs);
      p.r = (0.012 + Math.random() * 0.02) * Math.sqrt(power);
      p.alive = true;
      (p.mesh.material as ShaderMaterial).uniforms.uTint.value.set(...color);
      n++;
    }
  };

  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const d = live.current;
    const { group, drop, cover } = res;

    if (d) {
      d.age += dt;
      let stretch = 1;
      let scale = d.r;
      if (d.phase === 'form') {
        const k = Math.min(d.age / D.formDuration, 1);
        scale = d.r * easeOutBack(k, 2.2);
        stretch = 1 + Math.sin(k * 14) * 0.12 * (1 - k) + k * 0.1;
        if (k >= 1) d.phase = 'fall';
      } else if (d.phase === 'fall') {
        d.vy -= D.gravity * dt;
        d.pos.y += d.vy * dt;
        stretch = 1 + Math.min(-d.vy * 0.07, 0.55);
        if (d.pos.y - d.r * 0.3 <= 0) {
          d.phase = 'melt';
          d.melt = 0;
          ripple(d.pos.x, d.pos.z, d.r * 2.6, -0.06 * (d.r / D.radius));
          impact(d.pos.x, d.pos.z, d.color, 0.35);
          splash(d.pos.x, d.pos.z, d.color, d.event.kind === 'episode' ? 0.6 : 1);
          const jet = res.particles[SPRAY];
          jet.pos.set(d.pos.x, 0.02, d.pos.z);
          jet.vel.set(0, d.event.kind === 'episode' ? 1.8 : 2.5, 0);
          jet.r = d.r * 0.45;
          jet.alive = true;
          (jet.mesh.material as ShaderMaterial).uniforms.uTint.value.set(...d.color);
        }
      } else {
        d.melt += dt;
        d.pos.y -= dt * 0.6;
        scale = d.r * Math.max(0, 1 - d.melt * 4);
        if (d.melt > 0.8) {
          live.current = null;
          completeHero(d.event.id);
        }
      }
      group.visible = scale > 0.001;
      shared.uDrop.value.set(d.pos.x, d.pos.y, d.pos.z, d.phase === 'melt' ? 0 : scale / d.r);
      shared.uDropColor.value.set(...d.color);
      group.position.copy(d.pos);
      drop.scale.setScalar(Math.max(scale, 1e-4));
      (drop.material as ShaderMaterial).uniforms.uStretch.value = stretch;
      // The cover floats inside the drop, turned toward you.
      cover.quaternion.copy(camera.quaternion);
      cover.scale.setScalar(scale * 1.05);
      const fade = d.phase === 'melt' ? 0 : Math.min(d.age / D.formDuration, 1);
      res.coverMat.opacity = res.coverMat.map ? fade : 0;
    } else {
      group.visible = false;
      shared.uDrop.value.w = 0;
    }

    for (const p of res.particles) {
      if (!p.alive) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= D.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      p.mesh.scale.setScalar(p.r);
      (p.mesh.material as ShaderMaterial).uniforms.uStretch.value = 1 + Math.min(Math.abs(p.vel.y) * 0.1, 0.8);
      if (p.pos.y - p.r * 0.3 <= 0 && p.vel.y < 0) {
        p.alive = false;
        p.mesh.visible = false;
        if (p.kind === 'jet') {
          ripple(p.pos.x, p.pos.z, 0.12, -0.022);
          splash(p.pos.x, p.pos.z, [1, 1, 1], 0.4);
        } else ripple(p.pos.x, p.pos.z, 0.05, -0.006 * (p.r / 0.02));
      }
    }
  });

  return (
    <>
      <primitive object={res.group} />
      {res.particles.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
    </>
  );
}
