import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

import { LIGHTING } from '@/config/lighting';

/**
 * Web post stack: ambient occlusion to seat objects on their furniture, bloom on the
 * light lines, glows and sun, Khronos PBR Neutral tone mapping so cover art keeps its
 * real colours, a light vignette, then SMAA (settings in config/lighting). Passes only
 * run on rendered frames, so an idle palace costs nothing.
 */
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="medium" aoRadius={LIGHTING.ambientOcclusion.radius} distanceFalloff={0.9} intensity={LIGHTING.ambientOcclusion.intensity} color="#4A3A2E" />
      <Bloom mipmapBlur luminanceThreshold={LIGHTING.bloom.threshold} luminanceSmoothing={0.2} intensity={LIGHTING.bloom.intensity} radius={LIGHTING.bloom.radius} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={LIGHTING.vignette.offset} darkness={LIGHTING.vignette.enabled ? LIGHTING.vignette.darkness : 0} />
      <SMAA />
    </EffectComposer>
  );
}
