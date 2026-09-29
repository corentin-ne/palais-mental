/**
 * Everything in the room that is not a collection: what is there, where it stands and
 * what it is made of. Angles are degrees clockwise from the window, like ZONE_ANGLES in
 * config/room. `inset` is the distance in from the edge of the parquet (m). Set
 * `enabled: false` to take a piece out of the room.
 */

export const DECOR = {
  /** Low media console with the TV (position and width: ANCHORS.tv in config/room). */
  tvConsole: { enabled: true, inset: 0.26 },
  /** 2000s mini hi-fi on a low bench (position: ANCHORS.hifi in config/room). */
  hifi: { enabled: true, inset: 0.2 },
  readingCorner: { enabled: true, angle: -148, inset: 0.55 },
  coffeeTable: { enabled: true, x: 0.35, z: -0.55 },
  /** Paper lantern between the viewer and the window (offset from the window wall). */
  lantern: { enabled: true, x: 0.85, fromWindow: 1.9, maxHeight: 3.05 },
  curtains: { enabled: true, panelWidth: 0.62, pleats: 7 },
  skirting: { enabled: true, height: 0.07 },
  prints: [
    { angle: -80, width: 0.8, height: 1.06, y: 1.62, seed: 0.57 },
    { angle: -148, width: 0.9, height: 0.62, y: 1.5, seed: 0.13 },
    { angle: 150, width: 0.46, height: 0.62, y: 1.45, seed: 0.81 },
  ],
  plants: [{ angle: -126, inset: 0.35, scale: 1.2 }],
} as const;

/** Colours and finishes of the decor. */
export const DECOR_COLORS = {
  oak: '#D8B88E',
  lacquer: '#FBF7F1',
  brass: '#C9A56A',
  boucle: '#F3ECE2',
  linen: '#FBF4E8',
  curtain: '#EFDFCB',
  ceramic: '#E9DCCB',
  /** Tint of clear and frosted glass (vases, the coffee table top). */
  glass: '#CFE6E2',
  paper: '#FFF8EE',
  frame: '#D2B48C',
  pot: '#E7BCA6',
  leaf: '#8FBC8B',
  stem: '#7FA36E',
  driedStem: '#B89A74',
  pampas: '#EADBC2',
  cord: '#8C7A68',
  /** TV, soundbar and speaker fronts. */
  charcoal: '#4A4B52',
  /** Brushed-silver plastic of the 2000s hi-fi. */
  silver: '#C9CCD1',
  /** Glow of the hi-fi display and lamp bulb. */
  display: '#8FF0E8',
  bulb: '#FFE3B8',
  lampGlow: '#FFD9A6',
  lanternGlow: '#FFE1B5',
} as const;
