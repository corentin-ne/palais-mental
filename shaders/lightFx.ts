import { ADDITIVE_OUTPUT_CHUNK } from './common';

/**
 * Fake light: additive, texture-free shaders drawn on simple planes and cones. Each
 * takes a colour and an intensity; `uTime` (the room's ambient clock) makes some breathe.
 */
export const fxVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Soft elliptical pool (floor, wall or halo). uShape.x: 0 round, 1 flattened bottom (wall wash). */
export const poolFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uBreath;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float fall = pow(max(0.0, 1.0 - r), 2.2);
    float core = pow(max(0.0, 1.0 - r * 1.8), 3.0) * 0.5;
    float breathe = 1.0 + uBreath * 0.08 * sin(uTime * 1.3);
    float a = (fall + core) * uIntensity * breathe;
    gl_FragColor = vec4(uColor * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;

/** Vertical wash: bright at the top edge, fading down (light spilling from a shelf's light line). */
export const washFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float down = pow(vUv.y, 2.6);
    float sides = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float a = down * sides * uIntensity;
    gl_FragColor = vec4(uColor * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;

/** Light cone from above: open cylinder, faint at the top, soft at the edges, with slow motes. */
export const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    // uv.x runs around the cone, uv.y from bottom (0) to top (1).
    float edge = 0.55 + 0.45 * cos((vUv.x - 0.5) * 6.2831);
    float fade = smoothstep(1.0, 0.45, vUv.y) * smoothstep(0.0, 0.25, vUv.y);
    float streak = 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 0.4) * sin(vUv.y * 9.0 - uTime * 0.25);
    float a = uIntensity * fade * streak * (0.35 + 0.65 * (1.0 - edge));
    gl_FragColor = vec4(uColor * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;

/** Caustics: interfering ripples of refracted light, slowly drifting, fading at the edge. */
export const causticFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  float cell(vec2 p, float t) {
    vec2 q = p;
    float c = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      q += vec2(sin(q.y * 1.7 + t * (0.4 + fi * 0.1) + fi), cos(q.x * 1.5 - t * (0.35 + fi * 0.07) - fi)) * 0.45;
      c += 1.0 / (1.0 + 18.0 * abs(sin(q.x * 1.3) * sin(q.y * 1.3)));
    }
    return c / 4.0;
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float mask = pow(max(0.0, 1.0 - r), 1.5);
    float c = pow(cell(p * 5.0, uTime * 0.8), 2.0);
    float a = c * mask * uIntensity;
    gl_FragColor = vec4(uColor * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;
