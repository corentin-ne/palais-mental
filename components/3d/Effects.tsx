import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Web post stack, deliberately crisp: ambient occlusion to seat objects in their niches,
 * bloom on true highlights only (sun core, light lines, sparkles), Khronos PBR Neutral
 * tone mapping so cover art keeps its real colours, then SMAA. No depth-of-field or
 * vignette haze. Passes only run on rendered frames, so an idle palace costs nothing.
 */
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="medium" aoRadius={0.5} distanceFalloff={0.9} intensity={2} color="#4A3A2E" />
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.35} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
