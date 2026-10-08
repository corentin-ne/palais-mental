/**
 * Spark UI kit · native/tokens.ts
 * The design tokens of css/foundation/tokens.css for React Native, plus the phone metrics.
 * One function builds every token from three inputs: the theme, the accent colour (the hub colour on
 * the web; the app's or the user's choice on a phone) and the display quality. Same values, same names
 * in camelCase (`--glass-border-strong` → `glassBorderStrong`), so a fix in tokens.css is easy to carry over.
 */
import { Platform } from 'react-native';

import { alpha, mix, mixOklab, rotate, toOklch, withLightness } from './color';

export type Scheme = 'dark' | 'light';

export interface TokenOptions {
  scheme: Scheme;
  /** The accent (`--accent-base`). Default: the native blue. */
  accent?: string;
  /** Lite rendering (`data-fx="lite"`): opaque surfaces, no blur, short shadows, no glow, no looping motion. */
  lite?: boolean;
  /** More contrast (`prefers-contrast: more`): opaque glass, firmer borders and secondary text. */
  contrast?: boolean;
  /** Reduced motion: every duration becomes 1 ms, entrances and loops are off. */
  reduceMotion?: boolean;
}

export const NATIVE_BLUE = '#3987e5';

/** Shadow for `style={…}` (iOS shadow* + Android elevation): the kit's glass shadows, phone-sized. */
export interface Shadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

/** A text style without colour: components pick the colour token. */
export interface TextStyleToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

