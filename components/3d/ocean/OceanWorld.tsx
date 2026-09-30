import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';

import { Canvas } from '../Canvas';
import { OCEAN } from '@/config/ocean';
import { safeDelta } from '@/lib/easing';
import { oceanSignals } from '@/lib/oceanSignals';
import { CATEGORIES, CategoryId } from '@/lib/types';
import { usePalaceStore } from '@/store/usePalaceStore';
import DropSpawner from './DropSpawner';
import OceanSurface from './OceanSurface';
import SeaLife from './SeaLife';
import { shared, updateIslands } from './uniforms';

export const OCEAN_BG = '#9CCBEF';

/**
 * The palace as clear water. The view is free: drag to look all the way round, further down
 * or toward the horizon. Each collection is an island on the horizon that grows with it, and
 * everything you log falls into the water as a drop. The loop runs only while this tab is on screen.
 */
export default function OceanWorld() {
  const [active, setActive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ fov: OCEAN.camera.fov[0], near: 0.05, far: 400, position: [0, 1.2, 4.2] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[OCEAN_BG]} />
      <OceanSurface />
      <SeaLife />
      <DropSpawner />
      <FreeLook />
      <Islands />
      <AdaptiveResolution />
    </Canvas>
  );
}

/** Orbits the centre of the water from drags, with momentum, and floats gently on the swell. */
function FreeLook() {
  const state = useRef({ yaw: 0, pitch: OCEAN.camera.pitch, vy: 0, vp: 0 });
  useFrame(({ camera, clock, size }, rawDelta) => {
    const dt = Math.max(safeDelta(rawDelta), 1e-3);
    const s = state.current;
    const { sensitivity, friction, pitchRange, distance, fov: fovs } = OCEAN.camera;
    const drag = oceanSignals.drag;
    if (drag.dx || drag.dy) {
      const dyaw = -drag.dx * sensitivity;
      const dpitch = drag.dy * sensitivity * 0.6;
      s.yaw += dyaw;
      s.pitch += dpitch;
      // Momentum follows the finger, smoothed so one jerky frame does not fling the view.
      s.vy += (dyaw / dt - s.vy) * 0.5;
      s.vp += (dpitch / dt - s.vp) * 0.5;
      drag.dx = 0;
      drag.dy = 0;
    } else if (!drag.active) {
      s.yaw += s.vy * dt;
      s.pitch += s.vp * dt;
      const k = Math.exp(-friction * dt);
      s.vy *= k;
      s.vp *= k;
    } else {
      s.vy = 0;
      s.vp = 0;
    }
    s.pitch = Math.min(pitchRange[1], Math.max(pitchRange[0], s.pitch));
    oceanSignals.yaw = s.yaw;
    shared.uTime.value = clock.elapsedTime;

    const t = clock.elapsedTime;
    const cam = camera as PerspectiveCamera;
    const portrait = size.width / size.height < 0.85;
    const fov = portrait ? fovs[1] : fovs[0];
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const d = portrait ? distance[1] : distance[0];
    const yaw = s.yaw + Math.sin(t * 0.13) * 0.02;
    const pitch = s.pitch + Math.sin(t * 0.21) * 0.008;
    // View heading `yaw` (0 = toward -z): the camera stands behind the centre, looking at it.
    cam.position.set(-Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d + Math.sin(t * 0.55) * 0.01, Math.cos(yaw) * Math.cos(pitch) * d);
    cam.lookAt(0, 0, 0);
  });
  return null;
}

/** Islands swell smoothly toward the size of their collection. */
function Islands() {
  const target = usePalaceStore((s) => s.order);
  const current = useRef<Record<CategoryId, number> | null>(null);
  useFrame((_, rawDelta) => {
    const dt = safeDelta(rawDelta);
    if (!current.current) current.current = Object.fromEntries(CATEGORIES.map((c) => [c, target[c].length])) as Record<CategoryId, number>;
    const cur = current.current;
    for (const c of CATEGORIES) cur[c] += (target[c].length - cur[c]) * Math.min(1, dt * 1.5);
    updateIslands(cur);
  });
  return null;
}

/** Keeps the frame rate smooth: steps the pixel ratio down when frames run long, back up when there is headroom. */
function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const base = useThree((s) => s.viewport.initialDpr);
  const m = useRef({ acc: 0, n: 0, dpr: Math.min(base, 1.75) });
  useFrame((_, delta) => {
    const s = m.current;
    s.acc += delta;
    s.n++;
    if (s.n < 45) return;
    const ms = (s.acc / s.n) * 1000;
    s.acc = 0;
    s.n = 0;
    const next = ms > 22 ? Math.max(0.65, s.dpr - 0.25) : ms < 14 ? Math.min(base, 1.75, s.dpr + 0.125) : s.dpr;
    if (next !== s.dpr) {
      s.dpr = next;
      setDpr(next);
    }
  });
  return null;
}
