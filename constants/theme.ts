import { StyleSheet } from 'react-native';

/**
 * Design tokens. Editorial and crisp: near-white paper, near-black ink, and the cover
 * art as the colour. Components read tokens through `useTheme()` and build styles
 * through `makeStyles()`, so a future style only needs a second token set.
 */
const palette = {
  bg: '#FAF9F6',
  screen: '#FAF9F6',
  surface: '#FFFFFF',
  ink: '#161412',
  inkSoft: 'rgba(22,20,18,0.6)',
  inkFaint: 'rgba(22,20,18,0.38)',
  hairline: 'rgba(22,20,18,0.08)',
  field: 'rgba(22,20,18,0.045)',
  fieldActive: 'rgba(22,20,18,0.085)',
  glass: 'rgba(255,255,255,0.7)',
  glassStrong: 'rgba(255,255,255,0.94)',
  glassEdge: 'rgba(255,255,255,0.9)',
  primary: '#161412',
  primaryDeep: '#161412',
  onInk: '#FFFFFF',
  star: '#F2A93B',
  danger: '#D2462F',
  dangerTint: 'rgba(210,70,47,0.09)',
  success: '#2F9E6A',
  shadow: '#2B1E14',
};
export type Palette = typeof palette;

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
  soft: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  lifted: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cover: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
};

const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

const editorial = {
  name: 'editorial' as const,
  palette,
  fonts,
  type,
  shadow,
  radii,
  glass: { blur: 45, androidBlur: 32 },
  /** Motion vocabulary shared by every animated surface. */
  motion: {
    spring: { damping: 18, stiffness: 220, mass: 0.9 },
    fast: 160,
    base: 260,
    slow: 420,
    stagger: 38,
  },
};

export type Theme = typeof editorial;
export type StyleName = Theme['name'];
export const themes: Record<StyleName, Theme> = { editorial };

/** One style for now; kept behind a hook so more can be added without touching components. */
export function useTheme(): Theme {
  return editorial;
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
