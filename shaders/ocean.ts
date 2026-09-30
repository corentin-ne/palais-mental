/**
 * GLSL for the water. One full-screen pass: a ray from the eye meets the water, the normal
 * comes from a small swell plus a ripple height field, the refracted ray lands on blue pebbles
 * lit by caustics, and the reflected ray sees the sky (islands included).
 * Every shader here writes display-ready colour itself (own tone curve + gamma).
 */

export const MAX_IMPACTS = 6;
export const ISLAND_COUNT = 6;

/** Noise, sky with clouds and island silhouettes, tone curve. Needs uSun, uTime, uZenith, uHorizon, uIsland*. */
export const OCEAN_COMMON = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform float uClouds;
  uniform vec4 uIsland[${ISLAND_COUNT}];

  #define PI 3.14159265

  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
  }

  // Distant islands: each is (azimuth, half-width, height, seed) in radians, sitting on the horizon.
  vec4 islands(vec3 d) {
    float az = atan(d.x, -d.z);
    float e = d.y;
    vec4 acc = vec4(0.0);
    float sunAz = atan(uSun.x, -uSun.z);
    for (int i = 0; i < ${ISLAND_COUNT}; i++) {
      vec4 I = uIsland[i];
      float da = mod(az - I.x + PI, 2.0 * PI) - PI;
      float u = da / I.y;
      if (abs(u) > 1.25 || e > I.z * 1.6 || e < -0.004) continue;
      float s = I.w;
      float prof = pow(max(0.0, 1.0 - u * u), 0.65) * (0.72 + 0.28 * sin(u * 2.7 + s * 7.0));
      prof += 0.45 * exp(-pow((u - (fract(s * 3.7) - 0.5)) * 3.2, 2.0));
      prof = prof * I.z * 0.72;
      prof += I.z * 0.07 * (vnoise(vec2(u * 38.0, s * 13.0)) - 0.5) * step(0.002, prof);
      prof = max(prof, 0.0015 * step(abs(u), 1.0));
      float cov = smoothstep(prof + 0.0007, prof - 0.0007, e) * smoothstep(1.2, 0.95, abs(u));
      if (cov <= 0.0) continue;
      float h = clamp(e / max(prof, 1e-4), 0.0, 1.0);
      float grain = vnoise(vec2(u * 70.0, e * 1100.0));
      vec3 forest = vec3(0.045, 0.13, 0.07) * (0.7 + 0.7 * grain);
      vec3 rock = vec3(0.30, 0.30, 0.27) * (0.7 + 0.5 * grain);
      vec3 sand = vec3(0.82, 0.76, 0.62);
      vec3 col = mix(forest, rock, smoothstep(0.55, 0.9, vnoise(vec2(u * 5.0, s * 3.0))) * 0.6);
      col = mix(sand, col, smoothstep(0.05, 0.16, h + 0.04 * (grain - 0.5)));
      col = mix(vec3(0.95), col, smoothstep(0.0, 0.035, h));  // surf line
      float side = clamp(0.5 + 0.9 * u * sign(mod(sunAz - I.x + PI, 2.0 * PI) - PI), 0.0, 1.0);
      col *= 0.7 + 0.6 * side;
      col = mix(col, uHorizon * 0.96, 0.3);                     // aerial haze
      acc = vec4(mix(acc.rgb, col, cov), max(acc.a, cov));
    }
    return acc;
  }

  vec3 skyCol(vec3 d) {
    float y = d.y;
    vec3 c = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.5));
    if (y < 0.0) c = uHorizon * 0.85;
    float s = max(dot(d, uSun), 0.0);
    if (y > 0.004) {
      vec2 p = d.xz / (y + 0.06) * 0.55 + vec2(uTime * 0.006, uTime * 0.002);
      float cl = fbm(p * 1.4) + 0.25 * fbm(p * 5.0) - 0.1;
      cl = smoothstep(0.52, 0.92, cl) * smoothstep(0.0, 0.18, y) * uClouds;
      vec3 cc = vec3(1.0, 1.0, 1.02) * (0.95 + 0.6 * pow(s, 6.0)) - vec3(0.18, 0.12, 0.04) * smoothstep(0.7, 1.1, cl);
      c = mix(c, cc * 1.2, cl * 0.9);
    }
    c += vec3(1.0, 0.95, 0.82) * (pow(s, 1400.0) * 60.0 + pow(s, 90.0) * 0.9 + pow(s, 8.0) * 0.18);
    vec4 isl = islands(d);
    c = mix(c, isl.rgb, isl.a);
    return c;
  }

  vec3 tonemap(vec3 x) {
    x *= 0.92;
    x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    return pow(x, vec3(1.0 / 2.2));
  }
