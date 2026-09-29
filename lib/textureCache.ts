/**
 * Cover textures for the 3D scene, loaded once per URL and shared. Failed loads
 * (offline, CORS) resolve to null so callers simply show the object without art.
 */
import { SRGBColorSpace, Texture, TextureLoader } from 'three';

const cache = new Map<string, Promise<Texture | null>>();

export function loadCoverTexture(url: string): Promise<Texture | null> {
  let hit = cache.get(url);
  if (!hit) {
    hit = new Promise((resolve) => {
      const loader = new TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => {
          cache.delete(url);
          resolve(null);
        },
      );
    });
    cache.set(url, hit);
  }
  return hit;
}
