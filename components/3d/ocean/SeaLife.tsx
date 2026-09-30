import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

import { OCEAN } from '@/config/ocean';
import { safeDelta } from '@/lib/easing';
import { impact, oceanSignals, ripple } from '@/lib/oceanSignals';
import { CREATURE_FRAGMENT, CREATURE_VERTEX, DROP_FRAGMENT, DROP_VERTEX } from '@/shaders/ocean';
import { dolphinGeometry, fishGeometry, gullBodyGeometry, gullWingGeometry } from './creatures';
import { shared } from './uniforms';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const WHITE: [number, number, number] = [1, 1, 1];
const POD = 3;
const SHOAL = 6;
const SPRAY = 48;
const REEF_FISH = 18;
/** Yellow tangs, blue tangs, clownfish orange, and a few pink wrasses. */
const REEF_COLOURS: [number[], number[]][] = [
  [[1, 0.78, 0.05], [1, 0.9, 0.4]],
  [[0.05, 0.3, 1], [0.35, 0.65, 1]],
  [[1, 0.42, 0.05], [1, 0.85, 0.7]],
  [[1, 0.35, 0.65], [0.7, 0.9, 1]],
];

function creatureMaterial(top: number[], belly: number[], shine: number) {
  return new ShaderMaterial({
    vertexShader: CREATURE_VERTEX,
    fragmentShader: CREATURE_FRAGMENT,
    transparent: true,
    side: DoubleSide,
    uniforms: {
      ...shared,
      uTop: { value: new Vector3(...top) },
      uBelly: { value: new Vector3(...belly) },
      uDeepTint: { value: new Vector3(0.05, 0.36, 0.42) },
      uShine: { value: shine },
    },
  });
}

/** Where you look now, `dist` metres out, `spread` radians either side. */
function inView(dist: number, spread: number) {
  const a = oceanSignals.yaw + rand(-spread, spread);
  return { a, x: Math.sin(a) * dist, z: -Math.cos(a) * dist };
}

interface Leaper {
  mesh: Mesh;
  origin: Vector3;
  heading: number;
  start: number;
  speed: number;
  height: number;
  airTime: number;
  gapTime: number;
  leaps: number;
  lastY: number;
}

/**
 * Visitors: a school of reef fish drifting over the sand, a pod of dolphins arcing through the
 * swell, a shoal of small fish skipping out of the water, gulls wheeling high above. Each comes by where you are looking, now and then.
 */
