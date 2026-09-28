import { StyleSheet } from 'react-native';

import { usePalaceStore } from '@/store/usePalaceStore';

/**
 * Two complete experiences share one codebase:
 *
 *  - editorial — crisp paper and ink; the cover art is the only colour.
 *  - aero      — Frutiger Aero, distilled: a luminous sky, frosted glass with a
 *                glossy sheen, aqua gel buttons, bubbles and reflections. Nostalgic
 *                but minimal: one sky, one glass, one accent.
 *
 * Components read tokens through `useTheme()` and build styles through `makeStyles()`,
 * so switching style re-renders the whole app with no restart.
 */
export type StyleName = 'editorial' | 'aero';

const editorialPalette = {
  bg: '#FAF9F6',
  /** Background of tab screens (Aero lets its sky show through). */
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
  shadow: '#2B1E14',
};

export type Palette = typeof editorialPalette;

const aeroPalette: Palette = {
  bg: '#D9EFFB',
  screen: 'transparent',
  surface: 'rgba(255,255,255,0.55)',
  ink: '#0C2B40',
  inkSoft: 'rgba(12,43,64,0.66)',
  inkFaint: 'rgba(12,43,64,0.42)',
  hairline: 'rgba(255,255,255,0.7)',
  field: 'rgba(255,255,255,0.46)',
  fieldActive: 'rgba(255,255,255,0.78)',
  glass: 'rgba(255,255,255,0.34)',
  glassStrong: 'rgba(255,255,255,0.6)',
  glassEdge: 'rgba(255,255,255,0.95)',
  primary: '#1AA6EA',
  primaryDeep: '#0B69BF',
  onInk: '#FFFFFF',
  star: '#FFB627',
  danger: '#E0473A',
  dangerTint: 'rgba(224,71,58,0.12)',
  shadow: '#0B4A7A',
};

const editorialFonts = {
  display: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  displayLight: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
};
export type Fonts = typeof editorialFonts;

/** Open Sans: the humanist sans closest in spirit to Frutiger/Segoe; big titles set light. */
const aeroFonts: Fonts = {
  display: 'OpenSans_600SemiBold',
  bold: 'OpenSans_300Light',
  displayLight: 'OpenSans_300Light',
  displayItalic: 'OpenSans_400Regular_Italic',
  body: 'OpenSans_400Regular',
  medium: 'OpenSans_500Medium',
  semibold: 'OpenSans_600SemiBold',
};

function buildType(palette: Palette, fonts: Fonts, aero: boolean) {
  return {
    display: aero
      ? { fontFamily: fonts.displayLight, fontSize: 36, lineHeight: 42, letterSpacing: -0.8, color: palette.ink }
      : { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, letterSpacing: -1.2, color: palette.ink },
    hero: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: aero ? -0.5 : -0.9, color: palette.ink },
    title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: aero ? -0.3 : -0.6, color: palette.ink },
    heading: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: aero ? -0.1 : -0.3, color: palette.ink },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.ink },
    bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: palette.ink },
    small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: palette.inkSoft },
    serif: aero
      ? { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: palette.inkSoft }
      : { fontFamily: fonts.displayItalic, fontSize: 17, lineHeight: 22, color: palette.inkSoft },
    label: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.9,
      textTransform: 'uppercase' as const,
      color: palette.inkFaint,
    },
    button: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: aero ? 0.1 : -0.1 },
  };
}

function buildShadow(palette: Palette, aero: boolean) {
  return {
    soft: {
      shadowColor: palette.shadow,
      shadowOpacity: aero ? 0.16 : 0.1,
      shadowRadius: aero ? 24 : 20,
      shadowOffset: { width: 0, height: aero ? 10 : 8 },
      elevation: 5,
    },
    lifted: {
      shadowColor: aero ? palette.primaryDeep : palette.shadow,
      shadowOpacity: aero ? 0.4 : 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    cover: {
      shadowColor: palette.shadow,
      shadowOpacity: aero ? 0.24 : 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },
  };
}

const makeTheme = (name: StyleName, palette: Palette, fonts: Fonts) => {
  const aero = name === 'aero';
  return {
    name,
    aero,
    palette,
    fonts,
    type: buildType(palette, fonts, aero),
    shadow: buildShadow(palette, aero),
    radii: aero
      ? { xs: 8, sm: 12, md: 16, lg: 22, xl: 30, pill: 999 }
      : { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
    glass: aero
      ? { blur: 60, androidBlur: 40, sheen: true }
      : { blur: 45, androidBlur: 32, sheen: false },
  };
};

export type Theme = ReturnType<typeof makeTheme>;

export const themes: Record<StyleName, Theme> = {
  editorial: makeTheme('editorial', editorialPalette, editorialFonts),
  aero: makeTheme('aero', aeroPalette, aeroFonts),
};

export function useTheme(): Theme {
  const style = usePalaceStore((s) => s.settings.style ?? 'editorial');
  return themes[style] ?? themes.editorial;
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
