/** Historical Person B engine retained for its original regression tests.
 * The app uses index.ts with the current group counter and preparation flow. */
import type { Analyzer, CheckStatus, PoseFrame, SessionView } from '../shared/contracts';
import { emptyView } from '../shared/defaults';
import { angleDeg, hipDeviation, isUsablePoint } from './metrics';
import { createAlignmentCheck } from './alignment';
import { createRepMachine } from './rep-machine';
import { RULES } from './rules';

/** The active v1 app supports side-view pushups. Front-view reference logic is separate. */
export function createAnalyzer(): Analyzer {
  const initial = (): SessionView => ({ ...emptyView(), enabledChecks:{ alignment:true, depth:true, extension:true } });
  let view = initial(), machine = createRepMachine(), alignment = createAlignmentCheck();
  let lastTime: number|null = null, meta: Pick<PoseFrame, 'width'|'height'|'side'|'source'>|null = null;
  let elapsedMs = 0, assessableMs = 0, previousAllValid = false, previousBodyValid = false;
  let smoothed: number|null = null, finished = false;
  const snapshot = () => structuredClone(view);
  function clearHistory() { smoothed = null; previousAllValid = previousBodyValid = false; alignment.reset(); }
  function publish(elbowDeg: number|null, deviation: number|null, status: CheckStatus, paused: boolean, cue: string|null) {
    const reps = machine.reps();
    view = { ...initial(), phase:paused ? 'paused' : machine.phase(), elbowDeg, hipDeviation:deviation,
      checks:{ alignment:status, ...(paused ? { depth:'unknown' as const, extension:'unknown' as const } : machine.checks()) },
      completed:reps.filter(r => r.outcome === 'completed').length,
      incomplete:reps.filter(r => r.outcome === 'incomplete').length,
      unassessed:reps.filter(r => r.outcome === 'unassessed').length,
      cue, elapsedMs, assessableMs, reps:structuredClone(reps) };
    return snapshot();
  }
  function bodySupported(frame: PoseFrame): boolean|null {
    const { shoulder, ankle, wrist } = frame.joints;
    if (!isUsablePoint(shoulder) || !isUsablePoint(ankle)) return null;
    const dx = Math.abs(ankle.x - shoulder.x), dy = Math.abs(ankle.y - shoulder.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx === 0) return false;
    return dy <= dx * RULES.maxBodySlope && (!isUsablePoint(wrist) || wrist.y > shoulder.y);
  }
  function alignmentCue(frame: PoseFrame): string {
    const { shoulder:s, hip:h, ankle:a } = frame.joints;
    if (!isUsablePoint(s) || !isUsablePoint(h) || !isUsablePoint(a) || a.x === s.x) return 'Keep shoulders, hips and ankles in one line.';
    const residual = h.y - (s.y + (a.y - s.y) * (h.x - s.x) / (a.x - s.x));
    return residual > 0 ? 'Raise your hips into line with your body.' : 'Lower your hips into line with your body.';
  }
  return {
    update(frame) {
      if (finished) return snapshot();
      if (!Number.isFinite(frame.timestampMs) || frame.timestampMs < 0
        || !Number.isFinite(frame.width) || frame.width <= 0 || !Number.isFinite(frame.height) || frame.height <= 0
        || (lastTime !== null && frame.timestampMs <= lastTime)) {
        machine.pause(lastTime ?? 0); clearHistory();
        return publish(null, null, 'unknown', true, 'Waiting for fresh camera measurements.');
      }
      const delta = lastTime === null ? 0 : frame.timestampMs - lastTime;
      const changed = meta !== null && (frame.width !== meta.width || frame.height !== meta.height
        || frame.source !== meta.source || (frame.side !== null && meta.side !== null && frame.side !== meta.side));
      lastTime = frame.timestampMs;
      meta = { width:frame.width, height:frame.height, source:frame.source, side:frame.side ?? meta?.side ?? null };
      if (changed || delta > RULES.maxGapMs) {
        machine.boundary(frame.timestampMs); clearHistory();
        return publish(null, null, 'unknown', true, 'Tracking changed. Hold the top position to restart counting.');
      }
      elapsedMs += delta;
      const tracking = frame.tracking !== 'lost' && frame.side !== null;
      const { shoulder, elbow, wrist, hip, ankle } = frame.joints;
      const raw = tracking ? angleDeg(shoulder, elbow, wrist) : null;
      const supported = tracking ? bodySupported(frame) : null;
      const deviation = tracking && supported === true ? hipDeviation(shoulder, hip, ankle) : null;
      const alignmentStatus = alignment.update(deviation, frame.timestampMs);
      const allValid = raw !== null && deviation !== null && supported === true;
      if (previousAllValid && allValid) assessableMs += delta;
      const bodyInterval = previousBodyValid && deviation !== null ? delta : 0;
      previousAllValid = allValid; previousBodyValid = deviation !== null;
      if (raw === null || supported === false) {
        smoothed = null; machine.pause(frame.timestampMs);
        return publish(raw, deviation, alignmentStatus, true, raw === null
          ? 'Keep your shoulder, elbow and wrist visible.' : 'Use a side view with your body in the pushup position.');
      }
      smoothed = smoothed === null ? raw : smoothed + (1 - Math.exp(-delta / RULES.smoothingMs)) * (raw - smoothed);
      machine.update({ time:frame.timestampMs, rawDeg:raw, smoothDeg:smoothed, supportedTop:supported === true,
        alignment:alignmentStatus, alignmentFailureObserved:alignmentStatus === 'fail'
          && deviation !== null && deviation > RULES.alignmentFail, alignmentIntervalMs:bodyInterval });
      const phase = machine.phase(), range = machine.checks();
      const cue = alignmentStatus === 'fail' ? alignmentCue(frame)
        : phase === 'down' ? 'Lower with control.' : phase === 'bottom' ? 'Push back up when ready.'
        : phase === 'up' ? (range.depth === 'fail' ? 'Use a fuller range on your next rep.' : 'Push back to the top.')
        : supported !== true ? 'Show your full body from the side to begin.'
        : raw < RULES.topDeg ? 'Straighten your arms and hold the top position.'
        : 'Hold the top position, then lower with control.';
      return publish(raw, deviation, alignmentStatus, false, cue);
    },
    finish(timestampMs) {
      if (finished) return snapshot();
      // main calls finish(0) to display empty state immediately after reset.
      if (lastTime === null) return snapshot();
      const time = Number.isFinite(timestampMs) && timestampMs >= (lastTime ?? 0) ? timestampMs : lastTime ?? 0;
      if (lastTime !== null && time - lastTime > RULES.maxGapMs) {
        machine.boundary(time); clearHistory();
        view.checks = { alignment:'unknown', depth:'unknown', extension:'unknown' };
        view.elbowDeg = view.hipDeviation = null; view.phase = 'paused';
      }
      if (lastTime !== null && time - lastTime <= RULES.maxGapMs) elapsedMs += time - lastTime;
      machine.finish(time); finished = true;
      return publish(view.elbowDeg, view.hipDeviation, view.checks.alignment, view.phase === 'paused', view.cue);
    },
    reset() {
      view = initial(); machine = createRepMachine(); alignment = createAlignmentCheck();
      lastTime = null; meta = null; elapsedMs = assessableMs = 0; finished = false; clearHistory();
    }
  };
}