`;

export const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const WATER_FRAGMENT = /* glsl */ `
  ${OCEAN_COMMON}
  uniform mat4 uInvViewProj;
  uniform vec3 uCam;
  uniform sampler2D uRipples;
  uniform float uRippleOn, uRippleExtent, uRippleSize;
  uniform vec4 uImpact[${MAX_IMPACTS}];
  uniform vec4 uImpactColor[${MAX_IMPACTS}];
  uniform vec4 uDrop;
  uniform vec3 uDropColor;
  varying vec2 vNdc;

  // Shallow near you, shelving away in every direction.
  float depthAt(vec2 xz) { return 0.5 + 0.16 * max(length(xz) - 2.0, 0.0) + 0.08 * (vnoise(xz * 0.5) - 0.5); }

  vec2 rippleUv(vec2 xz) { return xz / (2.0 * uRippleExtent) + 0.5; }
  float rippleH(vec2 uv) { return texture2D(uRipples, uv).r; }
  float rippleMask(vec2 uv) { vec2 e = min(uv, 1.0 - uv); return uRippleOn * smoothstep(0.0, 0.1, min(e.x, e.y)); }
  vec2 rippleGrad(vec2 xz) {
    vec2 uv = rippleUv(xz); float m = rippleMask(uv);
    if (m <= 0.0) return vec2(0.0);
    float tx = 1.0 / uRippleSize, w = 2.0 * uRippleExtent / uRippleSize;
    return vec2(rippleH(uv + vec2(tx, 0.0)) - rippleH(uv - vec2(tx, 0.0)), rippleH(uv + vec2(0.0, tx)) - rippleH(uv - vec2(0.0, tx))) / (2.0 * w) * m;
  }
  float rippleLap(vec2 xz) {
    vec2 uv = rippleUv(xz); float m = rippleMask(uv);
    if (m <= 0.0) return 0.0;
    float tx = 2.0 / uRippleSize;
    return (rippleH(uv + vec2(tx, 0.0)) + rippleH(uv - vec2(tx, 0.0)) + rippleH(uv + vec2(0.0, tx)) + rippleH(uv - vec2(0.0, tx)) - 4.0 * rippleH(uv)) * m;
  }
  vec2 ambGrad(vec2 p, float far) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a = 0.9 + fi * 2.39996;
      vec2 dir = vec2(cos(a), sin(a));
      float k = 2.6 * pow(1.62, fi);
      float amp = 0.0075 / pow(1.55, fi);
      float w = sqrt(9.81 * k);
      float fade = i > 3 ? (1.0 - far) : 1.0;
      g += dir * amp * k * cos(k * dot(dir, p) - w * uTime * 0.55 + fi * 1.7) * fade;
    }
    vec2 q = p * 7.0;
    g += (vec2(vnoise(q + uTime * 0.35), vnoise(q.yx + 3.1 - uTime * 0.3)) - 0.5) * 0.035 * (1.0 - far);
    return g;
  }
  vec3 stoneColor(float h) {
    vec3 c = vec3(0.22, 0.38, 0.62);
    c = mix(c, vec3(0.12, 0.22, 0.42), step(0.30, h));
    c = mix(c, vec3(0.40, 0.55, 0.72), step(0.50, h));
    c = mix(c, vec3(0.08, 0.14, 0.26), step(0.68, h));
    c = mix(c, vec3(0.24, 0.42, 0.64), step(0.80, h));
    c = mix(c, vec3(0.04, 0.07, 0.14), step(0.92, h));
    return c;
  }
  vec3 pebbles(vec2 p, float fw) {
    vec2 q = p * 8.5;
    vec2 ip = floor(q), fp = fract(q);
    float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.4 * sin(6.2831 * hash22(ip + g));
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = ip + g; } else if (d < d2) { d2 = d; }
    }
    float edge = sqrt(d2) - sqrt(d1);
    float h = hash21(id * 1.37);
    float stone = smoothstep(0.05, 0.2, edge + 0.06 * (vnoise(p * 30.0) - 0.5));
    float dome = pow(clamp(edge * 2.2, 0.0, 1.0), 0.6);
    vec3 sc = stoneColor(h) * (0.5 + 0.6 * dome) * (0.88 + 0.24 * vnoise(p * 38.0 + h * 20.0));
    vec3 sand = vec3(0.34, 0.47, 0.64) * (0.8 + 0.35 * vnoise(p * 60.0));
    vec3 col = mix(sand * 0.5, sc, stone);
    return mix(col, vec3(0.24, 0.35, 0.52), smoothstep(0.25, 0.9, fw * 8.5));
  }
  float caustic(vec2 uv) {
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p; float c = 1.0;
    for (int n = 0; n < 5; n++) {
      float t = uTime * 0.45 * (1.0 - 3.5 / float(n + 1));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / 0.005), p.y / (cos(i.y + t) / 0.005)));
    }
    c = 1.17 - pow(c / 5.0, 1.4);
    return pow(abs(c), 8.0);
  }

  void main() {
    vec4 wp = uInvViewProj * vec4(vNdc, 1.0, 1.0);
    vec3 rd = normalize(wp.xyz / wp.w - uCam);
    vec3 col;
    if (rd.y > -0.0015) {
      col = skyCol(rd);
    } else {
      float t = -uCam.y / rd.y;
      vec3 P = uCam + rd * t;
      float far = smoothstep(5.0, 28.0, t);
      vec2 g = ambGrad(P.xz, far) + rippleGrad(P.xz);
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
      float cosi = max(dot(-rd, N), 0.0);
      float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 R = reflect(rd, N);
      R.y = abs(R.y);
      vec3 refl = skyCol(R);

      vec3 rr = refract(rd, N, 0.7499);
      float DEPTH = depthAt(P.xz);
      float L = DEPTH / max(-rr.y, 0.06);
      vec3 B = P + rr * L;
      float fw = length(fwidth(B.xz));
      vec3 bed = pebbles(B.xz, fw);

      float cf = 1.0 - smoothstep(0.03, 0.2, fw * 3.0);
      vec2 cp = B.xz * 0.62 + g * 0.08;
      vec3 caus = vec3(caustic(cp + vec2(0.004, 0.0)), caustic(cp), caustic(cp - vec2(0.004, 0.0)));
      float focus = clamp(1.0 - rippleLap(B.xz - uSun.xz * 0.4) * 260.0, 0.25, 3.0);
      vec3 light = vec3(0.22, 0.36, 0.46) + vec3(1.0, 0.95, 0.85) * (0.45 + caus * 2.4 * cf) * focus;

      // A falling drop focuses a spot of its colour on the pebbles and casts a soft shadow.
      if (uDrop.w > 0.0) {
        float hgt = max(uDrop.y, 0.0) + DEPTH;
        float d = length(B.xz - (uDrop.xz - uSun.xz / uSun.y * hgt));
        light *= 1.0 - 0.35 * exp(-d * d / (0.02 + 0.01 * hgt));
        light += uDropColor * 2.5 * exp(-d * d / (0.0015 + 0.002 * hgt)) / (0.6 + hgt) * uDrop.w;
      }

      vec3 sigma = vec3(0.55, 0.12, 0.09);
      vec3 refr = bed * light * exp(-sigma * (L + DEPTH * 0.8));
      refr += vec3(0.0, 0.11, 0.17) * (1.0 - exp(-(L + DEPTH) * 0.35));

      vec3 glow = vec3(0.0);
      for (int i = 0; i < ${MAX_IMPACTS}; i++) {
        vec4 im = uImpact[i];
        float dt = uTime - im.z;
        if (im.w <= 0.0 || dt < 0.0 || dt > 5.0) continue;
        float d = length(P.xz - im.xy);
        float ring = exp(-pow((d - dt * 0.62) / (0.03 + dt * 0.05), 2.0)) * exp(-dt * 1.1);
        float bloom = exp(-d * d / (0.01 + dt * 0.09)) * exp(-dt * 0.75);
        vec4 ic = uImpactColor[i];
        refr += ic.rgb * (bloom * 0.45 + ring * 0.25) * im.w;
        glow += mix(ic.rgb, vec3(1.0), ic.a) * ring * 0.22 * im.w;
      }

      col = mix(refr, refl, F) + glow;
      col = mix(col, uHorizon, smoothstep(14.0, 70.0, t) * 0.75);
    }
    col *= 1.0 - 0.16 * dot(vNdc * 0.7, vNdc * 0.7);
    gl_FragColor = vec4(tonemap(col), 1.0);
  }
