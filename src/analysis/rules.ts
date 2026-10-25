/** Provisional side-view thresholds from PERSON_B.md, to validate on real clips. */
export const RULES = {
  topDeg:160, startBelowDeg:145, minExcursionDeg:15,
  reversalDeg:3, reversalMs:120, descentMs:80, topHoldMs:200,
  trackingGraceMs:250, maxGapMs:250, smoothingMs:40,
  alignmentFail:0.05, alignmentRecover:0.035,
  alignmentEvidenceMs:200, alignmentRecoveryMs:300,
  minRepCoverage:0.8, depthDeg:90, rangeToleranceDeg:1,
  maxBodySlope:1,
} as const;
