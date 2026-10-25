import type { GuidePlacement } from './front-guide';
import type { RepFeedback } from './quality';
import type { ArmPose, WorldPose, CoachSettings, CoachingFeedback, CameraView } from './coaching';
/** CONTRACT v2 - single-computer integration authorized by the team. */
export type Side = 'left' | 'right';
export type JointName = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';
export type Point = { x: number; y: number; visibility: number };
export type CheckStatus = 'unknown' | 'pass' | 'fail';
export type Phase = 'ready' | 'down' | 'bottom' | 'up' | 'paused';
export type PoseFrame = {
  timestampMs: number; // strictly increasing per source start
  width: number; height: number; // intrinsic video coordinates, NOT CSS pixels
  source: 'mock' | 'camera';
  side: Side | null;
  joints: Partial<Record<JointName, Point>>; // absent when tracking missing
  tracking: 'valid' | 'partial' | 'lost';
  cameraView?: CameraView;
  arms?: Partial<Record<Side, ArmPose>>;
  worldArms?: Partial<Record<Side, WorldPose>>;
};
export type CheckResults = { alignment: CheckStatus; depth: CheckStatus; extension: CheckStatus };
export type RepResult = {
  feedback?: RepFeedback;
  id: number; startedAtMs: number; endedAtMs: number;
  outcome: 'completed' | 'incomplete' | 'unassessed';
  minElbowDeg: number | null; finishElbowDeg: number | null;
  checks: CheckResults;
};
export type SessionView = {
  totalAttempts?: number;
  formScore?: number | null;
  suggestions?: string[];
  phase: Phase;
  coaching?: CoachingFeedback;
  completed: number; incomplete: number; unassessed: number;
  elbowDeg: number | null; hipDeviation: number | null;
  checks: CheckResults; cue: string | null;
  assessableMs: number; elapsedMs: number;
  enabledChecks: { alignment: boolean; depth: boolean; extension: boolean };
  reps: readonly RepResult[];
};
export interface Analyzer {
  update(frame: PoseFrame): SessionView;
  finish(timestampMs: number): SessionView;
  reset(): void;
  setGuide?(placement:GuidePlacement): SessionView;
  lockGuide?(): SessionView;
}
export type StopSource = () => void;
export type SourceOptions = {
  video: HTMLVideoElement;
  cameraView?: CameraView;
  onFrame: (frame: PoseFrame) => void;
  onStatus: (message: string) => void;
};
export interface CoachUI {
  video: HTMLVideoElement;
  bind(actions: { start(mode: 'mock' | 'camera', settings?: CoachSettings): Promise<void>; stop(): void; reset(): void; downloadDiagnostics?(): void; setGuide?(placement:GuidePlacement): void; lockGuide?(): void }): void;
  render(frame: PoseFrame | null, view: SessionView): void;
  setStatus(message: string): void;
  setRunning(running: boolean): void;
  destroy(): void;
}
