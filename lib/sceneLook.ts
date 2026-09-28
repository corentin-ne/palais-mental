import { usePalaceStore } from '@/store/usePalaceStore';

/** Everything the 3D palace varies between the two experiences. */
export interface SceneLook {
  background: string;
  hemi: [string, string, number];
  sun: [string, number];
  fill: [string, number];
  envIntensity: number;
  floorCenter: string;
  floorEdge: string;
  wall: string;
  dome: string;
  frame: string;
  lacquer: string;
  lacquerRoughness: number;
  /** How much of the category accent survives in the niche lining (0–1). */
  liningAccent: number;
  zenith: string;
  horizon: string;
  dust: string;
  dustSize: number;
  bloom: number;
  rug: [string, string];
  pillows: [string, string];
  cushion: string;
}

export const SCENE_LOOKS: Record<'editorial' | 'aero', SceneLook> = {
  editorial: {
    background: '#FAF9F6',
    hemi: ['#FFFFFF', '#E9E1D6', 1.05],
    sun: ['#FFF1DE', 1.5],
    fill: ['#F4F1FF', 0.4],
    envIntensity: 0.65,
    floorCenter: '#ECE3D8',
    floorEdge: '#E6DCD0',
    wall: '#F8F6F2',
    dome: '#FBFAF8',
    frame: '#FFFDF9',
    lacquer: '#FFFCF7',
    lacquerRoughness: 0.3,
    liningAccent: 0.28,
    zenith: '#4D9EDD',
    horizon: '#C6E3F4',
    dust: '#FFE6C2',
    dustSize: 11,
    bloom: 0.35,
    rug: ['#EACFB8', '#F3E3D2'],
    pillows: ['#E9B7A2', '#CADAC1'],
    cushion: '#F1DECB',
  },
  // Aero: a glass pavilion at noon — cool daylight, glossy white lacquer, aqua linings, bubbles.
  aero: {
    background: '#DDF1FB',
    hemi: ['#EEF8FF', '#CFE3DE', 0.85],
    sun: ['#FFFFFF', 1.3],
    fill: ['#DDF3FF', 0.4],
    envIntensity: 0.7,
    floorCenter: '#DCEBEA',
    floorEdge: '#D2E4E3',
    wall: '#EEF5F9',
    dome: '#F6FAFD',
    frame: '#FFFFFF',
    lacquer: '#FFFFFF',
    lacquerRoughness: 0.12,
    liningAccent: 0.45,
    zenith: '#2C96E2',
    horizon: '#BFEAFF',
    dust: '#E4F6FF',
    dustSize: 22,
    bloom: 0.3,
    rug: ['#BFE3EA', '#E4F4F6'],
    pillows: ['#8FD0F0', '#BDE7B4'],
    cushion: '#F4FAFC',
  },
};

export function useSceneLook(): SceneLook {
  const style = usePalaceStore((s) => s.settings.style ?? 'editorial');
  return SCENE_LOOKS[style];
}
