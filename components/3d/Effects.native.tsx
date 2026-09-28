/**
 * iOS / Android: no full-screen post stack. expo-gl's float render-target support
 * varies per device, and extra fullscreen passes are the biggest battery cost on
 * mobile. The look is preserved with baked-in equivalents instead:
 *  - bloom → additive halos (sun core in the sky shader, hero halo, sparkles)
 *  - depth of field → atmospheric fog on the landscape
 *  - tone mapping → Neutral set directly on the renderer (MentalPalace onCreated)
 */
export default function Effects() {
  return null;
}
