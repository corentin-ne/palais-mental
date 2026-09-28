import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Texture, TextureLoader } from 'three';

import { softBox } from '@/lib/itemGeometry';

interface Props {
  url: string;
  /** Available box in niche-local space. */
  maxWidth: number;
  maxHeight: number;
  position: [number, number, number];
}

/**
 * The latest cover of a collection, displayed face-out under the niche's arch like a
 * record-shop pick. Textures load asynchronously; nothing renders until the image
 * arrives, and a failed load (offline, CORS) simply leaves the arch empty.
 */
export default function FeaturedCover({ url, maxWidth, maxHeight, position }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        if (!alive) return tex.dispose();
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        setTexture(tex);
        invalidate();
      },
      undefined,
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [url, gl, invalidate]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const size = useMemo(() => {
    const img = texture?.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1;
    let h = maxHeight;
    let w = h * aspect;
    if (w > maxWidth) {
      w = maxWidth;
      h = w / aspect;
    }
    return { w, h };
  }, [texture, maxWidth, maxHeight]);

  const res = useMemo(
    () => ({
      board: softBox(size.w + 0.008, size.h + 0.008, 0.01, 0.4, 2),
      boardMat: new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5 }),
      artMat: new MeshBasicMaterial({ map: texture ?? undefined, toneMapped: false }),
    }),
    [size.w, size.h, texture],
  );
  useEffect(
    () => () => {
      res.board.dispose();
      res.boardMat.dispose();
      res.artMat.dispose();
    },
    [res],
  );

  if (!texture) return null;
  return (
    <group position={position} rotation-x={-0.09}>
      <mesh geometry={res.board} material={res.boardMat} position-y={size.h / 2} />
      <mesh material={res.artMat} position={[0, size.h / 2, 0.0055]}>
        <planeGeometry args={[size.w, size.h]} />
      </mesh>
    </group>
  );
}
