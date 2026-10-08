import { StyleSheet, useColorScheme } from 'react-native';

import { NATIVE_BLUE, SparkTokens, alpha, mix, mixOklab, tokensFor } from '@/spark';
import { useLibrary } from '@/store/useLibrary';

/**
 * The app's theme, built on the Spark UI kit (`spark/`, vendored from spark-ui-kit/native): glass on an
 * aurora, one accent colour (yours, set in Settings) from which every decorative colour derives, fixed
 * data and state colours, system fonts, measured motion.
 *
 * Screens keep reading the same names (`palette.ink`, `palette.primary`, `type.title`…): this file maps
 * them onto the kit's tokens, so the whole app follows the kit and a token fix lands everywhere.
 * Components read tokens through `useTheme()` and build styles through `makeStyles()`.
 */
function paletteOf(t: SparkTokens) {
  const c = t.color;
  const deep = (x: string, w: number) => mix(x, c.bg, w);
  return {
    bg: c.bg,
    /** Screens are transparent over the aurora; this is the colour under it (status bar, scrims). */
    screen: c.bg,
    /** Cards and panels: translucent glass over the aurora. */
    surface: c.glass,
    surfaceRaised: c.glassStrong,
    ink: c.textPrimary,
    inkSoft: c.textSecondary,
    inkFaint: c.textMuted,
    hairline: c.glassBorder,
    field: c.field,
    fieldActive: c.surface3,
    glass: c.glass,
    glassStrong: c.glassStrong,
    glassEdge: c.glassBorder,
    /** The accent as a fill (buttons, progress, selected states). */
    primary: c.accent,
    /** The accent as text or icon on glass: clamped for AA contrast whatever the colour you pick. */
    primaryText: c.accentText,
    primaryDeep: c.accentHover,
    primaryTint: c.accentSoft,
    primaryRing: c.accentRing,
    primaryGlow: c.accentGlow,
    accent2: c.accent2,
    /** Text and glyphs on an accent fill. */
    onInk: c.onAccent,
    danger: c.criticalText,
    dangerSolid: c.critical,
    dangerTint: c.criticalSoft,
    success: t.dark ? c.goodText : c.good,
    successText: c.goodText,
    successTint: c.goodSoft,
    warning: c.warningText,
    warningTint: c.warningSoft,
    shadow: c.shadowColor,
    /** Behind images while they load: opaque, so a poster's shadow never shows through it. */
    placeholder: mix(c.textPrimary, c.bg, t.dark ? 0.08 : 0.07),
    hero: deep(c.accent, 0.25),
    scrimClear: alpha(c.bg, 0),
    scrimSoft: alpha(c.bg, 0.2),
    dimVeil: alpha(c.bg, 0.6),
    checkRing: c.glassBorderStrong,
    codeTag: 'rgba(0,0,0,0.55)',
    posterInk: c.textPrimary,
    /** Covers drawn for titles without art: decorative, so the accent family. */
    posterTints: [
      [deep(c.accent, t.dark ? 0.42 : 0.3), deep(c.accent, t.dark ? 0.2 : 0.55)],
      [deep(c.accent2, t.dark ? 0.42 : 0.3), deep(c.accent2, t.dark ? 0.2 : 0.55)],
      [deep(c.accent3, t.dark ? 0.42 : 0.3), deep(c.accent3, t.dark ? 0.2 : 0.55)],
      [deep(mixOklab(c.accent, c.accent2, 0.5), t.dark ? 0.4 : 0.3), deep(c.accent2, t.dark ? 0.18 : 0.5)],
      [deep(mixOklab(c.accent, c.accent3, 0.5), t.dark ? 0.4 : 0.3), deep(c.accent3, t.dark ? 0.18 : 0.5)],
    ] as [string, string][],
  };
}
export type Palette = ReturnType<typeof paletteOf>;

/** System fonts (SF Pro, Roboto), as the kit's `system-ui`: spread into a style (`...fonts.semibold`). */
const fonts = {
  display: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  body: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  /** Quotes and drawn covers: the system italic (the kit has no serif). */
  displayItalic: { fontWeight: '500', fontStyle: 'italic' },
} as const;
export type Fonts = typeof fonts;

function build(spark: SparkTokens) {
  const palette = paletteOf(spark);
  const k = spark.type;
  /** The kit's phone type scale under the names the screens use. */
  const type = {
    display: { ...k.pageTitle, color: palette.ink },
    hero: { ...k.heroTitle, color: palette.ink },
    title: { ...k.section, color: palette.ink },
    heading: { ...k.cardTitle, fontSize: 17, lineHeight: 22, color: palette.ink },
    body: { ...k.body, color: palette.ink },
    bodyMedium: { ...k.body, fontWeight: '500' as const, color: palette.ink },
    small: { ...k.small, color: palette.inkSoft },
    /** The line under a page title (greeting): secondary text, a size up. */
    serif: { fontSize: 16, lineHeight: 21, fontWeight: '500' as const, color: palette.inkSoft },
    label: { ...k.eyebrow, color: palette.inkFaint },
    button: { ...k.button },
  };
  const shadow = {
    /** Cards are translucent glass: no shadow (it would show through them), depth comes from the edge. */
    soft: spark.shadow.none,
    /** Opaque floating things only (solid buttons, sheets). */
    lifted: spark.shadow.glassLg,
    /** Under posters and artwork, which are opaque. */
    cover: { ...spark.shadow.glass, shadowOpacity: spark.dark ? 0.5 : 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  };
  return {
    name: spark.scheme,
    dark: spark.dark,
    spark,
    palette,
    fonts,
    type,
    shadow,
    radii: { xs: spark.radius.xs, sm: spark.radius.sm, md: spark.radius.md, lg: spark.radius.lg, xl: spark.radius.xl, pill: spark.radius.full },
    /** Floating bars: blurred where the platform can (iOS, web), else `solid` (Android, lite) so nothing reads through. */
    glass: { blur: spark.blur.intensity, androidBlur: spark.blur.intensity, tint: spark.blur.tint, supported: spark.blur.supported, solid: spark.blur.solid },
    /** Motion vocabulary shared by every animated surface (kit §2.8). */
    motion: {
      spring: spark.motion.spring,
      fast: spark.motion.fast,
      base: spark.motion.medium,
      slow: spark.motion.entrance,
      stagger: spark.motion.stagger,
    },
  };
}

export type Theme = ReturnType<typeof build>;
export type StyleName = Theme['name'];

const themes = new WeakMap<SparkTokens, Theme>();
export function themeFor(spark: SparkTokens): Theme {
  let theme = themes.get(spark);
  if (!theme) {
    theme = build(spark);
    themes.set(spark, theme);
  }
  return theme;
}

/** The kit options from the settings: appearance (or the system), your accent, the display quality. */
export function useSparkOptions() {
  const system = useColorScheme();
  const appearance = useLibrary((s) => s.settings.appearance);
  const accent = useLibrary((s) => s.settings.accent) || NATIVE_BLUE;
  const lite = useLibrary((s) => s.settings.fx === 'lite');
  const scheme: 'light' | 'dark' = appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;
  return { scheme, accent, lite };
}

/** Follows the appearance setting, or the system when set to 'system' (dark when the system can't say). */
export function useTheme(): Theme {
  return themeFor(tokensFor(useSparkOptions()));
}

/** Style factory, created once per theme (appearance × accent × quality) and cached. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}

/** Web draws a focus ring around text inputs; our fields carry their own focus styling. */
export const noOutline = { outlineWidth: 0 } as object;
