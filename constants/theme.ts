/**
 * Design tokens. Editorial and crisp: near-white paper, near-black ink, and the
 * cover art as the colour. Instrument Sans carries the interface; Instrument Serif
 * italic is reserved for dates, notes and quiet accents. No dark mode, by design.
 */
export const palette = {
  bg: '#FAF9F6',
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
  onInk: '#FFFFFF',
  star: '#F2A93B',
  danger: '#D2462F',
  dangerTint: 'rgba(210,70,47,0.09)',
  shadow: '#2B1E14',
} as const;

export const fonts = {
  display: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  displayLight: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
} as const;

/** Web draws a focus ring around text inputs; our fields carry their own focus styling. */
export const noOutline = { outlineWidth: 0 } as object;

export const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Type scale. Big, tight headlines; calm 15px body. */
export const type = {
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
} as const;

export const shadow = {
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
} as const;
