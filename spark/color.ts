/**
 * Spark UI kit · native/color.ts
 * Colour maths for React Native, which has no `color-mix()` or relative `oklch(from …)` colours:
 * the same derivations as css/foundation/tokens.css, computed once per theme and accent.
 */

export type RGBA = { r: number; g: number; b: number; a: number };

/** "#3987e5", "#38e", "#3987e5cc", "rgb(…)", "rgba(…)". Unknown input gives the native blue. */
export function parse(input: string): RGBA {
  const s = input.trim();
  const hex = s.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const [r, g, b, a] = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a: a ?? 1 };
  }
  return { r: 57, g: 135, b: 229, a: 1 };
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const to255 = (v: number) => Math.round(clamp(v, 0, 255));

export function format({ r, g, b, a }: RGBA): string {
  if (a >= 1) return `#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${Math.round(clamp(a) * 1000) / 1000})`;
}

/** The colour at `alpha` opacity (`color-mix(in srgb, c x%, transparent)`). */
export const alpha = (c: string, a: number) => format({ ...parse(c), a: parse(c).a * a });

/** `color-mix(in srgb, a w, b)`: `w` of `a`, the rest of `b`, alpha included. */
export function mix(a: string, b: string, w: number): string {
  const x = parse(a);
  const y = parse(b);
  return format({ r: x.r * w + y.r * (1 - w), g: x.g * w + y.g * (1 - w), b: x.b * w + y.b * (1 - w), a: x.a * w + y.a * (1 - w) });
}

// ------------------------------------------------------------------ OKLab / OKLCH
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const gam = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export type OKLCH = { l: number; c: number; h: number; a: number };

export function toOklch(input: string): OKLCH {
  const { r, g, b, a } = parse(input);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(Bb, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, Bb), h: (h + 360) % 360, a };
}

function oklchToRgb({ l, c, h }: OKLCH) {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const M = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const S = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
}

/** OKLCH → sRGB; out-of-gamut colours lose chroma (not hue or lightness) until they fit, as browsers do. */
export function fromOklch(o: OKLCH): string {
  let c = o.c;
  let rgb = oklchToRgb({ ...o, c });
  for (let i = 0; i < 24 && rgb.some((v) => v < -0.0005 || v > 1.0005); i++) {
    c *= 0.9;
    rgb = oklchToRgb({ ...o, c });
  }
  return format({ r: gam(clamp(rgb[0])), g: gam(clamp(rgb[1])), b: gam(clamp(rgb[2])), a: o.a });
}

/** `oklch(from c l c calc(h + deg))`. */
export const rotate = (c: string, deg: number) => {
  const o = toOklch(c);
  return fromOklch({ ...o, h: (o.h + deg + 360) % 360 });
};

/** `color-mix(in oklab, a w, b)`. */
export function mixOklab(a: string, b: string, w: number): string {
  const x = toOklch(a);
  const y = toOklch(b);
  const xa = x.c * Math.cos((x.h * Math.PI) / 180);
  const xb = x.c * Math.sin((x.h * Math.PI) / 180);
  const ya = y.c * Math.cos((y.h * Math.PI) / 180);
  const yb = y.c * Math.sin((y.h * Math.PI) / 180);
  const L = x.l * w + y.l * (1 - w);
  const A = xa * w + ya * (1 - w);
  const B = xb * w + yb * (1 - w);
  return fromOklch({ l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, a: x.a * w + y.a * (1 - w) });
}

/** Lightness clamped between `min` and `max` (`oklch(from c clamp(…) c h)`), chroma and hue kept. */
export const withLightness = (c: string, min: number, max: number) => {
  const o = toOklch(c);
  return fromOklch({ ...o, l: clamp(o.l, min, max) });
};

/** WCAG 2 contrast ratio between two opaque colours. */
export function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const { r, g, b: bl } = parse(c);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
