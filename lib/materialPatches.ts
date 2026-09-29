/**
 * Procedural surface textures for standard materials, computed in the shader from the
 * object's own coordinates: no image files, no UVs needed, identical on web and native.
 * They only modulate the base colour (and roughness for wood), a few percent at most, so
 * surfaces read as real materials while staying quiet and minimal.
 */
import type { Material } from 'three';

export type SurfaceKind = 'wood' | 'linen' | 'boucle' | 'plaster' | 'paper';

export interface SurfaceOptions {
  /** 0–1 multiplier on the default strength of the pattern. */
  strength?: number;
  /** Wood only: object-space axis the grain runs along. */
  axis?: 'x' | 'y' | 'z';
}

const NOISE = /* glsl */ `
  float spHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float spNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(spHash(i), spHash(i + vec3(1, 0, 0)), f.x), mix(spHash(i + vec3(0, 1, 0)), spHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(spHash(i + vec3(0, 0, 1)), spHash(i + vec3(1, 0, 1)), f.x), mix(spHash(i + vec3(0, 1, 1)), spHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

/** Returns a colour multiplier around 1.0 for the surface at object-space point p. */
const PATTERNS: Record<SurfaceKind, (axis: string) => string> = {
  // Long fibres along the axis, slow waves across it, a few darker streaks.
  wood: (axis) => /* glsl */ `
    float spPattern(vec3 p) {
      vec3 q = p.${axis === 'x' ? 'xyz' : axis === 'y' ? 'yxz' : 'zyx'};
      float wave = spNoise(vec3(q.x * 1.5, q.y * 6.0, q.z * 6.0)) * 3.0;
      float fibre = sin((q.y + q.z) * 160.0 + wave * 6.0) * 0.5 + 0.5;
      float streak = spNoise(vec3(q.x * 3.0, q.y * 55.0, q.z * 55.0));
      return 1.0 + (fibre - 0.5) * 0.06 * spStrength + (streak - 0.5) * 0.09 * spStrength;
    }`,
  // Plain weave: two crossing sine threads with slubs of irregular yarn.
  linen: () => /* glsl */ `
    float spPattern(vec3 p) {
      float weave = sin(p.x * 900.0) * sin(p.y * 900.0 + p.z * 900.0);
      float slub = spNoise(p * vec3(40.0, 400.0, 40.0));
      return 1.0 + weave * 0.025 * spStrength + (slub - 0.5) * 0.05 * spStrength;
    }`,
  // Looped wool: dense, soft lumps at two scales.
  boucle: () => /* glsl */ `
    float spPattern(vec3 p) {
      float a = spNoise(p * 220.0);
      float b = spNoise(p * 70.0 + 3.1);
      return 1.0 + (a - 0.5) * 0.14 * spStrength + (b - 0.5) * 0.06 * spStrength;
    }`,
  // Lime plaster / satin lacquer: broad clouds plus a fine grain.
  plaster: () => /* glsl */ `
    float spPattern(vec3 p) {
      float clouds = spNoise(p * 5.0);
      float grain = spNoise(p * 120.0);
      return 1.0 + (clouds - 0.5) * 0.05 * spStrength + (grain - 0.5) * 0.025 * spStrength;
    }`,
  // Paper: fibres and a faint mottling.
  paper: () => /* glsl */ `
    float spPattern(vec3 p) {
      float fibres = spNoise(p * vec3(300.0, 60.0, 300.0));
      float mottle = spNoise(p * 14.0);
      return 1.0 + (fibres - 0.5) * 0.05 * spStrength + (mottle - 0.5) * 0.05 * spStrength;
    }`,
};

/**
 * Give a material a procedural surface. Safe to call once per material; materials that
 * already customise their shader (onBeforeCompile) are left untouched.
 */
export function withSurface<T extends Material>(material: T, kind: SurfaceKind, opts: SurfaceOptions = {}): T {
  if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) return material;
  const strength = opts.strength ?? 1;
  const axis = opts.axis ?? 'x';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.spStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSpPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSpPos;\nuniform float spStrength;\n${NOISE}\n${PATTERNS[kind](axis)}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= spPattern(vSpPos);');
    if (kind === 'wood') {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n  roughnessFactor *= 0.92 + 0.16 * spNoise(vSpPos * vec3(4.0, 60.0, 60.0));',
      );
    }
  };
  material.customProgramCacheKey = () => `surface-${kind}-${axis}`;
  return material;
}
