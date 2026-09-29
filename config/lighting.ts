/**
 * Light in the room beyond the window: gallery beams on every piece of furniture, pools
 * and washes of light, glowing materials, and the sun dappling the walls. Everything here
 * is fake light (additive shaders and emissive materials) except `ceiling`, so it costs
 * almost nothing; set any `enabled` to false to turn an effect off.
 */
export const LIGHTING = {
  /** A warm light high in the dome: gives every piece of furniture a lit front and soft falloff. */
  ceiling: { enabled: true, color: '#FFE6C7', intensity: 2.6, height: 3.4, distance: 10, decay: 1.4 },
  /** Cool light from behind the viewer so edges and glossy cases catch a highlight. */
  rim: { enabled: true, color: '#DCE6FF', intensity: 0.45 },
  /** Hemisphere light multiplier: lower makes the light effects read more. */
  ambientScale: 0.56,

  furniture: {
    /** Soft volumetric beam falling on each piece from the dome. */
    beam: { enabled: true, color: '#FFE9CC', intensity: 0.06, height: 2.6, spread: 0.42 },
    /** Pool of light on the floor in front of each piece. */
    floorPool: { enabled: true, color: '#FFD9A8', intensity: 0.22, accentMix: 0.3 },
    /** Halo on the wall behind each piece. */
    wallWash: { enabled: true, color: '#FFE3C2', intensity: 0.13, accentMix: 0.4 },
    /** Light washing down the back panel from each shelf's light line. */
    shelfWash: { enabled: true, intensity: 0.3 },
    /** Resin and jelly glowing from within. */
    innerGlow: 0.07,
    /** Brightness of the light lines under the shelves. */
    lineIntensity: 2.2,
  },

  decor: {
    /** Soft coloured light the TV casts on the wall behind it. */
    tvBias: { enabled: true, color: '#C9B6F0', intensity: 0.7 },
    /** Floor lamp: warm pool on the floor and halo around the shade. */
    lamp: { enabled: true, color: '#FFC98A', intensity: 0.9 },
    /** Paper lantern halo. */
    lantern: { enabled: true, color: '#FFD9A6', intensity: 0.6 },
    /** Hi-fi display glow on the bench and wall. */
    hifi: { enabled: true, color: '#8FF0E8', intensity: 0.35 },
    /** Light refracted by the glass table and vase, shimmering on the rug. */
    caustics: { enabled: true, color: '#FFF4DE', intensity: 0.55 },
  },

  /** Sunlight broken by leaves outside, drifting across the walls. */
  dapple: { enabled: true, color: '#FFE2B8', intensity: 0.3, scale: 1.4 },

  bloom: { intensity: 0.5, threshold: 0.95, radius: 0.65 },
  /** Darker corners draw the eye to the lit middle of the frame (web). */
  vignette: { enabled: true, offset: 0.32, darkness: 0.38 },
  /** Contact shadows under and between objects (web). */
  ambientOcclusion: { intensity: 2.8, radius: 0.55 },
} as const;
