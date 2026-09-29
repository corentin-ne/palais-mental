import { OUTPUT_CHUNK } from './common';

/**
 * A switched-off TV: deep charcoal glass with a soft vertical falloff and one broad,
 * faint reflection of the window sweeping across it.
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
    vec3 base = mix(vec3(0.13, 0.13, 0.145), vec3(0.2, 0.2, 0.215), vUv.y);
    float band = smoothstep(0.18, 0.0, abs(vUv.x - vUv.y * 0.55 - 0.18)) * 0.06;
    float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
    vec3 col = base + vec3(1.0, 0.95, 0.88) * band;
    col *= mix(0.8, 1.0, edge);
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    ${OUTPUT_CHUNK}
  }
`;
