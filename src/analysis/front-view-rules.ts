/** Experimental engineering tolerances, not validated exercise standards. */
export const FRONT_RULES = {
  failDistance: 0.08,
  passDistance: 0.05,
  evidenceMs: 200,
  recoveryMs: 300,
  trackingGapMs: 250,
  directionMs: 120,
  minProgressPerSecond: 0.01,
  minProgressExcursion: 0.03,
  topProgress: 0.1,
  bottomProgress: 0.9,
  maxReferenceHandDrift: 0.02,
  minReferenceShoulderMotion: 0.05
} as const;
