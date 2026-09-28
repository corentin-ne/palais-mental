import { ADDITIVE_OUTPUT_CHUNK } from './common';

/** Billboard halo behind the hero: warm radial bloom with slowly turning soft rays. */
export const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float glow = exp(-r * r * 5.0);
    float core = exp(-r * r * 26.0);
    float rays = pow(0.5 + 0.5 * sin(ang * 7.0 + uTime * 0.6), 6.0) * exp(-r * 2.4) * 0.5;
    vec3 col = mix(uAccent, uColor, core) * (glow * 0.8 + rays) + uColor * core * 1.6;
    float a = uOpacity * smoothstep(1.0, 0.6, r);
    gl_FragColor = vec4(col * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;

/** Soft sunbeam cone pouring down onto the hero ("floating in the sunbeams"). */
export const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

export const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    // uv.y: 0 at the bottom (hero), 1 at the top of the cone.
    float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
    float streaks = 0.6 + 0.4 * sin(vUv.x * 6.2831 * 9.0 + uTime * 0.8);
    float a = uOpacity * fade * streaks * vFacing * 0.55;
    gl_FragColor = vec4(uColor * a, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;

/**
 * Sparkle swarm. uProgress drives the whole choreography on the GPU:
 * 0 → 0.55 motes spiral inward to the hero, 0.55 → 1 they burst out and fade.
 */
export const sparkleVertex = /* glsl */ `
  attribute vec4 aSeed; // xyz: direction seed (-1..1), w: phase
  uniform float uProgress;
  uniform float uTime;
  uniform float uRadius;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec3 dir = normalize(aSeed.xyz + vec3(0.0001));
    float ph = aSeed.w * 6.2831;
    float gather = smoothstep(0.0, 0.55, uProgress);
    float burst = smoothstep(0.55, 1.0, uProgress);
    float r = uRadius * (mix(1.0 + 0.4 * aSeed.w, 0.12, gather) + burst * (1.1 + aSeed.w));
    float spin = (1.0 - gather) * 2.5 + uTime * 0.6 + ph;
    vec3 p = dir * r;
    float c = cos(spin), s = sin(spin);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p.y += burst * uRadius * 0.6 * aSeed.w;

    vAlpha = smoothstep(0.0, 0.12, uProgress) * (1.0 - burst) * (0.6 + 0.4 * sin(uTime * 9.0 + ph * 5.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.5 + aSeed.w) * uPixelRatio / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const sparkleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    // Four-point star: soft core plus thin cross flares.
    float star = exp(-d * d * 10.0) + 0.5 * exp(-abs(c.x) * 60.0) * exp(-abs(c.y) * 6.0)
               + 0.5 * exp(-abs(c.y) * 60.0) * exp(-abs(c.x) * 6.0);
    float a = star * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uAccent, uColor, exp(-d * 4.0)) * a * 2.0, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;
