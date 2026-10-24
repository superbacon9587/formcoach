import type { CheckStatus, Phase } from '../shared/contracts';
import { angleDeg, distancePx } from './metrics';
import { createEvidenceGate } from './evidence';
import { FRONT_RULES as RULES } from './front-view-rules';
import { ARM_JOINTS, SIDES, completePose, fitReference, movementProgress, poseAt, validFrame } from './front-reference';
import type { ArmMeasurement, FrontFrame, FrontReference, FrontView, FittedReference } from './front-view-types';
export type * from './front-view-types';
export { fitReference } from './front-reference';

const emptyArm = (): ArmMeasurement => ({ elbowDeg:null, upperArmPx:null, forearmPx:null,
  bottomDistance:null, referenceError:null, referenceMatch:'unknown' });
const emptyView = (): FrontView => ({ calibrated:false, referenceId:null, phase:'paused', progress:null,
  bottomTarget:null, expectedPose:null, tolerancePx:null, arms:{left:emptyArm(), right:emptyArm()},
  referenceMatch:'unknown', bottomReached:false, corrections:[], cue:'Supply a reviewed reference and calibrate at the top.',
  elapsedMs:0, assessableMs:0 });
const combined = (states: CheckStatus[]): CheckStatus => states.includes('fail') ? 'fail'
  : states.every(s => s === 'pass') ? 'pass' : 'unknown';