`;

/** Ripple height field: r = height, g = velocity. One step of the wave equation. */
export const RIPPLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const RIPPLE_STEP_FRAGMENT = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uDelta;
  uniform vec2 uShift;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv + uShift;
    vec4 info = texture2D(uTex, uv);
    vec2 dx = vec2(uDelta.x, 0.0), dy = vec2(0.0, uDelta.y);
    float avg = (texture2D(uTex, uv - dx).r + texture2D(uTex, uv + dx).r + texture2D(uTex, uv - dy).r + texture2D(uTex, uv + dy).r) * 0.25;
    info.g += (avg - info.r) * 2.0;
    float e = smoothstep(0.0, 0.14, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    info.g *= mix(0.9, 0.9955, e);
    info.r += info.g;
    info.r *= mix(0.95, 1.0, e);
    gl_FragColor = info;
  }
`;
export const RIPPLE_DROP_FRAGMENT = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uCenter;
  uniform float uRadius, uStrength;
  varying vec2 vUv;
  void main() {
    vec4 info = texture2D(uTex, vUv);
    float d = max(0.0, 1.0 - length(uCenter - vUv) / uRadius);
    info.r += (0.5 - cos(d * 3.14159265) * 0.5) * uStrength;
    gl_FragColor = info;
  }
`;

/** A water drop: squashed and stretched by its speed, sky seen through it upside down. */
export const DROP_VERTEX = /* glsl */ `
  uniform float uStretch;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 p = position;
    float s = uStretch;
    float inv = inversesqrt(s);
    float top = max(position.y, 0.0);
    float taper = max(1.0 - top * top * (s - 1.0) * 1.3, 0.15);
    float sy = position.y > 0.0 ? s : 1.0 + (s - 1.0) * 0.25;
    p.y *= sy;
    p.xz *= inv * taper;
    vec3 n = normalize(vec3(normal.x / (inv * taper), normal.y / sy, normal.z / (inv * taper)));
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
export const DROP_FRAGMENT = /* glsl */ `
  ${OCEAN_COMMON}
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 V = normalize(vW - cameraPosition);
    vec3 N = normalize(vN);
    float c = max(dot(-V, N), 0.0);
    float F = 0.04 + 0.96 * pow(1.0 - c, 4.0);
    vec3 refl = skyCol(reflect(V, N));
    vec3 rd = refract(V, N, 0.75);
    vec3 flip = vec3(rd.x, -rd.y, rd.z);
    vec3 behind = flip.y > 0.0 ? skyCol(flip) : mix(vec3(0.03, 0.30, 0.36), vec3(0.35, 0.62, 0.6), smoothstep(-1.0, 0.0, flip.y));
    vec3 body = mix(behind, uTint * 1.3, 0.4);
    float back = max(dot(N, -uSun), 0.0);
    body += uTint * pow(back, 5.0) * 1.8 + vec3(1.0) * pow(back, 40.0) * 2.0;
    vec3 col = mix(body, refl, F) + uTint * pow(1.0 - c, 2.5) * 0.4;
    float under = clamp(-vW.y / 0.08, 0.0, 1.0);
    gl_FragColor = vec4(tonemap(col), uOpacity * (1.0 - under));
  }
`;

/** Dolphins, fish and gulls: lit by the sun, countershaded, fading into the water below the surface. */
export const CREATURE_VERTEX = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
export const CREATURE_FRAGMENT = /* glsl */ `
  ${OCEAN_COMMON}
  uniform vec3 uTop, uBelly, uDeepTint;
  uniform float uShine;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 V = normalize(vW - cameraPosition);
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 base = mix(uBelly, uTop, smoothstep(-0.35, 0.35, N.y));
    float dif = max(dot(N, uSun), 0.0);
    vec3 col = base * (0.28 + 0.9 * dif) + base * uHorizon * 0.25;
    vec3 R = reflect(V, N);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
    col += skyCol(vec3(R.x, abs(R.y), R.z)) * F * uShine + vec3(1.0, 0.95, 0.85) * pow(max(dot(R, uSun), 0.0), 60.0) * uShine;
    float under = clamp(-vW.y / 0.45, 0.0, 1.0);
    col = mix(col, uDeepTint, under * 0.8);
    gl_FragColor = vec4(tonemap(col), 1.0 - under * under);
  }
`;
