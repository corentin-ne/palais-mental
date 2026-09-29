import { useEffect, useMemo } from 'react';
import { CylinderGeometry, SphereGeometry } from 'three';

import { cyl, disposeAll, merge, put } from './build';
import { decorMaterials } from './materials';

/** Paper lantern with thin ribs, hanging on a cord long enough to reach the dome. */
export default function Lantern() {
  const mats = decorMaterials();
  const geo = useMemo(
    () => ({
      lantern: put(new SphereGeometry(0.26, 40, 24), [0, 0, 0], [0, 0, 0], [1, 0.88, 1]),
      ribs: merge(
        [-0.14, -0.07, 0, 0.07, 0.14].map((y) => {
          const r = Math.sqrt(Math.max(0, 0.26 * 0.26 - (y / 0.88) ** 2)) + 0.002;
          return put(new CylinderGeometry(r, r, 0.004, 48, 1, true), [0, y, 0]);
        }),
      ),
      cord: put(cyl(0.004, 0.004, 4.5, 6), [0, 0.22 + 2.25, 0]),
    }),
    [],
  );
  useEffect(() => () => disposeAll(geo), [geo]);
  return (
    <>
      <mesh geometry={geo.lantern} material={mats.paper} />
      <mesh geometry={geo.ribs} material={mats.cord} />
      <mesh geometry={geo.cord} material={mats.cord} />
    </>
  );
}
