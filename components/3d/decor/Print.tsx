import { useEffect, useMemo } from 'react';
import { PlaneGeometry, ShaderMaterial } from 'three';

import { decorMaterials } from './materials';
import { softBox } from '@/lib/itemGeometry';
import { artFragment, artVertex } from '@/shaders/art';

/** A framed print from the shader series (shaders/art); `seed` picks the composition. */
export default function Print({ width, height, seed }: { width: number; height: number; seed: number }) {
  const mats = decorMaterials();
  const res = useMemo(
    () => ({
      frame: softBox(width + 0.06, height + 0.06, 0.035, 0.25, 2),
      art: new PlaneGeometry(width, height),
      mat: new ShaderMaterial({ vertexShader: artVertex, fragmentShader: artFragment, uniforms: { uSeed: { value: seed }, uAspect: { value: width / height } } }),
    }),
    [width, height, seed],
  );
  useEffect(
    () => () => {
      res.frame.dispose();
      res.art.dispose();
      res.mat.dispose();
    },
    [res],
  );
  return (
    <>
      <mesh geometry={res.frame} material={mats.frame} position-z={-0.018} />
      <mesh geometry={res.art} material={res.mat} position-z={0.001} />
    </>
  );
}