/** B-local engine for a future agreed adapter; not wired into main v1. */
export function createFrontViewAnalyzer(reference?: FrontReference) {
  const reviewed = reference ? structuredClone(reference) : null;
  let fitted: FittedReference | null = null;
  let view = emptyView(), lastTime: number | null = null, lostSince: number | null = null;
  let width = 0, height = 0, source: FrontFrame['source'] | null = null, finished = false, previousValid = false;
  let lastProgress: number | null = null, phase: Phase = 'ready';
  let motion: 'down' | 'up' | null = null, motionSince = 0, motionStart = 0;
  let endpoint: 'ready' | 'bottom' | null = null, endpointSince = 0;
  const gates = { left: { shoulder:createEvidenceGate(), elbow:createEvidenceGate(), wrist:createEvidenceGate() },
    right: { shoulder:createEvidenceGate(), elbow:createEvidenceGate(), wrist:createEvidenceGate() } };
  const snapshot = () => structuredClone(view);
  function clearEvidence() {
    for (const side of SIDES) for (const j of ARM_JOINTS) gates[side][j].reset();
    motion = null; endpoint = null; lastProgress = null;
  }
  function invalidateCalibration() {
    fitted = null; previousValid = false; lostSince = null; phase = 'ready'; clearEvidence();
  }
  function reset() {
    invalidateCalibration(); view = emptyView(); lastTime = null; width = 0; height = 0; source = null; finished = false;
    return snapshot();
  }
  function measurements(frame: FrontFrame) {
    const arms = { left:emptyArm(), right:emptyArm() };
    for (const side of SIDES) {
      const arm = frame.arms[side];
      arms[side].elbowDeg = angleDeg(arm?.shoulder, arm?.elbow, arm?.wrist);
      arms[side].upperArmPx = distancePx(arm?.shoulder, arm?.elbow);
      arms[side].forearmPx = distancePx(arm?.elbow, arm?.wrist);
    }
    return arms;
  }
  function paused(frame: FrontFrame, cue: string) {
    clearEvidence(); previousValid = false;
    view = { ...view, calibrated:fitted !== null, referenceId:fitted?.id ?? null,
      arms:measurements(frame), phase:'paused', progress:null, expectedPose:null,
      bottomTarget:fitted ? structuredClone(fitted.bottom) : null,
      tolerancePx:fitted ? fitted.wristSpanPx * RULES.failDistance : null,
      referenceMatch:'unknown', bottomReached:false, corrections:[], cue };
    return snapshot();
  }
  function calibrate(frame: FrontFrame) {
    reset();
    fitted = reviewed ? fitReference(reviewed, frame) : null;
    if (!fitted) return paused(frame, reviewed ? 'Show both arms in the reference top position to calibrate.'
      : 'A reviewed front-view reference is required.');
    width = frame.width; height = frame.height; source = frame.source; lastTime = frame.timestampMs;
    previousValid = true;
    view = { ...emptyView(), calibrated:true, referenceId:fitted.id, phase:'ready', progress:0,
      bottomTarget:structuredClone(fitted.bottom), expectedPose:structuredClone(fitted.top),
      tolerancePx:fitted.wristSpanPx * RULES.failDistance, arms:measurements(frame), cue:'Ready. Lower toward the dashed target.' };
    return snapshot();
  }
  function update(frame: FrontFrame): FrontView {
    if (finished) return snapshot();
    if (!validFrame(frame) || (lastTime !== null && frame.timestampMs <= lastTime)) {
      return paused(frame, 'Waiting for fresh tracking data.');
    }
    const delta = lastTime === null ? 0 : frame.timestampMs - lastTime;
    lastTime = frame.timestampMs;
    if (delta > RULES.trackingGapMs || (fitted && (frame.width !== width || frame.height !== height || frame.source !== source))) {
      invalidateCalibration();
      return paused(frame, 'Camera input changed or paused. Recalibrate at the top.');
    }
    view.elapsedMs += delta;
    if (!fitted) return paused(frame, 'Supply a reviewed reference and calibrate at the top.');
    if (!completePose(frame.arms)) {
      lostSince ??= frame.timestampMs;
      if (frame.timestampMs - lostSince >= RULES.trackingGapMs) invalidateCalibration();
      return paused(frame, fitted ? 'Keep both shoulders, elbows and wrists visible.' : 'Tracking was lost. Recalibrate at the top.');
    }
    if (lostSince !== null && frame.timestampMs - lostSince >= RULES.trackingGapMs) {
      invalidateCalibration(); return paused(frame, 'Tracking was lost. Recalibrate at the top.');
    }
    lostSince = null;
    const currentArms = frame.arms;
    const progress = movementProgress(currentArms, fitted);
    if (progress === null) return paused(frame, 'Movement cannot be measured from this reference.');
    const expected = poseAt(fitted, progress), arms = measurements(frame);
    // A failed numeric calculation must never be coerced from null to zero error.
    if (SIDES.some(s => ARM_JOINTS.some(j => distancePx(currentArms[s][j], expected[s][j]) === null
      || distancePx(currentArms[s][j], fitted!.bottom[s][j]) === null))) {
      return paused(frame, 'Joint geometry cannot be compared reliably.');
    }
    if (previousValid) view.assessableMs += delta;
    previousValid = true;
    const corrections: FrontView['corrections'] = [];
    for (const side of SIDES) {
      const errors = ARM_JOINTS.map(j => distancePx(currentArms[side][j], expected[side][j])! / fitted!.wristSpanPx);
      const statuses = ARM_JOINTS.map((j, i) => gates[side][j].update(errors[i], frame.timestampMs));
      arms[side].referenceError = Math.max(...errors);
      arms[side].bottomDistance = Math.max(...ARM_JOINTS.map(j => distancePx(currentArms[side][j], fitted!.bottom[side][j])! / fitted!.wristSpanPx));
      arms[side].referenceMatch = combined(statuses);
      if (statuses[0] === 'fail' || statuses[1] === 'fail') corrections.push({ side, segment:'upperArm', cue:`Bring your ${side} arm toward the guide.` });
      if (statuses[1] === 'fail' || statuses[2] === 'fail') corrections.push({ side, segment:'forearm', cue:statuses[2] === 'fail'
        ? `Return your ${side} hand to its starting position.` : `Bring your ${side} arm toward the guide.` });
    }
    const match = combined(SIDES.map(s => arms[s].referenceMatch));
    const nearBottom = progress >= RULES.bottomProgress && SIDES.every(s => arms[s].bottomDistance! < RULES.passDistance);
    const nextEndpoint = nearBottom ? 'bottom' : progress <= RULES.topProgress && match !== 'fail' ? 'ready' : null;
    if (nextEndpoint !== endpoint) { endpoint = nextEndpoint; endpointSince = frame.timestampMs; }
    const atEndpoint = endpoint !== null && frame.timestampMs - endpointSince >= RULES.evidenceMs;
    if (atEndpoint) { phase = endpoint!; motion = null; }
    else if (lastProgress !== null) {
      const change = progress - lastProgress;
      const speed = change * 1000 / delta;
      const direction = speed > RULES.minProgressPerSecond ? 'down' : speed < -RULES.minProgressPerSecond ? 'up' : null;
      if (!direction) motion = null;
      else {
        if (direction !== motion) { motion = direction; motionSince = frame.timestampMs; motionStart = lastProgress; }
        if (frame.timestampMs - motionSince >= RULES.directionMs
          && Math.abs(progress - motionStart) >= RULES.minProgressExcursion) phase = direction;
      }
    }
    lastProgress = progress;
    const bottomReached = atEndpoint && endpoint === 'bottom' && match === 'pass';
    view = { ...view, calibrated:true, referenceId:fitted.id, phase, progress,
      bottomTarget:structuredClone(fitted.bottom), expectedPose:expected,
      tolerancePx:fitted.wristSpanPx * RULES.failDistance, arms, referenceMatch:match, bottomReached, corrections,
      cue:corrections[0]?.cue ?? (bottomReached ? 'Target reached.' : match === 'unknown'
        ? 'Hold a moment while the movement is measured.' : phase === 'up' ? 'Return to your starting position.' : 'Lower toward the dashed target.') };
    return snapshot();
  }
  return { calibrate, update, reset, finish() { finished = true; return snapshot(); } };
}
