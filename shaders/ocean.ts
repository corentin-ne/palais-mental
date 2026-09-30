/**
 * GLSL for the water. One full-screen pass: a ray from the eye meets the water, the normal
 * comes from a calm swell plus a ripple height field, the refracted ray lands on white sand and
 * coral lit by caustics, and the reflected ray sees the sky (islands included).
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
  // Volcanic green peaks, a jungle canopy with palm tufts, a white beach and a line of surf.
  float islandProfile(float u, float s, float h) {
    float c = (fract(s * 5.3) - 0.5) * 0.6;
    float peak = exp(-pow((u - c) * 2.1, 2.0)) * 0.85 + 0.2 * max(0.0, 1.0 - u * u);
    float side = 0.5 * exp(-pow((u - (fract(s * 3.7) - 0.5) * 1.3) * 3.4, 2.0));
    float prof = max(peak, side) * h;
    // Canopy: rounded crowns, and here and there a palm standing above them.
    float crowns = vnoise(vec2(u * 26.0, s * 13.0));
    float palm = pow(max(0.0, 1.0 - abs(fract(u * 9.0 + s * 4.0) - 0.5) * 9.0), 2.0) * step(0.55, hash21(vec2(floor(u * 9.0 + s * 4.0), s)));
    prof += h * (0.06 * crowns + 0.12 * palm) * smoothstep(0.02, 0.15, prof / max(h, 1e-4));
    return max(prof, 0.0018 * step(abs(u), 1.08));
  }

  vec4 islands(vec3 d) {
    float az = atan(d.x, -d.z);
    float e = d.y;
    vec4 acc = vec4(0.0);
    float sunAz = atan(uSun.x, -uSun.z);
    for (int i = 0; i < ${ISLAND_COUNT}; i++) {
      vec4 I = uIsland[i];
      float da = mod(az - I.x + PI, 2.0 * PI) - PI;
      float u = da / I.y;
      if (abs(u) > 1.2 || e > I.z * 1.7 || e < -0.004) continue;
      float prof = islandProfile(u, I.w, I.z);
      float cov = smoothstep(prof + 0.0006, prof - 0.0006, e) * smoothstep(1.15, 1.02, abs(u));
      if (cov <= 0.0) continue;
      float h = clamp(e / max(prof, 1e-4), 0.0, 1.0);
      float grain = vnoise(vec2(u * 90.0, e * 1400.0));
      float lit = clamp(0.5 + 0.8 * u * sign(mod(sunAz - I.x + PI, 2.0 * PI) - PI), 0.0, 1.0);
      vec3 jungle = mix(vec3(0.03, 0.22, 0.09), vec3(0.2, 0.55, 0.1), lit) * (0.75 + 0.5 * grain);
      jungle = mix(jungle, vec3(0.45, 0.62, 0.12), 0.25 * smoothstep(0.6, 1.0, h) * lit);   // sunlit crowns
      vec3 sand = vec3(1.0, 0.95, 0.82);
      vec3 col = mix(sand, jungle, smoothstep(0.07, 0.17, h + 0.05 * (grain - 0.5)));
      col = mix(vec3(1.1), col, smoothstep(0.0, 0.03, h));                                   // surf
      col = mix(col, uHorizon, 0.14);                                                       // a breath of haze
      acc = vec4(mix(acc.rgb, col, cov), max(acc.a, cov));
    }
    return acc;
  }

  // How close a heading is to an island (for the turquoise lagoons around them on the water).
  float lagoon(vec3 d) {
    float az = atan(d.x, -d.z);
    float m = 0.0;
    for (int i = 0; i < ${ISLAND_COUNT}; i++) {
      vec4 I = uIsland[i];
      float u = (mod(az - I.x + PI, 2.0 * PI) - PI) / I.y;
      m = max(m, smoothstep(1.6, 0.6, abs(u)));
    }
    return m;
  }

  // Clear tropical afternoon: deep azure overhead, luminous aqua at the horizon, a peach glow
  // toward the sun and a lavender blush opposite.
  vec3 skyGradient(vec3 d) {
    float y = max(d.y, 0.0);
    vec3 c = mix(uHorizon, vec3(0.16, 0.52, 0.98), smoothstep(0.0, 0.22, y));
    c = mix(c, uZenith, smoothstep(0.18, 0.95, y));
    vec2 hd = normalize(d.xz + 1e-5);
    float toward = dot(hd, normalize(uSun.xz)) * 0.5 + 0.5;
    float low = exp(-y * 7.0);
    c += vec3(1.0, 0.55, 0.3) * 0.32 * pow(toward, 3.0) * low;
    c += vec3(0.75, 0.5, 0.95) * 0.14 * pow(1.0 - toward, 2.0) * low;
    return c;
  }

  vec3 skyCol(vec3 d) {
    float y = d.y;
    vec3 c = skyGradient(d);
    float s = max(dot(d, uSun), 0.0);
    if (y > 0.004) {
      // Fair-weather cumulus: bright lit rims, soft lilac shade in the cores, gold near the sun.
      vec2 p = d.xz / (y + 0.06) * 0.5 + vec2(uTime * 0.006, uTime * 0.002);
      float dens = fbm(p * 1.3) + 0.3 * fbm(p * 4.5) - 0.12;
      float cl = smoothstep(0.52, 0.85, dens) * smoothstep(0.03, 0.26, y) * uClouds;
      float core = smoothstep(0.7, 1.1, dens);
      vec3 cc = mix(vec3(1.05, 1.02, 1.0), vec3(0.78, 0.74, 0.95), core * 0.7);
      cc += vec3(1.0, 0.72, 0.45) * pow(s, 5.0) * (0.6 + 0.6 * (1.0 - core));
      cc = mix(cc, vec3(1.0, 0.82, 0.86), 0.25 * exp(-y * 6.0));
      c = mix(c, cc * 1.12, cl * 0.92);
      // A few high cirrus veils.
      float ci = smoothstep(0.55, 0.9, fbm(vec2(p.x * 0.35, p.y * 2.2) + 7.0)) * smoothstep(0.05, 0.4, y) * 0.35 * uClouds;
      c = mix(c, vec3(1.0, 0.95, 0.98), ci);
    }
    c += vec3(1.0, 0.93, 0.78) * (pow(s, 1400.0) * 60.0 + pow(s, 90.0) * 0.9 + pow(s, 6.0) * 0.22);
    vec4 isl = islands(d);
    c = mix(c, isl.rgb, isl.a);
    return c;
  }

  vec3 tonemap(vec3 x) {
    x *= 0.92;
    float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
    x = max(mix(vec3(l), x, 1.18), 0.0);   // a little extra colour before the filmic curve eats it
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

  // A lagoon: shallow white sand around you, deepening gently toward the open sea.
  float depthAt(vec2 xz) {
    float r = length(xz);
    return 0.55 + 0.1 * max(r - 2.5, 0.0) + 0.012 * max(r - 8.0, 0.0) * max(r - 8.0, 0.0) + 0.07 * (vnoise(xz * 0.45) - 0.5);
  }

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
  // Calm swell. Each wave fades out once it gets smaller than a few pixels (fp = pixel footprint),
  // so the distance stays smooth instead of shimmering.
  vec2 ambGrad(vec2 p, float fp) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a = 0.9 + fi * 2.39996;
      vec2 dir = vec2(cos(a), sin(a));
      float k = 2.6 * pow(1.62, fi);
      float amp = 0.0068 / pow(1.55, fi);
      float w = sqrt(9.81 * k);
      float keep = 1.0 - smoothstep(0.25, 0.9, k * fp);
      g += dir * amp * k * cos(k * dot(dir, p) - w * uTime * 0.5 + fi * 1.7) * keep;
    }
    vec2 q = p * 7.0;
    g += (vec2(vnoise(q + uTime * 0.35), vnoise(q.yx + 3.1 - uTime * 0.3)) - 0.5) * 0.03 * (1.0 - smoothstep(0.02, 0.1, fp));
    return g;
  }

  // Coral heads: pink, coral, violet, sunflower, teal and lime, each a rounded dome with a
  // fine branching texture.
  vec3 coralColor(float h) {
    vec3 c = vec3(1.0, 0.42, 0.55);
    c = mix(c, vec3(1.0, 0.55, 0.25), step(0.18, h));
    c = mix(c, vec3(0.62, 0.35, 0.95), step(0.34, h));
    c = mix(c, vec3(1.0, 0.82, 0.25), step(0.5, h));
    c = mix(c, vec3(0.95, 0.5, 0.75), step(0.64, h));
    c = mix(c, vec3(0.6, 0.9, 0.3), step(0.78, h));
    c = mix(c, vec3(0.95, 0.35, 0.3), step(0.9, h));
    return c;
  }
  vec3 seabed(vec2 p, float fw) {
    // White sand, combed into soft ripples by the tide.
    float n = vnoise(p * 1.3);
    float ridge = 0.5 + 0.5 * sin(dot(p, vec2(0.8, 0.6)) * 9.0 + n * 6.0);
    float fine = 1.0 - smoothstep(0.02, 0.08, fw);
    vec3 sand = vec3(1.0, 0.96, 0.88) * (0.9 + 0.1 * ridge * fine) * (0.93 + 0.14 * vnoise(p * 50.0) * fine);
    sand = mix(sand, vec3(0.98, 0.86, 0.84), 0.3 * smoothstep(0.55, 0.8, vnoise(p * 0.35 + 4.0)));  // pale pink patches

    // Reef patches: coral heads gather in clusters, leaving open sand between them.
    float reef = smoothstep(0.62, 0.78, vnoise(p * 0.42 + 11.0) * 0.75 + vnoise(p * 1.1) * 0.35);
    if (reef <= 0.001) return sand;
    vec2 q = p * 5.0;
    vec2 ip = floor(q), fq = fract(q);
    float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.4 * sin(6.2831 * hash22(ip + g));
      vec2 r = g + o - fq;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = ip + g; } else if (d < d2) { d2 = d; }
    }
    float h = hash21(id * 1.37);
    float size = 0.22 + 0.2 * hash21(id + 7.7);
    float present = step(0.35, hash21(id + 3.1)) * reef;
    float rd1 = sqrt(d1) + 0.06 * (vnoise(p * 22.0 + h * 9.0) - 0.5);
    float head = smoothstep(size, size - 0.08, rd1) * present;
    float dome = sqrt(clamp(1.0 - rd1 / size, 0.0, 1.0));
    float branch = mix(1.0, 0.6 + 0.55 * vnoise(p * 60.0 + h * 30.0), fine);
    vec3 coral = coralColor(h) * (0.5 + 0.8 * dome) * branch;
    float shade = present * smoothstep(size + 0.12, size, rd1) * (1.0 - head);
    vec3 col = mix(sand * (1.0 - 0.35 * shade), coral, head);   // soft shade around each head
    return mix(col, mix(sand, vec3(0.75, 0.62, 0.7), 0.4 * reef), smoothstep(0.1, 0.5, fw * 5.0));
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
      float fp = length(fwidth(P.xz));
      vec2 g = ambGrad(P.xz, fp) + rippleGrad(P.xz);
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
      vec3 bed = seabed(B.xz, fw);

      float cf = 1.0 - smoothstep(0.03, 0.2, fw * 3.0);
      vec2 cp = B.xz * 0.62 + g * 0.08;
      vec3 caus = vec3(caustic(cp + vec2(0.004, 0.0)), caustic(cp), caustic(cp - vec2(0.004, 0.0)));
      float focus = clamp(1.0 - rippleLap(B.xz - uSun.xz * 0.4) * 260.0, 0.25, 3.0);
      vec3 light = vec3(0.16, 0.26, 0.32) + vec3(1.0, 0.95, 0.85) * (0.34 + caus * 1.3 * cf) * focus;

      // A falling drop focuses a spot of its colour on the sand and casts a soft shadow.
      if (uDrop.w > 0.0) {
        float hgt = max(uDrop.y, 0.0) + DEPTH;
        float d = length(B.xz - (uDrop.xz - uSun.xz / uSun.y * hgt));
        light *= 1.0 - 0.35 * exp(-d * d / (0.02 + 0.01 * hgt));
        light += uDropColor * 2.5 * exp(-d * d / (0.0015 + 0.002 * hgt)) / (0.6 + hgt) * uDrop.w;
      }

      // Crystal-clear water: reds fade first, so white sand turns turquoise, then lagoon blue.
      vec3 sigma = vec3(0.62, 0.13, 0.085);
      vec3 path = sigma * (L + DEPTH * 0.8);
      vec3 refr = bed * light * exp(-path);
      vec3 scatterCol = mix(vec3(0.01, 0.3, 0.4), vec3(0.005, 0.09, 0.3), smoothstep(0.9, 3.5, DEPTH));
      refr += scatterCol * (1.0 - exp(-(L + DEPTH) * 0.45));

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

      // Far away: shallow turquoise lagoons ring the islands, the rest is open-sea blue.
      float far = smoothstep(18.0, 90.0, t);
      vec3 open = mix(vec3(0.02, 0.16, 0.42), vec3(0.08, 0.62, 0.66), lagoon(rd) * smoothstep(40.0, 120.0, t));
      refr = mix(refr, open, far);

      col = mix(refr, refl, F) + glow;
      // Horizon haze takes the sky's own colour at that heading, never a flat grey.
      col = mix(col, skyGradient(normalize(vec3(rd.x, 0.0, rd.z))), smoothstep(80.0, 300.0, t) * 0.4);
    }
    col *= 1.0 - 0.14 * dot(vNdc * 0.7, vNdc * 0.7);
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
