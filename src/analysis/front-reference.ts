import type { Point } from '../shared/contracts';
import { angleDeg, distancePx, isUsablePoint } from './metrics';
import type { ArmJoint, FrontFrame, FrontPose, FrontReference, FittedReference } from './front-view-types';
import { FRONT_RULES as RULES } from './front-view-rules';

export const SIDES = ['left', 'right'] as const;
export const ARM_JOINTS: readonly ArmJoint[] = ['shoulder', 'elbow', 'wrist'];
export function validFrame(frame: FrontFrame): boolean {
  return Number.isFinite(frame.timestampMs) && frame.timestampMs >= 0
    && Number.isFinite(frame.width) && frame.width > 0 && Number.isFinite(frame.height) && frame.height > 0;
}
export function completePose(arms: FrontFrame['arms']): arms is FrontPose {
  return SIDES.every(side => {
    const arm = arms[side];
    return arm && ARM_JOINTS.every(j => isUsablePoint(arm[j]))
      && angleDeg(arm.shoulder, arm.elbow, arm.wrist) !== null;
  });
}
/** Approximate 2D fit, anchored once to the user's hands. */
export function fitReference(reference: FrontReference, frame: FrontFrame): FittedReference | null {
  if (!validFrame(frame) || !reference.id.trim() || !completePose(frame.arms)
    || !completePose(reference.top) || !completePose(reference.bottom)) return null;
  const currentArms = frame.arms;
  const start = reference.top.left.wrist, end = reference.top.right.wrist;
  const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
  const currentStart = frame.arms.left.wrist, currentEnd = frame.arms.right.wrist;
  const cx = currentEnd.x - currentStart.x, cy = currentEnd.y - currentStart.y, span = Math.hypot(cx, cy);
  if (!Number.isFinite(length) || length < 1 || !Number.isFinite(span) || span < 1) return null;
  for (const side of SIDES) {
    const handDrift = distancePx(reference.top[side].wrist, reference.bottom[side].wrist);
    const shoulderMotion = distancePx(reference.top[side].shoulder, reference.bottom[side].shoulder);
    if (handDrift === null || handDrift > length * RULES.maxReferenceHandDrift) return null;
    if (shoulderMotion === null || shoulderMotion < length * RULES.minReferenceShoulderMotion) return null;
  }
  const mapPoint = (p: Point): Point => {
    const x = p.x - start.x, y = p.y - start.y;
    const along = (x * (dx / length) + y * (dy / length)) / length;
    const across = (-x * (dy / length) + y * (dx / length)) / length;
    return { x: currentStart.x + along * cx - across * cy,
      y: currentStart.y + along * cy + across * cx, visibility: 1 };
  };
  const mapPose = (pose: FrontPose): FrontPose => ({
    left: { shoulder: mapPoint(pose.left.shoulder), elbow: mapPoint(pose.left.elbow), wrist: mapPoint(pose.left.wrist) },
    right: { shoulder: mapPoint(pose.right.shoulder), elbow: mapPoint(pose.right.elbow), wrist: mapPoint(pose.right.wrist) }
  });
  const fitted = { id: reference.id, top: mapPose(reference.top), bottom: mapPose(reference.bottom), wristSpanPx: span };
  if (!completePose(fitted.top) || !completePose(fitted.bottom)) return null;
  if (SIDES.some(s => ARM_JOINTS.some(j => {
    const error = distancePx(currentArms[s][j], fitted.top[s][j]);
    return error === null || error > span * RULES.failDistance;
  }))) return null;
  return fitted;
}
export function movementProgress(pose: FrontPose, reference: FittedReference): number | null {
  // Shoulders determine phase; an elbow error must not shift the other arm's target.
  let numerator = 0, denominator = 0;
  for (const side of SIDES) {
    const start = reference.top[side].shoulder, end = reference.bottom[side].shoulder;
    const dx = (end.x - start.x) / reference.wristSpanPx, dy = (end.y - start.y) / reference.wristSpanPx;
    numerator += ((pose[side].shoulder.x - start.x) / reference.wristSpanPx) * dx
      + ((pose[side].shoulder.y - start.y) / reference.wristSpanPx) * dy;
    denominator += dx * dx + dy * dy;
  }
  const progress = numerator / denominator;
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null;
}
/** Two-keyframe approximation; validate the intermediate path on real footage. */
export function poseAt(reference: FittedReference, progress: number): FrontPose {
  const blend = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress, visibility: 1 });
  const arm = (s: 'left' | 'right') => ({ shoulder: blend(reference.top[s].shoulder, reference.bottom[s].shoulder),
    elbow: blend(reference.top[s].elbow, reference.bottom[s].elbow), wrist: blend(reference.top[s].wrist, reference.bottom[s].wrist) });
  return { left: arm('left'), right: arm('right') };
}