export default function SeaLife() {
  const res = useMemo(() => {
    const dolphinGeo = dolphinGeometry();
    const fishGeo = fishGeometry();
    const bodyGeo = gullBodyGeometry();
    const wingGeo = gullWingGeometry();
    const sprayGeo = new SphereGeometry(1, 10, 6);
    const dolphinMat = creatureMaterial([0.1, 0.14, 0.2], [0.55, 0.6, 0.65], 0.7);
    const fishMat = creatureMaterial([0.2, 0.3, 0.38], [0.85, 0.88, 0.92], 1.2);
    const gullMat = creatureMaterial([0.78, 0.8, 0.84], [0.95, 0.95, 0.96], 0.2);
    const sprayMat = new ShaderMaterial({
      vertexShader: DROP_VERTEX,
      fragmentShader: DROP_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: { ...shared, uTint: { value: new Vector3(0.8, 0.9, 1) }, uOpacity: { value: 0.85 }, uStretch: { value: 1.2 } },
    });

    const mkLeaper = (geo: typeof dolphinGeo, mat: ShaderMaterial, scale: number): Leaper => {
      const mesh = new Mesh(geo, mat);
      mesh.scale.setScalar(scale);
      mesh.rotation.order = 'YZX';
      mesh.visible = false;
      return { mesh, origin: new Vector3(), heading: 0, start: -1, speed: 0, height: 0, airTime: 1, gapTime: 1, leaps: 0, lastY: -1 };
    };
    const dolphins = Array.from({ length: POD }, () => mkLeaper(dolphinGeo, dolphinMat, 2.1));
    const fish = Array.from({ length: SHOAL }, () => mkLeaper(fishGeo, fishMat, 0.26));

    const reefMats = REEF_COLOURS.map(([top, belly]) => creatureMaterial(top, belly, 0.8));
    const reef = Array.from({ length: REEF_FISH }, (_, i) => {
      const mesh = new Mesh(fishGeo, reefMats[i % reefMats.length]);
      mesh.rotation.order = 'YZX';
      mesh.scale.setScalar(rand(0.1, 0.16));
      return { mesh, phase: rand(0, Math.PI * 2), radius: rand(0.25, 0.9), speed: rand(0.3, 0.45), depth: rand(0.12, 0.3), wob: rand(0, 6) };
    });

    const gulls = Array.from({ length: OCEAN.creatures.gulls }, (_, i) => {
      const g = new Group();
      const body = new Mesh(bodyGeo, gullMat);
      const right = new Mesh(wingGeo, gullMat);
      const left = new Mesh(wingGeo, gullMat);
      left.scale.z = -1;
      right.scale.setScalar(0.85);
      left.scale.set(0.85, 0.85, -0.85);
      g.add(body, right, left);
      g.scale.setScalar(0.55);
      g.rotation.order = 'YXZ';
      const a = (i / OCEAN.creatures.gulls) * Math.PI * 2 + 0.4;
      return { g, right, left, cx: Math.sin(a) * rand(16, 26), cz: -Math.cos(a) * rand(16, 26), radius: rand(5, 9), height: rand(6, 10), speed: rand(0.12, 0.2) * (i % 2 ? 1 : -1), phase: rand(0, 6) };
    });

    const spray = Array.from({ length: SPRAY }, () => {
      const mesh = new Mesh(sprayGeo, sprayMat);
      mesh.visible = false;
      return { mesh, pos: new Vector3(), vel: new Vector3(), r: 0, alive: false };
    });

    return { dolphinGeo, fishGeo, bodyGeo, wingGeo, sprayGeo, mats: [dolphinMat, fishMat, gullMat, sprayMat, ...reefMats], dolphins, fish, gulls, spray, reef };
  }, []);

  useEffect(
    () => () => {
      [res.dolphinGeo, res.fishGeo, res.bodyGeo, res.wingGeo, res.sprayGeo].forEach((g) => g.dispose());
      res.mats.forEach((m) => m.dispose());
    },
    [res],
  );

  const clock = useRef({ t: 0, nextDolphins: 5, nextFish: 9 });

  const burst = (x: number, z: number, n: number, power: number) => {
    let k = 0;
    for (const p of res.spray) {
      if (p.alive || k >= n) continue;
      const a = Math.random() * Math.PI * 2;
      const hs = rand(0.3, 0.9) * power;
      p.pos.set(x, 0.02, z);
      p.vel.set(Math.cos(a) * hs, rand(0.8, 1.8) * power, Math.sin(a) * hs);
      p.r = rand(0.015, 0.035) * power;
      p.alive = true;
      k++;
    }
  };

  const launchPod = () => {
    const dist = rand(6, 12);
    const { a, x, z } = inView(dist, 0.4);
    const heading = a + (Math.random() < 0.5 ? 1 : -1) * rand(1.1, 2);
    const count = 2 + Math.round(Math.random());
    res.dolphins.forEach((d, i) => {
      if (i >= count) return;
      // Start behind the meeting point so the pod crosses in front of you.
      const back = 5.5;
      const side = (i - 1) * 0.7;
      d.origin.set(x - Math.cos(heading) * back - Math.sin(heading) * side, 0, z - Math.sin(heading) * back + Math.cos(heading) * side);
      d.heading = heading;
      d.start = clock.current.t + i * 0.28 + rand(0, 0.1);
      d.speed = rand(3, 3.6);
      d.height = rand(0.7, 1.1);
      d.airTime = 1.05;
      d.gapTime = rand(0.8, 1.1);
      d.leaps = 3;
      d.lastY = -1;
    });
  };

  const launchShoal = () => {
    const { a, x, z } = inView(rand(3.5, 6), 0.35);
    const heading = a + rand(-2.5, 2.5);
    res.fish.forEach((f, i) => {
      f.origin.set(x + rand(-0.6, 0.6), 0, z + rand(-0.6, 0.6));
      f.heading = heading + rand(-0.2, 0.2);
      f.start = clock.current.t + i * rand(0.12, 0.22);
      f.speed = rand(1.6, 2.1);
      f.height = rand(0.25, 0.42);
      f.airTime = 0.55;
      f.gapTime = 0.35;
      f.leaps = 1 + Math.round(Math.random());
      f.lastY = -1;
    });
  };

  const moveLeaper = (l: Leaper, t: number, splash: number) => {
    const local = t - l.start;
    const cycle = l.airTime + l.gapTime;
    if (l.start < 0 || local < -l.gapTime || local > l.leaps * cycle) {
      l.mesh.visible = false;
      return;
    }
    const k = Math.floor((local + l.gapTime) / cycle);
    const u = local - (k * cycle);
    let y: number;
    let dy: number;
    if (u >= 0 && u <= l.airTime) {
      const s = u / l.airTime;
      y = -0.25 + (l.height + 0.25) * Math.sin(Math.PI * s);
      dy = ((l.height + 0.25) * Math.PI * Math.cos(Math.PI * s)) / l.airTime;
    } else {
      const v = (u < 0 ? u + l.gapTime : u - l.airTime) / l.gapTime;
      y = -0.25 - 0.35 * Math.sin(Math.PI * v);
      dy = (-0.35 * Math.PI * Math.cos(Math.PI * v)) / l.gapTime;
    }
    const s = local * l.speed;
    const x = l.origin.x + Math.cos(l.heading) * s;
    const z = l.origin.z + Math.sin(l.heading) * s;
    l.mesh.visible = true;
    l.mesh.position.set(x, y, z);
    l.mesh.rotation.set(0, -l.heading, Math.atan2(dy, l.speed));
    if ((y > 0) !== (l.lastY > 0) && l.lastY !== -1) {
      ripple(x, z, 0.1 + splash * 0.2, -0.03 * splash);
      impact(x, z, WHITE, 1, 0.5 * splash);
      burst(x, z, Math.round(4 + 8 * splash), 0.5 + 0.6 * splash);
    }
    l.lastY = y;
  };

  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const c = clock.current;
    c.t += dt;
    const t = c.t;

    if (t > c.nextDolphins) {
      launchPod();
      c.nextDolphins = t + rand(...OCEAN.creatures.dolphins) + 6;
    }
    if (t > c.nextFish) {
      launchShoal();
      c.nextFish = t + rand(...OCEAN.creatures.fish) + 3;
    }
    res.dolphins.forEach((d) => moveLeaper(d, t, 1));
    res.fish.forEach((f) => moveLeaper(f, t, 0.3));

    // The reef school drifts around the lagoon, each fish circling its own path within it.
    const cx = Math.sin(t * 0.045) * 1.6;
    const cz = Math.cos(t * 0.033) * 1.4 - 0.4;
    for (const f of res.reef) {
      const a = f.phase + t * f.speed;
      const r = f.radius * (1 + 0.15 * Math.sin(t * 0.7 + f.wob));
      f.mesh.position.set(cx + Math.cos(a) * r, -f.depth + Math.sin(t * 1.3 + f.wob) * 0.02, cz + Math.sin(a) * r);
      // Heading along the circle's tangent, with a swimmer's wiggle.
      f.mesh.rotation.set(0, -(a + Math.PI / 2) + Math.sin(t * 9 + f.wob) * 0.18, 0);
    }

    for (const g of res.gulls) {
      const a = g.phase + t * g.speed;
      g.g.position.set(g.cx + Math.cos(a) * g.radius, g.height + Math.sin(t * 0.3 + g.phase) * 0.4, g.cz + Math.sin(a) * g.radius);
      const heading = a + (g.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.g.rotation.set(0, -heading, 0);
      g.g.rotation.x = g.speed > 0 ? 0.25 : -0.25; // bank into the turn
      const flapping = Math.sin(t * 0.7 + g.phase) > 0.35;
      const w = flapping ? Math.sin(t * 9 + g.phase) * 0.55 : 0.12;
      g.right.rotation.x = -w - 0.1;
      g.left.rotation.x = w + 0.1;
    }

    for (const p of res.spray) {
      if (!p.alive) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= OCEAN.drop.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      p.mesh.scale.setScalar(p.r);
      if (p.pos.y < 0 && p.vel.y < 0) {
        p.alive = false;
        p.mesh.visible = false;
      }
    }
  });

  return (
    <>
      {res.dolphins.map((d, i) => (
        <primitive key={`d${i}`} object={d.mesh} />
      ))}
      {res.fish.map((f, i) => (
        <primitive key={`f${i}`} object={f.mesh} />
      ))}
      {res.reef.map((f, i) => (
        <primitive key={`r${i}`} object={f.mesh} />
      ))}
      {res.gulls.map((g, i) => (
        <primitive key={`g${i}`} object={g.g} />
      ))}
      {res.spray.map((p, i) => (
        <primitive key={`s${i}`} object={p.mesh} />
      ))}
    </>
  );
}
