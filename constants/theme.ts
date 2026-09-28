/**
 * Design tokens. Luminous and warm: frosted cream glass over the room, warm ink
 * for text, the category pastels as the only colour. No dark mode, by design.
 */
export const palette = {
  bg: '#F6EEE4',
  ink: '#2A221C',
  inkSoft: 'rgba(42,34,28,0.64)',
  inkFaint: 'rgba(42,34,28,0.4)',
  hairline: 'rgba(42,34,28,0.09)',
  field: 'rgba(42,34,28,0.05)',
  fieldActive: 'rgba(42,34,28,0.08)',
  glass: 'rgba(255,252,248,0.66)',
  glassStrong: 'rgba(255,252,248,0.9)',
  glassEdge: 'rgba(255,255,255,0.85)',
  onInk: '#FFF9F1',
  star: '#E7A84A',
  danger: '#C0533F',
  dangerTint: 'rgba(192,83,63,0.1)',
  shadow: '#7A5A44',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',
  displayLight: 'Fraunces_300Light',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
} as const;

export const radii = { sm: 12, md: 16, lg: 22, xl: 32, pill: 999 } as const;

/** Type scale (1.2 ratio around a 15px body). */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: palette.ink },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: palette.ink },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.2, color: palette.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.ink },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: palette.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: palette.inkSoft },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: palette.inkFaint,
  },
  button: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.2 },
} as const;

export const shadow = {
  soft: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  lifted: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;
