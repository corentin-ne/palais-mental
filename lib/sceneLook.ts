import { SCENE_LOOKS, SceneLook } from '@/config/look';

export type { SceneLook };

export function useSceneLook(): SceneLook {
  return SCENE_LOOKS.editorial;
}
