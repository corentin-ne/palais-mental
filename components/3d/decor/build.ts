/** Small geometry helpers for building decor from primitives. */
import { BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();

/** Place a geometry: translate, rotate (Euler XYZ), scale. */
export function put<T extends BufferGeometry>(geo: T, [x, y, z]: number[], rot: number[] = [0, 0, 0], scale: number[] = [1, 1, 1]): T {
  _q.setFromEuler(new Euler(rot[0], rot[1], rot[2]));
  _m.compose(new Vector3(x, y, z), _q, _s.set(scale[0], scale[1], scale[2]));
  return geo.applyMatrix4(_m) as T;
}

/** Flat vertex colour so differently coloured parts share one draw call. */
export function paint<T extends BufferGeometry>(geo: T, hex: string): T {
  const c = new Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo;
}

/** Merge parts into one geometry, keeping only position/normal/uv/color. */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.uv) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  return mergeGeometries(clean)!;
}

export const cyl = (rTop: number, rBottom: number, h: number, seg = 32) => new CylinderGeometry(rTop, rBottom, h, seg);

/** Dispose every geometry in a (possibly nested) record. */
export function disposeAll(res: Record<string, unknown>) {
  for (const v of Object.values(res)) {
    if (v && typeof (v as BufferGeometry).dispose === 'function' && (v as BufferGeometry).isBufferGeometry) (v as BufferGeometry).dispose();
    else if (v && typeof v === 'object' && !Array.isArray(v)) disposeAll(v as Record<string, unknown>);
    else if (Array.isArray(v)) v.forEach((g) => (g as BufferGeometry)?.isBufferGeometry && (g as BufferGeometry).dispose());
  }
}
