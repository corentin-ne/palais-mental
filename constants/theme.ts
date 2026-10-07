import { StyleSheet, useColorScheme } from 'react-native';

import { useLibrary } from '@/store/useLibrary';

/**
 * Design tokens. Crisp and marine: pale sky-blue paper and deep navy ink by day, a deep
 * night-sea by night, ocean-blue actions in both, and the artwork as the colour.
 * Components read tokens through `useTheme()` and build styles through `makeStyles()`.
 */
const light = {
  bg: '#EAF3FB',
  screen: '#EAF3FB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#0A2540',
  inkSoft: 'rgba(10,37,64,0.62)',
  inkFaint: 'rgba(10,37,64,0.4)',
  hairline: 'rgba(10,37,64,0.09)',
  field: 'rgba(10,37,64,0.05)',
  fieldActive: 'rgba(10,37,64,0.09)',
  glass: 'rgba(244,250,255,0.72)',
  glassStrong: 'rgba(248,252,255,0.94)',
  glassEdge: 'rgba(255,255,255,0.9)',
  primary: '#0B63CE',
  primaryDeep: '#084C9E',
  primaryTint: 'rgba(11,99,206,0.1)',
  onInk: '#FFFFFF',
  danger: '#D2462F',
  dangerTint: 'rgba(210,70,47,0.09)',
  success: '#2F9E6A',
  successTint: 'rgba(47,158,106,0.12)',
  shadow: '#0A2A55',
  placeholder: '#DCE8F4',
  hero: '#C9DDF1',
  scrimClear: 'rgba(234,243,251,0)',
  scrimSoft: 'rgba(234,243,251,0.15)',
  dimVeil: 'rgba(234,243,251,0.6)',
  checkRing: 'rgba(10,37,64,0.22)',
  codeTag: 'rgba(10,37,64,0.72)',
  posterInk: 'rgba(10,37,64,0.82)',
  posterTints: [
    ['#CFE3F7', '#9CC3EC'],
    ['#D9E6F2', '#AFC7E0'],
    ['#D3EEF0', '#97CFD6'],
    ['#E2DDF4', '#B9AEE3'],
    ['#F3E3D3', '#E3BE98'],
  ] as [string, string][],
};

const dark: typeof light = {
  bg: '#061423',
  screen: '#061423',
  surface: '#0E2238',
  surfaceRaised: '#132B45',
  ink: '#EAF3FB',
  inkSoft: 'rgba(234,243,251,0.66)',
  inkFaint: 'rgba(234,243,251,0.4)',
  hairline: 'rgba(234,243,251,0.08)',
  field: 'rgba(234,243,251,0.07)',
  fieldActive: 'rgba(234,243,251,0.12)',
  glass: 'rgba(10,28,48,0.72)',
  glassStrong: 'rgba(12,30,52,0.94)',
  glassEdge: 'rgba(255,255,255,0.08)',
  primary: '#3D8BFF',
  primaryDeep: '#2A6FD6',
  primaryTint: 'rgba(61,139,255,0.16)',
  onInk: '#FFFFFF',
  danger: '#FF6B52',
  dangerTint: 'rgba(255,107,82,0.14)',
  success: '#45C68A',
  successTint: 'rgba(69,198,138,0.16)',
  shadow: '#000000',
  placeholder: '#16304D',
  hero: '#0F2740',
  scrimClear: 'rgba(6,20,35,0)',
  scrimSoft: 'rgba(6,20,35,0.25)',
  dimVeil: 'rgba(6,20,35,0.6)',
  checkRing: 'rgba(234,243,251,0.28)',
  codeTag: 'rgba(0,0,0,0.6)',
  posterInk: 'rgba(234,243,251,0.88)',
  posterTints: [
    ['#173A5E', '#0F2742'],
    ['#1C3550', '#11253B'],
    ['#123F47', '#0B2A31'],
    ['#2A2752', '#181838'],
    ['#4A3424', '#2B1E15'],
  ],
};
export type Palette = typeof light;

const fonts = {
  display: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  displayLight: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
};
export type Fonts = typeof fonts;

function build(name: 'light' | 'dark', palette: Palette) {
  const isDark = name === 'dark';
  /** Type scale. Big, tight headlines; calm 15px body. */
  const type = {
    display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, letterSpacing: -1.2, color: palette.ink },
    hero: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.9, color: palette.ink },
    title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.6, color: palette.ink },
    heading: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.3, color: palette.ink },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.ink },
    bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: palette.ink },
    small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: palette.inkSoft },
    serif: { fontFamily: fonts.displayItalic, fontSize: 17, lineHeight: 22, color: palette.inkSoft },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.9,
      textTransform: 'uppercase' as const,
      color: palette.inkFaint,
    },
    button: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.1 },
  };
  const shadow = {
    soft: { shadowColor: palette.shadow, shadowOpacity: isDark ? 0.35 : 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
    lifted: { shadowColor: palette.shadow, shadowOpacity: isDark ? 0.45 : 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
    cover: { shadowColor: palette.shadow, shadowOpacity: isDark ? 0.4 : 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  };
  return {
    name,
    dark: isDark,
    palette,
    fonts,
    type,
    shadow,
    radii: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
    glass: { blur: 45, androidBlur: 32, tint: (isDark ? 'dark' : 'light') as 'dark' | 'light' },
    /** Motion vocabulary shared by every animated surface. */
    motion: {
      spring: { damping: 18, stiffness: 220, mass: 0.9 },
      fast: 160,
      base: 260,
      slow: 420,
      stagger: 38,
    },
  };
}

export type Theme = ReturnType<typeof build>;
export type StyleName = Theme['name'];
export const themes: Record<StyleName, Theme> = { light: build('light', light), dark: build('dark', dark) };

/** Follows the appearance setting, or the system when set to 'system'. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const appearance = useLibrary((s) => s.settings.appearance);
  const name = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  return themes[name];
}

/** Style factory per theme, created once per theme and cached. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new Map<StyleName, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme.name);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme.name, styles);
    }
    return styles;
  };
}

/** Web draws a focus ring around text inputs; our fields carry their own focus styling. */
export const noOutline = { outlineWidth: 0 } as object;
