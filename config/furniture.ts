/**
 * The evolving furniture: when each stage begins, how it is proportioned, and its
 * materials. Per-collection density lives in config/collections (`slotScale`).
 *
 *   0 pedestal → 1 console → 2 bookcase → 3 arched cabinet → 4 wall unit
 */
export type FurnitureStage = 0 | 1 | 2 | 3 | 4;

/** Object counts at which a collection's furniture moves to the next stage. */
export const STAGE_THRESHOLDS = [0, 6, 16, 36, 72] as const;

export interface StageSpec {
  /** Slots per tier, in the collection's pitch (multiplied by its slotScale). */
  slots: number;
  minTiers: number;
  maxTiers: number;
  /** Height of the first plank's top surface (m). */
  baseY: number;
  /** Slots per bay between vertical dividers (multiplied by slotScale); 0 = one open run. */
  bay: number;
}

export const STAGES: StageSpec[] = [
  { slots: 8, minTiers: 1, maxTiers: 1, baseY: 0.52, bay: 0 },
  { slots: 12, minTiers: 1, maxTiers: 2, baseY: 0.46, bay: 0 },
  { slots: 14, minTiers: 2, maxTiers: 3, baseY: 0.16, bay: 7 },
  { slots: 18, minTiers: 2, maxTiers: 4, baseY: 0.18, bay: 6 },
  { slots: 24, minTiers: 3, maxTiers: 6, baseY: 0.2, bay: 6 },
];

/** Carcass proportions (m). */
export const CARCASS = {
  plank: 0.032,
  side: 0.036,
  sidePadding: 0.03,
  bayGap: 0.03,
  /** Height of the arched crown on cabinets and wall units. */
  crownHeight: 0.42,
  /** Width of each side tower on a wall unit. */
  towerWidth: 0.16,
  /** Corner radius cap of every rounded part: higher is softer. */
  cornerRadius: 0.02,
  /** Clearance between an object and the next tier above it. */
  headroom: 0.07,
} as const;

/** Materials of the furniture; the lacquer and back-panel tint follow config/look. */
export const FURNITURE_MATERIALS = {
  oak: { color: '#E8D0AE', roughness: 0.55 },
  brass: { color: '#C9A56A', metalness: 0.9, roughness: 0.3 },
  /** How far the light lines under each plank lean toward white (0–1) and their brightness. */
  glowWhiten: 0.55,
  glowIntensity: 1.6,
} as const;
