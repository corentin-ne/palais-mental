import { OUTPUT_CHUNK, WINDOW_SDF } from './common';

/**
 * Fake volumetric god rays: the window outline swept along the sun direction into
 * a prism, drawn additively from both sides. uv.x runs along the perimeter (drives
 * the striations), uv.y along the ray (drives the falloff).
 */
export const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  varying float vWorldY;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldY = world.y;
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 v = normalize(cameraPosition - world.xyz);
    vFacing = abs(dot(n, v));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const shaftFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFacing;
  varying float vWorldY;
  void main() {
    float along = vUv.y;
    float fade = smoothstep(0.0, 0.06, along) * pow(1.0 - along, 1.4);
    // Dissolve into the floor instead of clipping on it.
    fade *= smoothstep(0.0, 0.7, vWorldY);
    float u = vUv.x * 6.2831;
    float streaks = 0.45
      + 0.35 * (0.5 + 0.5 * sin(u * 7.0 + uTime * 0.35))
      + 0.2 * (0.5 + 0.5 * sin(u * 19.0 - uTime * 0.22));
    // Looking down the beam its walls are seen at grazing angles, which is exactly where a
    // real shaft looks densest — so facing only softens, never hides.
    float a = uIntensity * fade * streaks * mix(1.0, 0.55, vFacing);
    gl_FragColor = vec4(uColor * a, 1.0);
    ${OUTPUT_CHUNK}
  }
`;

/** Sun patch on the floor: the window projected along the light, soft-edged with mullion shadows. */
export const patchVertex = /* glsl */ `
  varying vec2 vWin;
  void main() {
    vWin = uv; // ShapeGeometry uv == window-plane coords
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const patchFragment = /* glsl */ `
  ${WINDOW_SDF}
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vWin;
  void main() {
    float inside = smoothstep(0.09, -0.07, windowSdf(vWin));
    float a = uIntensity * inside * mix(0.35, 1.0, mullions(vWin));
    gl_FragColor = vec4(uColor * a, 1.0);
    ${OUTPUT_CHUNK}
  }
`;
