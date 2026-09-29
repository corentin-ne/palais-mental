/**
 * Surface finishes in the spirit of soft 3D sculpting tools: matte clay, glossy
 * toy plastic, clear glass, frosted glass and tinted jelly. Every material in the palace
 * is built from one of these (lib/finishes), so restyling the whole room is a matter of
 * editing the numbers below.
 *
 * Transparent finishes use real transmission (refraction of what is behind) on the web.
 * On native, where the extra render pass is expensive, they fall back to plain alpha
 * transparency with the same tint (set `nativeTransmission: true` to try the real thing).
 */
export type FinishKind = 'clay' | 'satin' | 'glossy' | 'glass' | 'frosted' | 'jelly' | 'metal';

export interface FinishSpec {
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** Soft velvety rim light, strongest on matte clay. */
  sheen?: number;
  sheenRoughness?: number;
  /** 0 = opaque, 1 = fully transmissive. */
  transmission?: number;
  /** Optical thickness for refraction and tint absorption (m). */
  thickness?: number;
  ior?: number;
  /** Distance over which the tint builds up inside the material (m); lower = deeper colour. */
  attenuationDistance?: number;
  /** Faint rainbow sheen on glass. */
  iridescence?: number;
  /** Alpha used instead of transmission where transmission is off. */
  fallbackOpacity?: number;
  envMapIntensity?: number;
}

export const FINISHES: Record<FinishKind, FinishSpec> = {
  clay: { roughness: 0.68, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.5, sheenRoughness: 0.7, envMapIntensity: 0.8 },
  satin: { roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.25, sheenRoughness: 0.6, envMapIntensity: 1 },
  glossy: { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 },
  glass: {
    roughness: 0.06,
    transmission: 1,
    thickness: 0.04,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    attenuationDistance: 0.6,
    iridescence: 0.25,
    fallbackOpacity: 0.35,
    envMapIntensity: 1.4,
  },
  frosted: {
    roughness: 0.38,
    transmission: 1,
    thickness: 0.06,
    ior: 1.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    attenuationDistance: 0.12,
    fallbackOpacity: 0.6,
    envMapIntensity: 1.1,
  },
  jelly: {
    roughness: 0.16,
    transmission: 0.95,
    thickness: 0.3,
    ior: 1.33,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    attenuationDistance: 0.4,
    fallbackOpacity: 0.72,
    envMapIntensity: 1.3,
  },
  metal: { roughness: 0.28, metalness: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.2 },
};

export const FINISH_OPTIONS = {
  /** Real transmission on iOS/Android (heavier); off = alpha transparency. */
  nativeTransmission: false,
  /** Resolution scale of the transmission buffer on the web (lower is cheaper). */
  transmissionResolution: 0.5,
} as const;
