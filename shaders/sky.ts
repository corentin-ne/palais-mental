import { OUTPUT_CHUNK } from './common';

/**
 * Stylized sky dome seen through the window: warm cream horizon melting into a
 * soft cornflower zenith, with an HDR sun core (> 1.0) that the bloom pass catches.
 */
export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, h));
    col = mix(col, uGround, smoothstep(0.0, -0.25, h));

    float d = max(dot(dir, uSunDir), 0.0);
    float halo = pow(d, 28.0) * 0.35 + pow(d, 160.0) * 0.9;
    float core = smoothstep(0.9990, 0.9995, d) * 5.0;
    // The horizon glows warmer on the sun side.
    col += uSunColor * (halo + core);
    col = mix(col, uSunColor, pow(d, 3.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.35);
    // Warm cream band hugging the horizon.
    col = mix(col, vec3(1.0, 0.86, 0.68), (1.0 - smoothstep(0.0, 0.12, abs(h))) * 0.45);

    gl_FragColor = vec4(col, 1.0);
    ${OUTPUT_CHUNK}
  }
`;
