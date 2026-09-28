import { ADDITIVE_OUTPUT_CHUNK, WINDOW_SDF } from './common';

/**
 * Floating dust motes. All motion is computed on the GPU from a per-particle seed and
 * a single time uniform — zero CPU work per frame, one draw call. Motes glint only
 * where they cross a sunbeam (tested analytically by projecting back onto the window).
 */
export const dustVertex = /* glsl */ `
  ${WINDOW_SDF}
  attribute vec4 aSeed;     // xyz: normalized home position, w: phase
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxSize;
  uniform vec3 uLightDir;   // direction light travels into the room
  uniform float uWindowZ;
  varying float vGlow;
  varying float vTwinkle;
  void main() {
    float t = uTime;
    float ph = aSeed.w * 6.2831;
    vec3 p = uBoxMin + aSeed.xyz * uBoxSize;
    // Slow sink with wrap-around + lazy Lissajous drift.
    p.y = uBoxMin.y + mod(p.y - uBoxMin.y - t * (0.012 + 0.02 * aSeed.x), uBoxSize.y);
    p.x += sin(t * (0.21 + 0.1 * aSeed.y) + ph) * 0.09;
    p.z += cos(t * (0.17 + 0.1 * aSeed.z) + ph * 1.3) * 0.09;
    p.y += sin(t * 0.33 + ph * 2.0) * 0.04;

    vec4 world = modelMatrix * vec4(p, 1.0);
    // March back along the light to the window plane: inside the outline = inside the beam.
    float s = (world.z - uWindowZ) / uLightDir.z;
    vec3 onWindow = world.xyz - uLightDir * s;
    float beam = smoothstep(0.12, -0.12, windowSdf(onWindow.xy)) * step(0.0, s);
    vGlow = mix(0.04, 1.0, beam);
    vTwinkle = 0.65 + 0.35 * sin(t * (1.3 + aSeed.y) + ph * 3.0);

    vec4 mv = viewMatrix * world;
    gl_PointSize = uSize * (0.6 + aSeed.z) * uPixelRatio / max(0.2, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    float a = exp(-d * 3.5) * vGlow * vTwinkle;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a * 0.9, 1.0);
    ${ADDITIVE_OUTPUT_CHUNK}
  }
`;
