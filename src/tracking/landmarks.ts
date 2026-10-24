import type { JointName, PoseFrame, Side } from '../shared/contracts';

type Landmark = { x: number; y: number; visibility?: number };
const names: JointName[] = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
const indices = { left: [11, 13, 15, 23, 25, 27], right: [12, 14, 16, 24, 26, 28] };
const threshold = 0.5;

/** Confidence gating and side locking only; no exercise assessment. */
export function createSideSelector() {
  let locked: Side | null = null;
  let candidate: Side | null = null;
  let streak = 0;
  const reset = () => { locked = candidate = null; streak = 0; };
  function select(points: readonly Landmark[], width: number, height: number): Pick<PoseFrame, 'joints' | 'side' | 'tracking'> {
    const jointsFor = (side: Side): PoseFrame['joints'] => {
      const joints: PoseFrame['joints'] = {};
      indices[side].forEach((index, i) => {
        const point = points[index];
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
            Number.isFinite(point.visibility) && point.visibility! >= threshold) {
          joints[names[i]] = { x: point.x * width, y: point.y * height,
            visibility: Math.min(1, point.visibility!) };
        }
      });
      return joints;
    };
    const left = jointsFor('left'), right = jointsFor('right');
    const score = (joints: PoseFrame['joints']) => Object.values(joints).reduce((sum, point) => sum + point.visibility, 0);
    if (locked && Object.keys(locked === 'left' ? left : right).length < 3) {
      reset(); // Explicit loss boundary before any side reselection.
      return { joints: {}, side: null, tracking: 'lost' };
    }
    if (!locked) {
      const best = score(left) >= score(right) ? 'left' : 'right';
      const available = best === 'left' ? left : right;
      if (Object.keys(available).length < 3) {
        reset();
        return { joints: {}, side: null, tracking: 'lost' };
      }
      streak = candidate === best ? streak + 1 : 1;
      candidate = best;
      if (streak < 3) return { joints: {}, side: null, tracking: 'lost' };
      locked = best;
    }
    const joints = locked === 'left' ? left : right;
    return { joints, side: locked, tracking: Object.keys(joints).length === names.length ? 'valid' : 'partial' };
  }
  return { select, reset };
}
