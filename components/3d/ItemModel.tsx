import { Ref } from 'react';
import { Group, Material } from 'three';

import { CategoryId } from '@/lib/types';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { getItemParts, getSeriesHalfParts } from '@/lib/itemGeometry';

interface Props {
  category: CategoryId;
  body: Material;
  detail: Material;
  /** Series only: when given, the media box is built as tray + hinged lid so it can open. */
  lidRef?: Ref<Group>;
}

/**
 * A single high-fidelity item built from the SAME cached geometries the shelf
 * instances use (see lib/itemGeometry), so a hero or an inspected object is
 * identical to its instanced twin.
 */
export default function ItemModel({ category, body, detail, lidRef }: Props) {
  if (category === 'series' && lidRef) {
    const [t, , d] = CATEGORY_SPECS.series.size;
    const half = getSeriesHalfParts();
    return (
      <>
        {/* Tray */}
        <group position={[-t / 4, 0, 0]}>
          <mesh geometry={half.body} material={body} dispose={null} />
          <mesh geometry={half.detail} material={detail} dispose={null} />
        </group>
        {/* Lid, hinged on the spine edge (+z) */}
        <group ref={lidRef} position={[0, 0, d / 2]}>
          <group position={[t / 4, 0, -d / 2]}>
            <mesh geometry={half.body} material={body} dispose={null} />
            <mesh geometry={half.detail} material={detail} dispose={null} />
          </group>
        </group>
      </>
    );
  }
  const parts = getItemParts(category);
  return (
    <>
      <mesh geometry={parts.body} material={body} dispose={null} />
      <mesh geometry={parts.detail} material={detail} dispose={null} />
    </>
  );
}
