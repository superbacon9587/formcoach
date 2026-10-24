import type { Analyzer, SessionView } from '../shared/contracts';
import { emptyView } from '../shared/defaults';
import { angleDeg } from './metrics';

/** Measurement milestone only: no form checks or rep counting are enabled yet. */
export function createAnalyzer(): Analyzer {
  let view: SessionView = emptyView();
  const snapshot = (): SessionView => ({ ...view, checks: { ...view.checks },
    enabledChecks: { ...view.enabledChecks }, reps: [] });
  return {
    update(frame) {
      const { shoulder, elbow, wrist } = frame.joints;
      const elbowDeg = frame.tracking === 'lost' ? null : angleDeg(shoulder, elbow, wrist);
      view = { ...emptyView(), elbowDeg, phase: elbowDeg === null ? 'paused' : 'ready',
        cue: elbowDeg === null ? 'Keep your shoulder, elbow and wrist visible.' : null };
      return snapshot();
    },
    finish() { return snapshot(); },
    reset() { view = emptyView(); }
  };
}
