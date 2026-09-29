import { OUTPUT_CHUNK } from './common';

/**
 * The TV in ambient mode: a dim pastel gradient (lilac to peach) behind glass, with one
 * broad, faint reflection of the window sweeping across it.
 */
export const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const screenFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec3 lilac = vec3(0.62, 0.58, 0.78);
    vec3 peach = vec3(0.92, 0.7, 0.62);
    vec3 base = mix(peach, lilac, smoothstep(0.0, 1.0, vUv.y + (vUv.x - 0.5) * 0.25)) * 0.62;
    float band = smoothstep(0.18, 0.0, abs(vUv.x - vUv.y * 0.55 - 0.18)) * 0.06;
    float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
    vec3 col = base + vec3(1.0, 0.95, 0.88) * band;
    col *= mix(0.8, 1.0, edge);
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    ${OUTPUT_CHUNK}
  }
`;
