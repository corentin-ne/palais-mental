import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderGeometry, Group } from 'three';

import type { RoomDimsRef } from '../MentalPalace';
import CoffeeTable from '../decor/CoffeeTable';
import Curtains from '../decor/Curtains';
import HiFi from '../decor/HiFi';
import Lantern from '../decor/Lantern';
import Placed from '../decor/Placed';
import Plant from '../decor/Plant';
import Print from '../decor/Print';
import ReadingCorner from '../decor/ReadingCorner';
import TvConsole from '../decor/TvConsole';
import { decorMaterials } from '../decor/materials';
import { DECOR } from '@/config/decor';
import { ANCHORS } from '@/config/room';
import { COVE_RADIUS } from '@/lib/palaceLayout';

/**
 * The lived-in part of the room, composed from config/decor: the TV console and the hi-fi
 * that the collections gather around, curtains at the window, a reading corner, a coffee
 * table, a paper lantern, framed prints, plants and an oak skirting. Everything follows
 * the room as it grows.
 */
export default function RoomDecor({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const mats = decorMaterials();
  const skirting = useRef<Group>(null);
  const windowSide = useRef<Group>(null);
  const lantern = useRef<Group>(null);
  const lastRadius = useRef(0);
  // Unit-radius ring, scaled to the edge of the parquet.
  const ring = useMemo(() => new CylinderGeometry(1, 1, DECOR.skirting.height, 160, 1, true), []);
  useEffect(() => () => ring.dispose(), [ring]);

  useFrame(() => {
    const { radius, wallHeight } = dimsRef.current;
    if (Math.abs(radius - lastRadius.current) < 1e-4) return;
    lastRadius.current = radius;
    const floorEdge = radius - COVE_RADIUS + 0.01;
    skirting.current?.scale.set(floorEdge, 1, floorEdge);
    windowSide.current?.position.set(0, 0, -radius + 0.2);
    lantern.current?.position.set(DECOR.lantern.x, Math.min(DECOR.lantern.maxHeight, wallHeight - 0.8), -radius + DECOR.lantern.fromWindow);
  });

  const { tvConsole, hifi, readingCorner, coffeeTable, prints, plants } = DECOR;

  return (
    <group>
      {DECOR.skirting.enabled && (
        <group ref={skirting} position-y={DECOR.skirting.height / 2}>
          <mesh geometry={ring} material={mats.skirting} />
        </group>
      )}
      {DECOR.curtains.enabled && (
        <group ref={windowSide}>
          <Curtains />
        </group>
      )}
      {DECOR.lantern.enabled && (
        <group ref={lantern}>
          <Lantern />
        </group>
      )}
      {coffeeTable.enabled && (
        <group position={[coffeeTable.x, 0, coffeeTable.z]}>
          <CoffeeTable />
        </group>
      )}
      {tvConsole.enabled && (
        <Placed dimsRef={dimsRef} angle={ANCHORS.tv.angle} inset={tvConsole.inset}>
          <TvConsole width={ANCHORS.tv.width} />
        </Placed>
      )}
      {hifi.enabled && (
        <Placed dimsRef={dimsRef} angle={ANCHORS.hifi.angle} inset={hifi.inset}>
          <HiFi />
        </Placed>
      )}
      {readingCorner.enabled && (
        <Placed dimsRef={dimsRef} angle={readingCorner.angle} inset={readingCorner.inset}>
          <ReadingCorner />
        </Placed>
      )}
      {prints.map((p, i) => (
        <Placed key={`print-${i}`} dimsRef={dimsRef} angle={p.angle} onWall y={p.y}>
          <Print width={p.width} height={p.height} seed={p.seed} />
        </Placed>
      ))}
      {plants.map((p, i) => (
        <Placed key={`plant-${i}`} dimsRef={dimsRef} angle={p.angle} inset={p.inset}>
          <Plant scale={p.scale} />
        </Placed>
      ))}
    </group>
  );
}
