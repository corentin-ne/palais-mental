import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, PlaneGeometry, ShaderMaterial } from 'three';

import { beamFragment, causticFragment, fxVertex, poolFragment, washFragment } from '@/shaders/lightFx';
import { sceneSignals } from '@/lib/sceneSignals';

type Kind = 'pool' | 'wash' | 'beam' | 'caustics';

const FRAGMENTS: Record<Kind, string> = { pool: poolFragment, wash: washFragment, beam: beamFragment, caustics: causticFragment };

interface Props {
  kind: Kind;
  color: string;
  intensity: number;
  /** Plane: [width, height]. Beam: [top radius, bottom radius, height]. */
  size: number[];
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Pools only: breathe gently with the ambient clock. */
  breathe?: boolean;
}

/**
 * One piece of fake light. Additive, never writes depth, drawn after the room, and only
 * animated while the ambient clock runs (see sceneSignals), so it costs nothing at rest.
 */
export default function Glow({ kind, color, intensity, size, position, rotation, breathe = false }: Props) {
  const res = useMemo(() => {
    const geo =
      kind === 'beam'
        ? new CylinderGeometry(size[0], size[1], size[2], 48, 1, true).translate(0, -size[2] / 2, 0)
        : new PlaneGeometry(size[0], size[1]);
    const mat = new ShaderMaterial({
      vertexShader: fxVertex,
      fragmentShader: FRAGMENTS[kind],
      uniforms: {
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
        uTime: { value: 0 },
        uBreath: { value: breathe ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      side: DoubleSide,
    });
    return { geo, mat };
  }, [kind, color, intensity, breathe, ...size]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );
  useFrame(() => {
    if (kind === 'wash') return;
    res.mat.uniforms.uTime.value = sceneSignals.ambientTime;
  });
  return <mesh geometry={res.geo} material={res.mat} position={position} rotation={rotation} renderOrder={2} frustumCulled={false} />;
}
