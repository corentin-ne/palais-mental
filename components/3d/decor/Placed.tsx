import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

import type { RoomDimsRef } from '../MentalPalace';
import { COVE_RADIUS } from '@/lib/palaceLayout';

interface Props {
  dimsRef: RoomDimsRef;
  /** Degrees clockwise from the window. */
  angle: number;
  /** Distance in from the edge of the parquet; ignored with `onWall`. */
  inset?: number;
  /** Hang on the wall instead of standing on the floor. */
  onWall?: boolean;
  y?: number;
  children: ReactNode;
}

/**
 * Stands its children around the room at a given angle, facing the centre (local +z),
 * and keeps them there as the room grows.
 */
export default function Placed({ dimsRef, angle, inset = 0, onWall = false, y = 0, children }: Props) {
  const ref = useRef<Group>(null);
  const last = useRef(0);
  useFrame(() => {
    const { radius } = dimsRef.current;
    if (!ref.current || Math.abs(radius - last.current) < 1e-4) return;
    last.current = radius;
    const t = (angle * Math.PI) / 180;
    const d = onWall ? radius - 0.03 : radius - COVE_RADIUS - inset;
    ref.current.position.set(Math.sin(t) * d, y, -Math.cos(t) * d);
    ref.current.rotation.y = -t;
  });
  return <group ref={ref}>{children}</group>;
}
