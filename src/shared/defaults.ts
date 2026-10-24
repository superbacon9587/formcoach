import type { SessionView } from './contracts';
/** Fresh object every call. Disabled/unknown is never a pass. */
export function emptyView(): SessionView {
  return { phase:'ready', completed:0, incomplete:0, unassessed:0,
    elbowDeg:null, hipDeviation:null,
    checks:{alignment:'unknown',depth:'unknown',extension:'unknown'}, cue:null,
    assessableMs:0, elapsedMs:0,
    enabledChecks:{alignment:false,depth:false,extension:false}, reps:[] };
}
