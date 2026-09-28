import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { DepthOfFieldEffect, ToneMappingMode } from 'postprocessing';

import { sceneSignals } from '@/lib/sceneSignals';

/** Any non-null target switches the DOF into auto-focus mode; the real target is bound below. */
const AUTOFOCUS: [number, number, number] = [0, 0, 0];

/**
 * Web post stack: warm ambient occlusion (N8AO), gentle bloom (sun core, halos, sparkles), a soft depth of field
 * that tracks sceneSignals.focusPoint, a barely-there warm vignette, then Khronos PBR Neutral
 * tone mapping (keeps pastel albedos true instead of greying them like ACES).
 * Composer passes only run on rendered frames, so an idle palace still costs nothing.
 */
export default function Effects() {
  const dof = useRef<DepthOfFieldEffect>(null);

  // Point the effect at the shared, mutable focus vector (camera rig / hero write into it).
  // Bound lazily: the composer attaches its effects after this component's first commit.
  useFrame(() => {
    const effect = dof.current;
    if (effect && effect.target !== sceneSignals.focusPoint) effect.target = sceneSignals.focusPoint;
  });

  return (
    <EffectComposer multisampling={0}>
      {/* Soft, warm contact shading: grounds objects in their niches and the room in its cove. */}
      <N8AO halfRes quality="medium" aoRadius={0.55} distanceFalloff={0.9} intensity={2.2} color="#7A5A45" />
      <DepthOfField ref={dof} target={AUTOFOCUS} focusRange={2.4} bokehScale={2.2} resolutionScale={0.5} />
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.6} radius={0.7} />
      <Vignette offset={0.35} darkness={0.15} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
