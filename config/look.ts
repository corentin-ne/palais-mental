/**
 * The palace's colours and light. Edit the values of `editorial` to restyle the room, or
 * add another look and return it from useSceneLook (lib/sceneLook).
 */
/** Everything that sets the mood of the 3D palace. */
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
  /** How much of the category accent survives in the furniture back panels (0–1). */
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

export const SCENE_LOOKS: Record<'editorial', SceneLook> = {
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
};

