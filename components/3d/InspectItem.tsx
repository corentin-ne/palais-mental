import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Group, MathUtils, MeshStandardMaterial, PerspectiveCamera, Quaternion, Vector3 } from 'three';

import ItemModel from './ItemModel';
import { PalaceItem } from '@/lib/types';
import { CATEGORY_SPECS, getItemColor, getItemScale } from '@/lib/itemVisuals';
import { BODY_ROUGHNESS } from '@/lib/itemGeometry';
import { getRoomDims, getRoomLevel, getSlotWorld } from '@/lib/palaceLayout';
import { clamp01, easeInOutCubic, lerp, safeDelta } from '@/lib/easing';
import { sceneSignals } from '@/lib/sceneSignals';
import { usePalaceStore } from '@/store/usePalaceStore';

const PRESENT_DISTANCE = 0.8;
const UP = new Vector3(0, 1, 0);
const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Tap an object on its shelf and it slides out of the niche and floats up in front of
 * you, cover turned toward the camera, while its detail sheet is open. Dragging spins
 * it. Closing the sheet sends it gliding back into its slot, and only then does the
 * shelf instance reappear (store.endInspect).
 */
export default function InspectItem() {
  const inspectId = usePalaceStore((s) => s.inspectId);
  const item = usePalaceStore((s) => (s.inspectId ? s.items[s.inspectId] : undefined));
  if (!inspectId || !item) return null;
  return <Inspected key={inspectId} item={item} />;
}

function Inspected({ item }: { item: PalaceItem }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const endInspect = usePalaceStore((s) => s.endInspect);
  const root = useRef<Group>(null);
  const content = useRef<Group>(null);
  const anim = useRef({ p: 0, spin: 0 });
  const [, h, d] = CATEGORY_SPECS[item.category].size;

  const mats = useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: new Color(getItemColor(item)), roughness: BODY_ROUGHNESS[item.category] }),
      detail: new MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }),
    }),
    [item],
  );
  useEffect(() => {
    sceneSignals.inspectSpin = 0;
    invalidate();
    return () => {
      mats.body.dispose();
      mats.detail.dispose();
      invalidate();
    };
  }, [mats, invalidate]);

  const _slot = useMemo(() => new Vector3(), []);
  const _present = useMemo(() => new Vector3(), []);
  const _fwd = useMemo(() => new Vector3(), []);
  const _qSlot = useMemo(() => new Quaternion(), []);
  const _qPresent = useMemo(() => new Quaternion(), []);
  const _qTurn = useMemo(() => new Quaternion(), []);

  useFrame((_, rawDelta) => {
    const g = root.current;
    const c = content.current;
    if (!g || !c) return;
    const s = usePalaceStore.getState();
    const selected = s.selectedId === item.id;
    const a = anim.current;
    const dt = safeDelta(rawDelta);

    a.p = MathUtils.damp(a.p, selected ? 1 : 0, selected ? 5 : 7, dt);
    a.spin = MathUtils.damp(a.spin, sceneSignals.inspectSpin, 8, dt);
    const e = easeInOutCubic(clamp01(a.p));

    // Slot pose, from the same pure layout the shelf uses.
    const order = s.order[item.category];
    const scale = getItemScale(item);
    const hs = scale[1];
    const dims = getRoomDims(getRoomLevel(Object.keys(s.items).length));
    const { zone, position } = getSlotWorld(item.category, item.id, order, s.items, dims);
    _slot.set(...position);
    _qSlot.setFromAxisAngle(Y_AXIS, zone.rotationY);

    // Presented pose: upper half of the screen (the sheet covers the lower half).
    const visH = 2 * PRESENT_DISTANCE * Math.tan((camera.fov * Math.PI) / 360);
    camera.getWorldDirection(_fwd);
    _present.copy(camera.position).addScaledVector(_fwd, PRESENT_DISTANCE);
    _present.addScaledVector(UP.clone().applyQuaternion(camera.quaternion), visH * 0.17);
    const sway = Math.sin(sceneSignals.ambientTime * 0.8) * 0.12;
    _qTurn.setFromAxisAngle(Y_AXIS, -Math.PI / 2 + 0.35 + sway + a.spin);
    _qPresent.copy(camera.quaternion).multiply(_qTurn);
    const presentScale = Math.min(visH * 0.3, visH * camera.aspect * 0.55) / Math.max(h * hs, d);

    // Slide straight out of the niche first, then arc up to the viewer.
    g.position.lerpVectors(_slot, _present, e);
    g.position.addScaledVector(new Vector3(...zone.normal), Math.sin(Math.PI * e) * 0.18);
    g.quaternion.slerpQuaternions(_qSlot, _qPresent, e);
    g.scale.setScalar(lerp(1, presentScale, e));
    c.scale.set(scale[0], scale[1], scale[2]);

    if (a.p > 0.01) sceneSignals.focusPoint.copy(g.position);

    const settledIn = !selected && a.p < 0.002;
    if (settledIn) {
      endInspect(item.id);
      return;
    }
    const moving = Math.abs(a.p - (selected ? 1 : 0)) > 1e-3 || Math.abs(a.spin - sceneSignals.inspectSpin) > 1e-3;
    if (moving) invalidate();
  });

  return (
    <group ref={root}>
      <group ref={content}>
        <ItemModel category={item.category} body={mats.body} detail={mats.detail} />
      </group>
    </group>
  );
}
