import { OUTPUT_CHUNK } from './common';

/**
 * Framed prints: soft mid-century compositions (a sun, an arch, rolling hills and a line)
 * drawn analytically on warm paper. uSeed picks the palette and the arrangement, so each
 * frame is a different print from the same series.
 */
export const artVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const artFragment = /* glsl */ `
  uniform float uSeed;
  uniform float uAspect;
  varying vec2 vUv;

  vec3 pick(float t) {
    // Terracotta, sage, ochre, dusty blue, blush, ink.
    vec3 a = vec3(0.80, 0.42, 0.31);
    vec3 b = vec3(0.56, 0.66, 0.53);
    vec3 c = vec3(0.90, 0.70, 0.40);
    vec3 d = vec3(0.45, 0.58, 0.70);
    vec3 e = vec3(0.93, 0.73, 0.66);
    vec3 f = vec3(0.20, 0.22, 0.28);
    float i = floor(fract(t) * 6.0);
    return i < 1.0 ? a : i < 2.0 ? b : i < 3.0 ? c : i < 4.0 ? d : i < 5.0 ? e : f;
  }
  float fill(float d) { return 1.0 - smoothstep(-0.003, 0.003, d); }

  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec3 paper = vec3(0.97, 0.94, 0.88);
    // Passe-partout margin.
    float m = 0.08;
    float inside = step(m, vUv.x) * step(vUv.x, 1.0 - m) * step(m * uAspect, vUv.y) * step(vUv.y, 1.0 - m * uAspect);
    vec3 col = paper;
    vec3 ground = mix(paper, pick(uSeed + 0.17), 0.18);
    col = mix(col, ground, inside);

    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    // Sun.
    vec2 sc = vec2(mix(-0.12, 0.14, fract(uSeed * 7.1)) * uAspect, mix(0.08, 0.2, fract(uSeed * 3.3)));
    col = mix(col, pick(uSeed), fill(length(q - sc) - 0.13) * inside);
    // Arch.
    vec2 ac = vec2(mix(0.1, -0.1, fract(uSeed * 5.7)) * uAspect, -0.06);
    float arch = max(abs(q.x - ac.x) - 0.11, q.y - ac.y);
    arch = min(arch, length(q - ac) - 0.11);
    arch = max(arch, -(q.y - (ac.y - 0.3)));
    col = mix(col, pick(uSeed + 0.33), fill(arch) * inside);
    // Rolling hills.
    float hill = q.y - (-0.22 + 0.05 * sin(q.x * 9.0 + uSeed * 20.0));
    col = mix(col, pick(uSeed + 0.5), fill(hill) * inside);
    // A single ink line.
    float line = abs(q.y - (0.02 + 0.08 * sin(q.x * 6.0 + uSeed * 9.0))) - 0.002;
    col = mix(col, vec3(0.2, 0.2, 0.24), fill(line) * inside * 0.8);
    // Paper grain.
    float n = fract(sin(dot(floor(vUv * 400.0), vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.975 + 0.025 * n;

    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    ${OUTPUT_CHUNK}
  }
`;