export function createTokens({ scheme, accent: accentBase = NATIVE_BLUE, lite = false, contrast = false, reduceMotion = false }: TokenOptions) {
  const dark = scheme === 'dark';

  // ---------------------------------------------------------------- accent family (§2.2)
  const accent = dark ? accentBase : mixOklab(accentBase, '#000000', 0.86);
  const accent2 = rotate(accent, 38);
  const accent3 = rotate(accent, -70);
  const onAccent = toOklch(accent).l < 0.63 ? '#ffffff' : '#141619';
  const accentText = dark ? withLightness(accent, 0.74, 1) : withLightness(accent, 0, 0.5);

  // ---------------------------------------------------------------- surfaces and text (§2.1)
  const base = dark
    ? {
        bg: '#070a12',
        glass: 'rgba(20, 25, 38, 0.52)',
        glassStrong: 'rgba(24, 29, 44, 0.82)',
        glassSubtle: 'rgba(255, 255, 255, 0.04)',
        glassHover: 'rgba(255, 255, 255, 0.07)',
        glassActive: 'rgba(255, 255, 255, 0.10)',
        glassBorder: 'rgba(255, 255, 255, 0.09)',
        glassBorderStrong: 'rgba(255, 255, 255, 0.16)',
        glassHighlight: 'rgba(255, 255, 255, 0.07)',
        surface1: '#141926',
        surface2: 'rgba(255, 255, 255, 0.05)',
        surface3: 'rgba(255, 255, 255, 0.10)',
        field: 'rgba(255, 255, 255, 0.045)',
        fieldBorder: 'rgba(255, 255, 255, 0.11)',
        textPrimary: '#f3f5fa',
        textSecondary: '#b3bacb',
        textMuted: '#7f8799',
        grid: 'rgba(255, 255, 255, 0.06)',
        axis: 'rgba(255, 255, 255, 0.16)',
        shadowColor: '#000000',
      }
    : {
        bg: '#e9edf5',
        glass: 'rgba(255, 255, 255, 0.52)',
        glassStrong: 'rgba(255, 255, 255, 0.84)',
        glassSubtle: 'rgba(255, 255, 255, 0.45)',
        glassHover: 'rgba(255, 255, 255, 0.70)',
        glassActive: 'rgba(255, 255, 255, 0.92)',
        glassBorder: 'rgba(255, 255, 255, 0.75)',
        glassBorderStrong: 'rgba(15, 23, 42, 0.12)',
        glassHighlight: 'rgba(255, 255, 255, 0.9)',
        surface1: '#f7f9fc',
        surface2: 'rgba(15, 23, 42, 0.04)',
        surface3: 'rgba(15, 23, 42, 0.08)',
        field: 'rgba(255, 255, 255, 0.72)',
        fieldBorder: 'rgba(15, 23, 42, 0.12)',
        textPrimary: '#0f172a',
        textSecondary: '#46506a',
        textMuted: '#687189',
        grid: 'rgba(15, 23, 42, 0.07)',
        axis: 'rgba(15, 23, 42, 0.18)',
        shadowColor: '#1e295a',
      };
  // Lite and more-contrast: opaque glass (adaptation/lite.css, adaptation/accessibility.css).
  if (lite || contrast) {
    const opaque = dark ? base.surface1 : '#ffffff';
    base.glass = opaque;
    base.glassStrong = opaque;
    if (!dark) base.glassBorder = 'rgba(15, 23, 42, 0.09)';
  }
  if (contrast) {
    Object.assign(
      base,
      dark
        ? { glassBorder: 'rgba(255, 255, 255, 0.26)', glassBorderStrong: 'rgba(255, 255, 255, 0.4)', fieldBorder: 'rgba(255, 255, 255, 0.4)', textSecondary: '#d5dae6', textMuted: '#b3bacb' }
        : { glassBorder: 'rgba(15, 23, 42, 0.28)', glassBorderStrong: 'rgba(15, 23, 42, 0.45)', fieldBorder: 'rgba(15, 23, 42, 0.45)', textSecondary: '#2b3347', textMuted: '#46506a' },
    );
  }

  // ---------------------------------------------------------------- data colours never follow the accent (§2.3)
  const series = dark
    ? ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
    : ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const states = dark
    ? { good: '#0ca30c', goodText: '#34c759', warning: '#fab219', warningText: '#fab219', serious: '#ec835a', seriousText: '#ec835a', critical: '#d03b3b', criticalText: '#f07474',
        goodSoft: 'rgba(12, 163, 12, 0.14)', warningSoft: 'rgba(250, 178, 25, 0.13)', seriousSoft: 'rgba(236, 131, 90, 0.14)', criticalSoft: 'rgba(208, 59, 59, 0.16)' }
    : { good: '#0ca30c', goodText: '#006300', warning: '#fab219', warningText: '#8a5d00', serious: '#ec835a', seriousText: '#a8491f', critical: '#d03b3b', criticalText: '#b42f2f',
        goodSoft: 'rgba(12, 163, 12, 0.10)', warningSoft: 'rgba(250, 178, 25, 0.16)', seriousSoft: 'rgba(236, 131, 90, 0.15)', criticalSoft: 'rgba(208, 59, 59, 0.10)' };

  const color = {
    ...base,
    accent,
    accent2,
    accent3,
    accentHover: dark ? mixOklab(accent, '#ffffff', 0.84) : mixOklab(accent, '#000000', 0.88),
    accentSoft: alpha(accent, dark ? 0.16 : 0.12),
    accentRing: alpha(accent, dark ? 0.45 : 0.4),
    accentGlow: lite ? 'transparent' : alpha(accent, dark ? 0.55 : 0.4),
    onAccent,
    /** Glyph on accent tiles (brand mark, empty-state tile): always white. */
    onMark: '#ffffff',
    accentText,
    press: alpha(accent, dark ? 0.32 : 0.22),
    /** The soft aurora behind the glass (`--aurora-1…3`). */
    aurora: dark
      ? [alpha(accent, 0.36), alpha(accent2, 0.28), alpha(accent3, 0.2)]
      : [alpha(mixOklab(accentBase, '#ffffff', 0.8), 0.32), alpha(mixOklab(accent2, '#ffffff', 0.8), 0.26), alpha(mixOklab(accent3, '#ffffff', 0.8), 0.2)],
    /** The primary button fill: accent → accent mixed toward accent-2. */
    primaryGradient: [accent, mix(accent, accent2, 0.55)] as [string, string],
    series,
    ...states,
  };

  // ---------------------------------------------------------------- shape, type, motion
  const shadow = (opacity: number, radius: number, y: number, elevation: number): Shadow => ({
    shadowColor: base.shadowColor,
    shadowOpacity: lite ? Math.min(opacity, dark ? 0.28 : 0.1) : opacity,
    shadowRadius: lite ? Math.min(radius, 6) : radius,
    shadowOffset: { width: 0, height: lite ? Math.min(y, 2) : y },
    elevation: lite ? Math.min(elevation, 2) : elevation,
  });
  const ms = (v: number) => (reduceMotion ? 1 : v);

  return {
    scheme,
    dark,
    lite,
    contrast,
    reduceMotion,
    accentBase,
    color,
    space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const,
    radius: { xs: 8, sm: 10, md: 14, lg: 20, xl: 24, full: 999 } as const,
    /**
     * Phone type scale. The web scale (page 30, section 17, card 15, body 14) is read at arm's length on a
     * desk; on a phone the body goes to 15 and sections to 20, titles keep their tight tracking.
     * System fonts (SF Pro, Roboto) stand in for Segoe UI Variable, as `system-ui` does on the web.
     */
    type: {
      pageTitle: { fontSize: 30, lineHeight: 35, fontWeight: '700', letterSpacing: -0.6 },
      heroTitle: { fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5 },
      section: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
      cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.2 },
      body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
      bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
      small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
      tiny: { fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
      eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.9, textTransform: 'uppercase' },
      figure: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.8 },
      button: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
    } satisfies Record<string, TextStyleToken>,
    /** Composited motion only (transform, opacity). Durations from §2.8. */
    motion: {
      fast: ms(140),
      medium: ms(240),
      entrance: ms(360),
      stagger: reduceMotion ? 0 : 40,
      /** Press: scale to 0.97 (buttons) or 0.98 (large surfaces), spring back. */
      pressScale: 0.97,
      spring: { damping: 18, stiffness: 260, mass: 0.8 },
      /** `--ease` for Animated.timing / Easing.bezier. */
      ease: [0.2, 0.8, 0.2, 1] as const,
      loops: !lite && !reduceMotion,
    },
    /**
     * Shadows draw under the whole box, so behind translucent glass they show through it (a grey cast, and on
     * Android an inner rectangle). `glass` is for opaque or near-opaque surfaces only (floating layers, lite);
     * translucent cards take their depth from the border and the top highlight instead.
     */
    shadow: {
      glass: shadow(dark ? 0.45 : 0.16, 18, 10, 4),
      glassLg: shadow(dark ? 0.6 : 0.26, 32, 18, 10),
      none: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 } as Shadow,
      glow: lite ? shadow(0, 0, 0, 0) : { ...shadow(0.5, 14, 6, 6), shadowColor: accent },
    },
    /** Blur strengths for expo-blur (0–100) on floating layers; lite turns blur off. */
    /**
     * Blur strengths for expo-blur (0–100) on floating layers. Android blurs only content wrapped in a blur
     * target, which a navigator can't be: there (and in lite rendering) floating layers are near-opaque instead.
     */
    blur: {
      intensity: lite ? 0 : 40,
      strong: lite ? 0 : 60,
      tint: (dark ? 'dark' : 'light') as 'dark' | 'light',
      supported: !lite && Platform.OS !== 'android',
      /** The fill of a floating layer that can't blur: nothing behind reads through it. */
      // Fully opaque: Android lets bright text read through even a 97 % fill.
      solid: dark ? '#161b28' : '#f8fafd',
    },
    /**
     * Phone metrics. Targets are 44 pt (Apple HIG) / 48 dp (Material): WCAG's 24 px is a floor, not a size.
     * Control heights: lg 50 (main action), md 44 (default), sm 36 (in rows), xs 30 (dense chips, still in a 44 hit area).
     */
    phone: {
      target: 44,
      control: { lg: 50, md: 44, sm: 36, xs: 30 } as const,
      gutter: 20,
      gutterWide: 32,
      /** Content column on tablets and the web build. */
      maxContent: 1120,
      tabBar: 64,
    },
  };
}

export type SparkTokens = ReturnType<typeof createTokens>;
