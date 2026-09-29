import { Vector3 } from 'three';

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * With frameloop="demand" the first delta after an idle period can be seconds long.
 * Every animation clamps it so motion resumes smoothly instead of teleporting.
 */
export const safeDelta = (delta: number) => Math.min(delta, 1 / 30);

/** Cubic bezier B(t) = (1-t)³P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³P3, written into `out`. */
export function cubicBezier(out: Vector3, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  );
}
export const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInQuad = (t: number) => t * t;
/** Damped sine overshoot that settles on 1: a quick, lively pop. */
export const easeOutElastic = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3.2)) + 1;

/** Position and velocity of a one-dimensional spring. */
export interface Spring {
  x: number;
  v: number;
}

export const spring = (x: number): Spring => ({ x, v: 0 });

/**
 * Semi-implicit spring step toward `target`. Slightly underdamped by default, so motion
 * overshoots a touch and settles fast. Sub-stepped to stay stable at low frame rates.
 */
export function stepSpring(s: Spring, target: number, dt: number, stiffness = 260, damping = 18): void {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.v += (stiffness * (target - s.x) - damping * s.v) * h;
    s.x += s.v * h;
  }
}

export const springSettled = (s: Spring, target: number, eps = 1e-4) => Math.abs(s.x - target) < eps && Math.abs(s.v) < eps * 10;
