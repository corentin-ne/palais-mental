import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, Vector3, Vector4 } from 'three';

import type { RoomDimsRef } from '../MentalPalace';
import { dustFragment, dustVertex } from '@/shaders/dust';
import { SUN_LIGHT_DIR, WINDOW, windowPlaneZ } from '@/lib/palaceLayout';
import { sceneSignals } from '@/lib/sceneSignals';

const COUNT = Platform.OS === 'web' ? 520 : 360;

/**
 * Ambient dust drifting through the sunbeams. One Points draw call; the CPU only
 * writes three uniforms per frame, and only while the ambient clock is running.
 */
export default function DustMotes({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const dpr = useThree((s) => s.viewport.dpr);

  const { geo, mat } = useMemo(() => {
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const g = new BufferGeometry();
    // Positions are computed on the GPU; the attribute only sizes the draw.
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
    const m = new ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 20 },
        uPixelRatio: { value: 1 },
        uBoxMin: { value: new Vector3() },
        uBoxSize: { value: new Vector3() },
        uLightDir: { value: new Vector3(...SUN_LIGHT_DIR) },
        uWindowZ: { value: 0 },
        uWin: { value: new Vector4(WINDOW.halfWidth, WINDOW.sill, WINDOW.springLine, 0) },
        uColor: { value: new Color('#FFE6C2') },
      },
    });
    return { geo: g, mat: m };
  }, []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(() => {
    const d = dimsRef.current;
    const zw = windowPlaneZ(d);
    const u = mat.uniforms;
    u.uTime.value = sceneSignals.ambientTime;
    u.uPixelRatio.value = dpr;
    u.uWindowZ.value = zw;
    // A volume hugging the sunbeams plus some slack, so motes drift in and out of the light.
    (u.uBoxMin.value as Vector3).set(-WINDOW.halfWidth - 1.2, 0.15, zw + 0.2);
    (u.uBoxSize.value as Vector3).set(WINDOW.halfWidth * 2 + 3.2, 3.2, Math.min(6.5, d.depth - 1));
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />;
}
