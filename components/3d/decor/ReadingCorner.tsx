import { useEffect, useMemo } from 'react';
import { SphereGeometry } from 'three';

import { cyl, disposeAll, merge, paint, put } from './build';
import { decorMaterials } from './materials';
import Glow from '../light/Glow';
import { LIGHTING } from '@/config/lighting';

import { softBox } from '@/lib/itemGeometry';

/** Bouclé armchair with a throw and a cushion, a linen floor lamp and a round side table. */
export default function ReadingCorner() {
  const mats = decorMaterials();
  const geo = useMemo(
    () => ({
      chair: merge([
        put(softBox(0.66, 0.24, 0.58, 0.5, 5), [0, 0.12, 0]),
        put(softBox(0.74, 0.16, 0.62, 0.55, 5), [0, 0.32, 0.02]),
        put(softBox(0.76, 0.56, 0.18, 0.55, 5), [0, 0.6, -0.25], [-0.16, 0, 0]),
        put(softBox(0.15, 0.36, 0.64, 0.55, 5), [-0.36, 0.42, 0]),
        put(softBox(0.15, 0.36, 0.64, 0.55, 5), [0.36, 0.42, 0]),
      ]),
      textile: merge([
        paint(put(softBox(0.18, 0.05, 0.5, 0.5, 3), [0.37, 0.62, 0.02], [0, 0, -0.08]), '#D9A48B'),
        paint(put(new SphereGeometry(1, 20, 14), [-0.12, 0.5, -0.1], [-0.3, 0.3, 0.1], [0.15, 0.13, 0.06]), '#C9D5BE'),
      ]),
      lampBrass: merge([put(cyl(0.14, 0.15, 0.022, 40), [0, 0.011, 0]), put(cyl(0.011, 0.011, 1.42, 12), [0, 0.72, 0])]),
      lampShade: put(cyl(0.16, 0.23, 0.32, 40), [0, 1.52, 0]),
      lampBulb: put(new SphereGeometry(0.07, 16, 12), [0, 1.46, 0]),
      tableTop: merge([put(cyl(0.24, 0.24, 0.03, 48), [0, 0.53, 0]), put(cyl(0.15, 0.16, 0.022, 40), [0, 0.011, 0])]),
      tableStem: put(cyl(0.016, 0.016, 0.5, 12), [0, 0.27, 0]),
      books: merge([
        paint(put(softBox(0.2, 0.035, 0.27, 0.3, 2), [0.04, 0.563, 0.02], [0, 0.2, 0]), '#2E4057'),
        paint(put(softBox(0.18, 0.03, 0.24, 0.3, 2), [0.04, 0.595, 0.02], [0, -0.15, 0]), '#E8DCC8'),
        paint(put(softBox(0.16, 0.028, 0.22, 0.3, 2), [0.05, 0.624, 0.02], [0, 0.35, 0]), '#C8553D'),
      ]),
    }),
    [],
  );
  useEffect(() => () => disposeAll(geo), [geo]);
  return (
    <>
      <group rotation-y={0.25}>
        <mesh geometry={geo.chair} material={mats.boucle} />
        <mesh geometry={geo.textile} material={mats.painted} />
      </group>
      <group position={[-0.72, 0, -0.12]}>
        <mesh geometry={geo.lampBrass} material={mats.brass} />
        <mesh geometry={geo.lampShade} material={mats.linenShade} />
        <mesh geometry={geo.lampBulb} material={mats.bulb} />
        {LIGHTING.decor.lamp.enabled && (
          <>
            <Glow kind="pool" color={LIGHTING.decor.lamp.color} intensity={LIGHTING.decor.lamp.intensity} size={[1.1, 1.1]} position={[0, 1.5, 0.05]} breathe />
            <Glow kind="pool" color={LIGHTING.decor.lamp.color} intensity={LIGHTING.decor.lamp.intensity * 0.7} size={[1.8, 1.8]} position={[0.3, 0.012, 0.3]} rotation={[-Math.PI / 2, 0, 0]} />
            <Glow kind="beam" color={LIGHTING.decor.lamp.color} intensity={0.12} size={[0.2, 0.55, 1.3]} position={[0, 1.38, 0]} />
          </>
        )}
      </group>
      <group position={[0.68, 0, 0.1]}>
        <mesh geometry={geo.tableTop} material={mats.oak} />
        <mesh geometry={geo.tableStem} material={mats.brass} />
        <mesh geometry={geo.books} material={mats.painted} />
      </group>
    </>
  );
}
