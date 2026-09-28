/**
 * Shared GLSL. All effect shaders are single-pass, texture-free and analytic so
 * they stay cheap on mobile GPUs (no render targets, no raymarching).
 */

/**
 * Signed distance to the arched window, in window-plane coords (x centered, y from floor).
 * uWin = (halfWidth, sill, springLine, unused). Union of the jamb box and the arch circle.
 */
export const WINDOW_SDF = /* glsl */ `
  uniform vec4 uWin;
  float windowSdf(vec2 p) {
    float hw = uWin.x;
    float dc = length(p - vec2(0.0, uWin.z)) - hw;
    vec2 q = abs(p - vec2(0.0, (uWin.y + uWin.z) * 0.5)) - vec2(hw, (uWin.z - uWin.y) * 0.5);
    float db = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return min(dc, db);
  }
  // Soft shadow of the cross mullions (1 = lit, 0 = in the bar's shadow).
  float mullions(vec2 p) {
    float v = smoothstep(0.02, 0.06, abs(p.x));
    float h = smoothstep(0.02, 0.06, abs(p.y - uWin.z));
    return v * h;
  }
`;

/** Close every custom shader the same way three's built-ins do (tone mapping + output color space). */
export const OUTPUT_CHUNK = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/**
 * Closing chunk for ADDITIVE effects. No colour-space conversion: additive light must
 * be summed in linear space. With the web composer the frame is linear until the final
 * pass anyway; on native (straight to the sRGB canvas) converting per fragment would
 * brighten faint glows ~5x before they are summed and blow the beams out to white.
 */
export const ADDITIVE_OUTPUT_CHUNK = /* glsl */ `
  #include <tonemapping_fragment>
`;
