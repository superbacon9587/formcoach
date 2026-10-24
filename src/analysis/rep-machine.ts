import type { CheckResults, CheckStatus, Phase, RepResult } from '../shared/contracts';
import { RULES } from './rules';

type Attempt = { startedAtMs:number; topDeg:number; minDeg:number; finishDeg:number|null;
  obscured:boolean; alignmentFailed:boolean; alignmentPassed:boolean; alignmentValidMs:number; hasUp:boolean };
type Sample = { time:number; rawDeg:number; smoothDeg:number; supportedTop:boolean;
  alignment:CheckStatus; alignmentFailureObserved:boolean; alignmentIntervalMs:number };
const unknownChecks = (): CheckResults => ({ alignment:'unknown', depth:'unknown', extension:'unknown' });

export function createRepMachine() {
  let phase: Phase = 'ready', armed = false, attempt: Attempt | null = null;
  let topSince: number|null = null, reverseSince: number|null = null, downSince: number|null = null, startSince: number|null = null;
  let lossSince: number|null = null, topDeg = 180, upPeak = 0;
  const reps: RepResult[] = [];
  function clearTransitions() { topSince = reverseSince = downSince = startSince = null; }
  function rangeChecks(a: Attempt): Pick<CheckResults, 'depth'|'extension'> {
    return { depth:a.obscured || a.topDeg - a.minDeg < RULES.minExcursionDeg ? 'unknown'
      : a.minDeg <= RULES.depthDeg + RULES.rangeToleranceDeg ? 'pass' : 'fail',
      extension:a.obscured || !a.hasUp || a.finishDeg === null ? 'unknown'
        : a.finishDeg >= RULES.topDeg - RULES.rangeToleranceDeg ? 'pass' : 'fail' };
  }
  function close(time: number, outcome: RepResult['outcome']) {
    if (!attempt) return;
    const duration = time - attempt.startedAtMs;
    const alignment: CheckStatus = attempt.alignmentFailed ? 'fail'
      : attempt.alignmentPassed && attempt.alignmentValidMs >= RULES.alignmentEvidenceMs
        && duration > 0 && attempt.alignmentValidMs / duration >= RULES.minRepCoverage ? 'pass' : 'unknown';
    reps.push({ id:reps.length + 1, startedAtMs:attempt.startedAtMs, endedAtMs:time,
      outcome:attempt.obscured ? 'unassessed' : outcome,
      minElbowDeg:attempt.minDeg, finishElbowDeg:attempt.finishDeg,
      checks:{ alignment, ...rangeChecks(attempt) } });
    attempt = null; clearTransitions(); phase = 'ready';
  }
  function begin(sample: Sample, fromTop: number) {
    attempt = { startedAtMs:sample.time, topDeg:fromTop, minDeg:sample.smoothDeg,
      finishDeg:null, obscured:false, alignmentFailed:sample.alignmentFailureObserved,
      alignmentPassed:sample.alignment === 'pass', alignmentValidMs:0, hasUp:false };
    clearTransitions(); upPeak = 0; phase = 'down'; armed = false;
  }
  function boundary(time: number) {
    if (attempt) { attempt.obscured = true; close(time, 'unassessed'); }
    armed = false; lossSince = null; clearTransitions(); phase = 'paused';
  }
  return {
    boundary,
    pause(time: number) {
      lossSince ??= time;
      if (attempt) attempt.obscured = true;
      else armed = false;
      clearTransitions();
      if (time - lossSince >= RULES.trackingGraceMs) boundary(time);
    },
    update(sample: Sample) {
      if (lossSince !== null && sample.time - lossSince >= RULES.trackingGraceMs) boundary(sample.time);
      lossSince = null;
      if (phase === 'paused') phase = attempt?.hasUp ? 'up' : attempt ? 'down' : 'ready';
      if (!attempt) {
        if (!armed) {
          if (sample.supportedTop && sample.rawDeg >= RULES.topDeg) {
            topSince ??= sample.time;
            if (sample.time - topSince >= RULES.topHoldMs) { armed = true; topDeg = sample.smoothDeg; }
          } else topSince = null;
        } else if (sample.rawDeg < RULES.startBelowDeg && topDeg - sample.smoothDeg >= RULES.minExcursionDeg) {
          startSince ??= sample.time;
          if (sample.time - startSince >= RULES.descentMs) begin(sample, topDeg);
        } else startSince = null;
        return;
      }
      const current = attempt;
      current.minDeg = Math.min(current.minDeg, sample.smoothDeg);
      current.alignmentFailed ||= sample.alignmentFailureObserved;
      current.alignmentPassed ||= sample.alignment === 'pass';
      current.alignmentValidMs += sample.alignmentIntervalMs;
      if (!current.hasUp) {
        if (sample.smoothDeg - current.minDeg >= RULES.reversalDeg
          && current.topDeg - current.minDeg >= RULES.minExcursionDeg) {
          reverseSince ??= sample.time; phase = 'bottom';
          if (sample.time - reverseSince >= RULES.reversalMs) {
            current.hasUp = true; phase = 'up'; upPeak = sample.smoothDeg;
            current.finishDeg = sample.smoothDeg; topSince = null;
          }
        } else { reverseSince = null; phase = 'down'; }
        return;
      }
      phase = 'up';
      current.finishDeg = Math.max(current.finishDeg ?? sample.smoothDeg, sample.smoothDeg);
      upPeak = Math.max(upPeak, sample.smoothDeg);
      if (sample.rawDeg >= RULES.topDeg) {
        topSince ??= sample.time;
        if (sample.time - topSince >= RULES.topHoldMs) {
          close(sample.time, 'completed'); armed = sample.supportedTop; topDeg = sample.smoothDeg;
          return;
        }
      } else topSince = null;
      if (upPeak - sample.smoothDeg >= RULES.minExcursionDeg && sample.rawDeg < RULES.startBelowDeg) {
        downSince ??= sample.time;
        if (sample.time - downSince >= RULES.reversalMs) {
          const peak = upPeak; close(sample.time, 'incomplete'); begin(sample, peak);
        }
      } else downSince = null;
    },
    finish(time: number) { close(time, 'incomplete'); armed = false; },
    phase: () => phase,
    reps: () => reps,
    checks(): Pick<CheckResults, 'depth'|'extension'> {
      if (attempt) return { depth:attempt.hasUp ? rangeChecks(attempt).depth : 'unknown', extension:'unknown' };
      const last = reps.at(-1)?.checks ?? unknownChecks();
      return { depth:last.depth, extension:last.extension };
    }
  };
}
