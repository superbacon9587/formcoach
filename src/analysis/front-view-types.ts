import type { CheckStatus, Phase, Point, PoseFrame, Side } from '../shared/contracts';

export type ArmJoint = 'shoulder' | 'elbow' | 'wrist';
export type ArmPose = Record<ArmJoint, Point>;
export type FrontPose = Record<Side, ArmPose>;
/** B-local proposed input. Not a replacement for the frozen shared PoseFrame. */
export type FrontFrame = Pick<PoseFrame, 'timestampMs' | 'width' | 'height' | 'source'> & {
  arms: Partial<Record<Side, Partial<ArmPose>>>;
};
/** Reviewed top/bottom samples from one fixed camera; no built-in ideal pose. */
export type FrontReference = { id: string; top: FrontPose; bottom: FrontPose };
export type FittedReference = FrontReference & { wristSpanPx: number };
export type ArmMeasurement = {
  elbowDeg: number | null;
  upperArmPx: number | null;
  forearmPx: number | null;
  bottomDistance: number | null;
  referenceError: number | null;
  referenceMatch: CheckStatus;
};
export type Correction = { side: Side; segment: 'upperArm' | 'forearm'; cue: string };
export type FrontView = {
  calibrated: boolean;
  referenceId: string | null;
  phase: Phase;
  progress: number | null;
  bottomTarget: FrontPose | null;
  expectedPose: FrontPose | null;
  tolerancePx: number | null;
  arms: Record<Side, ArmMeasurement>;
  referenceMatch: CheckStatus;
  bottomReached: boolean;
  corrections: Correction[];
  cue: string | null;
  elapsedMs: number;
  assessableMs: number;
};
