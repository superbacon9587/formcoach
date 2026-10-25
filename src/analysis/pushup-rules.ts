/** Engineering defaults, not validated biomechanical standards. */
export const PUSHUP_RULES = {
  topHoldMs:150, bottomHoldMs:0, returnHoldMs:60, feedbackHoldMs:350, feedbackRecoverMs:150,
  lostResetMs:700, maxFrameGapMs:1000, startMarginDeg:12,
  depthToleranceDeg:8, lockoutToleranceDeg:8, returnToleranceDeg:22,
  minimumAttemptMs:200, minimumDrop:0.18, recoveredDrop:0.10,
  symmetryFailDeg:30, symmetryRecoverDeg:18,
  hipFail:0.05, hipRecover:0.035, failLatchMs:1000,
} as const;
