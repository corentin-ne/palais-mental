import { useEffect, useMemo } from 'react';

import { decorMaterials } from './materials';
import { buildPlant } from '../environment/RoomShell';

/** A tall potted plant. */
export default function Plant({ scale = 1, seed = 71 }: { scale?: number; seed?: number }) {
  const mats = decorMaterials();
  const geo = useMemo(() => buildPlant(15, 1.25, 0.15, seed), [seed]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group scale={scale}>
      <mesh geometry={geo.pot} material={mats.pot} />
      <mesh geometry={geo.stems} material={mats.stem} />
      <mesh geometry={geo.leaves} material={mats.leaf} />
    </group>
  );
}
