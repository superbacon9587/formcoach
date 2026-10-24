import test from 'node:test';
import assert from 'node:assert/strict';
import type { CheckStatus, RepResult } from '../../src/shared/contracts';
import { emptyView } from '../../src/shared/defaults';
import { mockFrame } from '../../src/fixtures/mock';
import {
  formatCount, formatDegrees, formatSeconds, sourceLabel, statusLabel, tallyCheck, trackingLabel,
} from '../../src/ui/labels';

const rep = (id: number, alignment: CheckStatus, outcome: RepResult['outcome'] = 'completed'): RepResult => ({
  id, startedAtMs: id * 1000, endedAtMs: id * 1000 + 900, outcome,
  minElbowDeg: null, finishElbowDeg: null,
  checks: { alignment, depth: 'unknown', extension: 'unknown' },
});

test('disabled and unknown checks are neutral, never a pass', () => {
  for (const s of ['unknown', 'pass', 'fail'] as const) {
    assert.equal(statusLabel(s, false).tone, 'neutral');
    assert.equal(statusLabel(s, false).text, 'Not assessed');
  }
  assert.equal(statusLabel('unknown', true).tone, 'neutral');
  assert.equal(statusLabel('pass', true).tone, 'pass');
  assert.equal(statusLabel('fail', true).tone, 'fail');
});

test('every status has text and an icon, so colour is never the only signal', () => {
  for (const s of ['unknown', 'pass', 'fail'] as const) for (const on of [true, false]) {
    const l = statusLabel(s, on);
    assert.ok(l.text.length > 0 && l.icon.length > 0);
  }
});

test('unknown results are excluded from the pass denominator and counted separately', () => {
  const t = tallyCheck([rep(1, 'pass'), rep(2, 'fail'), rep(3, 'unknown'), rep(4, 'pass')], 'alignment', true);
  assert.deepEqual([t.pass, t.fail, t.unknown, t.assessed], [2, 1, 1, 3]);
  assert.match(t.text, /2 of 3 assessed reps passed \(67%\)/);
  assert.match(t.text, /1 unknown/);
});

test('no assessable reps shows no percentage', () => {
  const t = tallyCheck([rep(1, 'unknown'), rep(2, 'unknown')], 'alignment', true);
  assert.equal(t.assessed, 0);
  assert.doesNotMatch(t.text, /%/);
  assert.match(t.text, /No assessable reps/);
  assert.doesNotMatch(tallyCheck([], 'alignment', true).text, /%|NaN/);
});

test('disabled checks say not assessed even if rep data exists', () => {
  const t = tallyCheck([rep(1, 'pass')], 'alignment', false);
  assert.match(t.text, /Not assessed/);
  assert.doesNotMatch(t.text, /%/);
});

test('mock input is always labelled synthetic', () => {
  assert.match(sourceLabel(mockFrame(0)), /SYNTHETIC/);
  assert.equal(sourceLabel(null), 'NO INPUT');
  assert.equal(sourceLabel({ ...mockFrame(0), source: 'camera' }), 'LIVE CAMERA');
});

test('lost pose is reported, not hidden', () => {
  const lost = { ...mockFrame(0), joints: {}, tracking: 'lost' as const };
  assert.equal(trackingLabel(lost).tone, 'fail');
  assert.match(trackingLabel(null).text, /Waiting/);
});

test('formatting handles empty, huge and invalid values', () => {
  assert.equal(formatDegrees(null), '—');
  assert.equal(formatDegrees(91.6), '92°');
  assert.equal(formatCount(123456), '123,456');
  assert.equal(formatCount(Number.NaN), '0');
  assert.equal(formatSeconds(0), '0 s');
  assert.equal(formatSeconds(12_340), '12.3 s');
  assert.equal(formatSeconds(125_000), '2 min 5 s');
  assert.equal(emptyView().reps.length, 0);
});
