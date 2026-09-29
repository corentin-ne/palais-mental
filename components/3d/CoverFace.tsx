import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Mesh, MeshStandardMaterial, PlaneGeometry, Texture } from 'three';

import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { loadCoverTexture } from '@/lib/textureCache';
import { CategoryId } from '@/lib/types';

interface Props {
  url?: string;
  category: CategoryId;
}

/**
 * The object's real artwork, laid on its front face (+x in item space: the face that
 * turns toward the camera when an object is presented). The image is cropped to the
 * face's proportions, like a print trimmed to its sleeve. Parents fade it through
 * `material.opacity` via the forwarded ref.
 */
const CoverFace = forwardRef<Mesh, Props>(function CoverFace({ url, category }, ref) {
  const invalidate = useThree((s) => s.invalidate);
  const [texture, setTexture] = useState<Texture | null>(null);
  const [t, h, d] = CATEGORY_SPECS[category].size;
  const w = d * 0.94;
  const hh = h * 0.95;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadCoverTexture(url).then((tex) => {
      if (!alive || !tex) return;
      // Own copy (same image) so the crop below never affects other users of the texture.
      const own = tex.clone();
      const img = own.image as { width?: number; height?: number } | undefined;
      const imageAspect = img?.width && img?.height ? img.width / img.height : w / hh;
      const faceAspect = w / hh;
      if (imageAspect > faceAspect) {
        own.repeat.set(faceAspect / imageAspect, 1);
        own.offset.set((1 - own.repeat.x) / 2, 0);
      } else {
        own.repeat.set(1, imageAspect / faceAspect);
        own.offset.set(0, (1 - own.repeat.y) / 2);
      }
      own.needsUpdate = true;
      setTexture(own);
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, [url, w, hh, invalidate]);

  const res = useMemo(
    () => ({
      geo: new PlaneGeometry(w, hh),
      mat: new MeshStandardMaterial(texture
          ? { map: texture, emissive: '#FFFFFF', emissiveMap: texture, emissiveIntensity: 0.35, roughness: 0.42, transparent: true }
          : { visible: false }),
    }),
    [w, hh, texture],
  );
  useEffect(() => () => {
    res.geo.dispose();
    res.mat.dispose();
  }, [res]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;
  return <mesh ref={ref} geometry={res.geo} material={res.mat} position-x={t / 2 + 0.0012} rotation-y={Math.PI / 2} />;
});

export default CoverFace;
