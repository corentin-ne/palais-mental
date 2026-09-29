import { useEffect, useMemo } from 'react';
import { LatheGeometry, SphereGeometry, Vector2 } from 'three';

import { cyl, disposeAll, merge, paint, put } from './build';
import { decorMaterials } from './materials';
import Glow from '../light/Glow';
import { LIGHTING } from '@/config/lighting';

import { softBox } from '@/lib/itemGeometry';

const STEMS = [
  [0.1, 0.28],
  [-0.12, 0.25],
  [0.02, 0.36],
  [0.2, 0.3],
] as const;

/** Round frosted-glass table on three brass legs, with a glass vase of dried stems and two art books. */
export default function CoffeeTable() {
  const mats = decorMaterials();
  const geo = useMemo(
    () => ({
      top: put(cyl(0.46, 0.46, 0.04, 64), [0, 0.36, 0]),
      legs: merge(
        [0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return put(cyl(0.014, 0.01, 0.34, 10), [Math.cos(a) * 0.32, 0.17, Math.sin(a) * 0.32], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
        }),
      ),
      vase: put(
        new LatheGeometry(
          [
            [0.001, 0],
            [0.06, 0],
            [0.085, 0.05],
            [0.09, 0.11],
            [0.06, 0.2],
            [0.035, 0.24],
            [0.04, 0.26],
          ].map(([x, y]) => new Vector2(x, y)),
          40,
        ),
        [0.14, 0.38, -0.08],
      ),
      stems: merge(
        STEMS.map(([tilt, len], i) => put(cyl(0.003, 0.004, len, 5), [0.14 + tilt * len * 0.5, 0.62 + len * 0.5, -0.08 + (i - 1.5) * 0.02], [0, 0, -tilt])),
      ),
      heads: merge(
        STEMS.map(([tilt, len], i) =>
          put(new SphereGeometry(1, 10, 8), [0.14 + tilt * len, 0.62 + len, -0.08 + (i - 1.5) * 0.02], [0, 0, 0], [0.03, 0.05, 0.03]),
        ),
      ),
      books: merge([
        paint(put(softBox(0.3, 0.035, 0.24, 0.3, 2), [-0.14, 0.4, 0.08], [0, 0.3, 0]), '#F2C57C'),
        paint(put(softBox(0.26, 0.03, 0.2, 0.3, 2), [-0.13, 0.433, 0.08], [0, 0.1, 0]), '#7B9E89'),
      ]),
    }),
    [],
  );
  useEffect(() => () => disposeAll(geo), [geo]);
  return (
    <>
      <mesh geometry={geo.top} material={mats.glassTable} />
      <mesh geometry={geo.legs} material={mats.brass} />
      <mesh geometry={geo.vase} material={mats.glass} />
      <mesh geometry={geo.stems} material={mats.driedStem} />
      <mesh geometry={geo.heads} material={mats.pampas} />
      <mesh geometry={geo.books} material={mats.painted} />
      {/* Light refracted by the glass top and vase, shimmering on the rug below. */}
      {LIGHTING.decor.caustics.enabled && (
        <Glow
          kind="caustics"
          color={LIGHTING.decor.caustics.color}
          intensity={LIGHTING.decor.caustics.intensity}
          size={[1.3, 1.3]}
          position={[0.05, 0.012, 0.05]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}
    </>
  );
}
