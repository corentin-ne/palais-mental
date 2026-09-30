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

export const OCEAN_BG = '#8FC3EA';

/**
 * The palace as an open sea. You float just above the water; each collection is an island
 * on the horizon that grows with it, and the chips turn your head toward one. Everything you
 * log falls into the sea as a drop. The loop runs only while this tab is on screen.
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
      camera={{ fov: OCEAN.fov[0], near: 0.05, far: 400, position: [0, OCEAN.eyeHeight, 0] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[OCEAN_BG]} />
      <OceanSurface />
      <SeaLife />
      <DropSpawner />
      <HeadTurn />
      <Islands />
      <AdaptiveResolution />
    </Canvas>
  );
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Turns the head toward the focused collection's island on a spring, with a gentle float on the swell. */
function HeadTurn() {
  const focus = usePalaceStore((s) => s.focus);
  const state = useRef({ yaw: focus === 'window' ? 0 : OCEAN.islands[focus], v: 0 });
  useFrame(({ camera, clock, size }, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const s = state.current;
    const target = focus === 'window' ? 0 : OCEAN.islands[focus];
    const err = wrap(target - s.yaw);
    s.v += (err * OCEAN.turnStiffness - s.v * OCEAN.turnDamping) * dt;
    s.yaw = wrap(s.yaw + s.v * dt);
    oceanSignals.yaw = s.yaw;
    shared.uTime.value = clock.elapsedTime;

    const t = clock.elapsedTime;
    const cam = camera as PerspectiveCamera;
    const fov = size.width / size.height < 0.85 ? OCEAN.fov[1] : OCEAN.fov[0];
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.position.set(0, OCEAN.eyeHeight + Math.sin(t * 0.55) * 0.03, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(OCEAN.pitch + Math.sin(t * 0.4) * 0.006, -s.yaw, Math.sin(t * 0.33) * 0.008 - s.v * 0.02);
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
