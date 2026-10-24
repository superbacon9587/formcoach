/**
 * Display-only helpers for Person C. DOM-free so they can be unit tested.
 *
 * Nothing here measures form, applies thresholds or counts reps: every status
 * and count comes from B's SessionView / RepResult. These functions only turn
 * that state into words, icons and tallies for display.
 */
import type { CheckResults, CheckStatus, Phase, PoseFrame, RepResult } from '../shared/contracts';

export type CheckKey = keyof CheckResults;
export type Tone = 'neutral' | 'pass' | 'fail';

export const CHECK_KEYS: readonly CheckKey[] = ['alignment', 'depth', 'extension'];

export const CHECK_NAMES: Record<CheckKey, string> = {
  alignment: 'Body line',
  depth: 'Depth',
  extension: 'Lockout',
};

export const CHECK_HELP: Record<CheckKey, string> = {
  alignment: 'Shoulders, hips and ankles stay in one straight line (no sagging or piking).',
  depth: 'Elbows bend far enough at the bottom of each rep.',
  extension: 'Arms straighten at the top of each rep.',
};

export type StatusLabel = { text: string; icon: string; tone: Tone };

/** Disabled and unknown are always neutral - never shown as a pass. */
export function statusLabel(status: CheckStatus, enabled: boolean): StatusLabel {
  if (!enabled) return { text: 'Not assessed', icon: '–', tone: 'neutral' };
  if (status === 'pass') return { text: 'Pass', icon: '✓', tone: 'pass' };
  if (status === 'fail') return { text: 'Adjust', icon: '✕', tone: 'fail' };
  return { text: 'Unknown', icon: '?', tone: 'neutral' };
}

export function sourceLabel(frame: PoseFrame | null): string {
  if (!frame) return 'NO INPUT';
  return frame.source === 'mock' ? 'MOCK · SYNTHETIC LANDMARKS' : 'LIVE CAMERA';
}

/** Words for A's tracking state. Says nothing about form quality. */
export function trackingLabel(frame: PoseFrame | null): { text: string; tone: Tone } {
  if (!frame) return { text: 'Waiting for pose…', tone: 'neutral' };
  if (frame.tracking === 'valid') return { text: 'Body in view', tone: 'neutral' };
  if (frame.tracking === 'partial') {
    return { text: 'Partly in view - show hands through ankles from the side', tone: 'neutral' };
  }
  return { text: 'Pose lost - step back into frame, side view', tone: 'fail' };
}

export const PHASE_NAMES: Record<Phase, string> = {
  ready: 'Ready',
  down: 'Lowering',
  bottom: 'Bottom',
  up: 'Pushing up',
  paused: 'Paused',
};

export type CheckTally = {
  key: CheckKey;
  name: string;
  enabled: boolean;
  pass: number;
  fail: number;
  unknown: number;
  /** pass + fail. Unknown results are excluded from the denominator. */
  assessed: number;
  text: string;
};

/** Tally B's per-rep results for one check. Unknown is counted separately. */
export function tallyCheck(reps: readonly RepResult[], key: CheckKey, enabled: boolean): CheckTally {
  const name = CHECK_NAMES[key];
  let pass = 0, fail = 0, unknown = 0;
  for (const rep of reps) {
    const s = rep.checks[key];
    if (s === 'pass') pass++;
    else if (s === 'fail') fail++;
    else unknown++;
  }
  const assessed = pass + fail;
  let text: string;
  if (!enabled) text = 'Not assessed in this version';
  else if (assessed === 0) text = `No assessable reps${unknown ? ` (${unknown} unknown)` : ''}`;
  else {
    const pct = Math.round((100 * pass) / assessed);
    text = `${pass} of ${assessed} assessed reps passed (${pct}%)${unknown ? ` · ${unknown} unknown` : ''}`;
  }
  return { key, name, enabled, pass, fail, unknown, assessed, text };
}

export const OUTCOME_NAMES: Record<RepResult['outcome'], string> = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  unassessed: 'Not assessable',
};

export function formatSeconds(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 s';
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

export function formatDegrees(deg: number | null): string {
  return deg === null || !Number.isFinite(deg) ? '—' : `${Math.round(deg)}°`;
}

export function formatCount(n: number): string {
  return Number.isFinite(n) ? Math.max(0, Math.round(n)).toLocaleString('en-US') : '0';
}
