import type { Point } from '../shared/contracts';

export const MIN_VISIBILITY = 0.6;
type MaybePoint = Point | null | undefined;

/** Coordinates are unmirrored source-video pixels, not CSS positions. */
export function isUsablePoint(point: MaybePoint): point is Point {
  return point != null && Number.isFinite(point.x) && Number.isFinite(point.y)
    && Number.isFinite(point.visibility)
    && point.visibility >= MIN_VISIBILITY && point.visibility <= 1;
}

export function distancePx(a: MaybePoint, b: MaybePoint): number | null {
  if (!isUsablePoint(a) || !isUsablePoint(b)) return null;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return Number.isFinite(distance) ? distance : null;
}

/** Projected 2D angle at joint; it does not establish true 3D elbow depth. */
export function angleDeg(a: MaybePoint, joint: MaybePoint, c: MaybePoint): number | null {
  if (!isUsablePoint(a) || !isUsablePoint(joint) || !isUsablePoint(c)) return null;
  const ux = a.x - joint.x, uy = a.y - joint.y;
  const vx = c.x - joint.x, vy = c.y - joint.y;
  const uLength = Math.hypot(ux, uy), vLength = Math.hypot(vx, vy);
  if (!Number.isFinite(uLength) || !Number.isFinite(vLength) || uLength === 0 || vLength === 0) return null;
  const cosine = (ux / uLength) * (vx / vLength) + (uy / uLength) * (vy / vLength);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
