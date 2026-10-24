import test from 'node:test';
import assert from 'node:assert/strict';
import type { Point } from '../../src/shared/contracts';
import { createFrontViewAnalyzer, fitReference } from '../../src/analysis/front-view';

const p = (x: number, y: number): Point => ({ x, y, visibility: 1 });
const top = {
  left: { shoulder: p(160, 100), elbow: p(140, 200), wrist: p(100, 300) },
  right: { shoulder: p(340, 100), elbow: p(360, 200), wrist: p(400, 300) }
};
const bottom = {
  left: { shoulder: p(150, 180), elbow: p(90, 230), wrist: p(100, 300) },
  right: { shoulder: p(350, 180), elbow: p(410, 230), wrist: p(400, 300) }
};
const reference = () => ({ id: 'synthetic-geometry-only', top: structuredClone(top), bottom: structuredClone(bottom) });
const frame = (timestampMs: number, progress = 0) => ({ timestampMs, width: 640, height: 480,
  source: 'mock' as const, arms: {
    left: { shoulder: p(160 - 10 * progress, 100 + 80 * progress), elbow: p(140 - 50 * progress, 200 + 30 * progress), wrist: p(100, 300) },
    right: { shoulder: p(340 + 10 * progress, 100 + 80 * progress), elbow: p(360 + 50 * progress, 200 + 30 * progress), wrist: p(400, 300) }
  } });
function calibrated() {
  const a = createFrontViewAnalyzer(reference());
  assert.equal(a.calibrate(frame(0)).calibrated, true);
  return a;
}

test('missing reference keeps target and decisions unknown', () => {
  const out = createFrontViewAnalyzer().update(frame(0));
  assert.equal(out.calibrated, false);
  assert.equal(out.bottomTarget, null);
  assert.equal(out.referenceMatch, 'unknown');
  assert.equal(out.arms.left.elbowDeg !== null, true);
});

test('reference fit maps translated and scaled hands and target together', () => {
  const input = frame(0);
  for (const arm of Object.values(input.arms)) for (const joint of Object.values(arm)) {
    joint.x = joint.x * 0.5 + 20;
    joint.y = joint.y * 0.5 + 30;
  }
  const fitted = fitReference(reference(), input);
  assert.ok(fitted);
  assert.equal(fitted.bottom.left.wrist.x, 70);
  assert.equal(fitted.bottom.right.wrist.x, 220);
  assert.equal(fitted.bottom.left.shoulder.y, 120);
});

test('rejects degenerate, invisible or motionless references and bent setup', () => {
  const noMotion = reference(); noMotion.bottom = structuredClone(noMotion.top);
  assert.equal(fitReference(noMotion, frame(0)), null);
  const invisible = reference(); invisible.bottom.left.elbow.visibility = 0.2;
  assert.equal(fitReference(invisible, frame(0)), null);
  const bad = frame(0); bad.arms.right.wrist = p(100, 300);
  assert.equal(fitReference(reference(), bad), null);
  const a = createFrontViewAnalyzer(reference());
  assert.equal(a.calibrate(frame(0, 1)).calibrated, false);
});

test('good lowering matches its current stage, not the bottom destination', () => {
  const a = calibrated();
  const first = a.update(frame(100, 0.5));
  assert.equal(first.referenceMatch, 'unknown');
  const out = a.update(frame(300, 0.5));
  assert.equal(out.referenceMatch, 'pass');
  assert.equal(out.progress, 0.5);
  assert.equal(out.bottomReached, false);
  assert.equal(out.bottomTarget!.left.shoulder.y, 180);
  assert.equal(out.expectedPose!.left.shoulder.y, 140);
});

test('phase changes require sustained motion; slow bottom holds remain valid', () => {
  const a = calibrated();
  a.update(frame(100, 0));
  assert.equal(a.update(frame(200, 0.2)).phase, 'ready');
  assert.equal(a.update(frame(340, 0.4)).phase, 'down');
  a.update(frame(440, 1));
  let out = a.update(frame(640, 1));
  assert.equal(out.phase, 'bottom');
  assert.equal(out.bottomReached, true);
  for (let time = 840; time <= 2040; time += 200) out = a.update(frame(time, 1));
  assert.equal(out.bottomReached, true);
  a.update(frame(2140, 0.8));
  assert.equal(a.update(frame(2280, 0.6)).phase, 'up');
});

test('sustained left-arm deviation returns a left correction, not both arms red', () => {
  const a = calibrated();
  const bad = (t: number) => {
    const f = frame(t, 0.5); f.arms.left.elbow.x -= 90; return f;
  };
  a.update(bad(100));
  const out = a.update(bad(300));
  assert.equal(out.arms.left.referenceMatch, 'fail');
  assert.equal(out.referenceMatch, 'fail');
  assert.ok(out.corrections.some(c => c.side === 'left' && c.segment === 'upperArm'));
  assert.ok(!out.corrections.some(c => c.side === 'right'));
  assert.match(out.cue!, /left/i);
});

test('a bad frame is filtered; invalid data breaks continuous evidence', () => {
  const a = calibrated();
  const bad = frame(100, 0.5); bad.arms.left.wrist.x -= 90;
  assert.equal(a.update(bad).referenceMatch, 'unknown');
  const lost = frame(200, 0.5); lost.arms.left.elbow.visibility = 0;
  assert.equal(a.update(lost).referenceMatch, 'unknown');
  assert.equal(a.update(frame(300, 0.5)).referenceMatch, 'unknown');
  assert.equal(a.update(frame(500, 0.5)).referenceMatch, 'pass');
});

test('recovery needs sustained good data and hand target does not follow mistakes', () => {
  const a = calibrated();
  const moved = (t: number) => { const f = frame(t, 0.5); f.arms.left.wrist.x -= 80; return f; };
  a.update(moved(100));
  assert.equal(a.update(moved(300)).referenceMatch, 'fail');
  assert.equal(a.update(frame(400, 0.5)).referenceMatch, 'fail');
  a.update(frame(600, 0.5));
  const out = a.update(frame(700, 0.5));
  assert.equal(out.referenceMatch, 'pass');
  assert.equal(out.bottomTarget!.left.wrist.x, 100);
});

test('long loss, timestamp gaps and dimensions changes require recalibration', () => {
  for (const mode of ['loss', 'gap', 'dimensions'] as const) {
    const a = calibrated(); a.update(frame(100, 0.5));
    let input = frame(200, 0.5);
    if (mode === 'loss') {
      input.arms.left.shoulder.visibility = 0;
      a.update(input);
      input = frame(500, 0.5); input.arms.left.shoulder.visibility = 0;
    } else if (mode === 'gap') input.timestampMs = 1000;
    else input.width = 800;
    const out = a.update(input);
    assert.equal(out.calibrated, false, mode);
    assert.equal(out.referenceMatch, 'unknown', mode);
    assert.equal(out.bottomTarget, null, mode);
  }
});

test('invalid timestamps cannot change evidence or advance progress', () => {
  const a = calibrated();
  a.update(frame(100, 0.5));
  const out = a.update(frame(100, 1));
  assert.equal(out.referenceMatch, 'unknown');
  assert.equal(out.phase, 'paused');
  assert.equal(out.bottomReached, false);
});

test('inputs and returned snapshots are independent; finish is idempotent and reset complete', () => {
  const ref = reference(); const a = createFrontViewAnalyzer(ref);
  const input = frame(0); const before = structuredClone(input);
  a.calibrate(input);
  const out = a.update(frame(100, 0.5)); const saved = structuredClone(out);
  ref.bottom.left.shoulder.y = 999;
  a.update(frame(300, 1));
  assert.deepEqual(out, saved);
  assert.deepEqual(input, before);
  assert.deepEqual(a.finish(), a.finish());
  const reset = a.reset();
  assert.equal(reset.calibrated, false);
  assert.equal(reset.bottomTarget, null);
  assert.equal(reset.elapsedMs, 0);
  assert.equal(reset.assessableMs, 0);
});

test('tracking coverage excludes blind intervals and never exceeds elapsed time', () => {
  const a = calibrated();
  a.update(frame(100, 0.5)); a.update(frame(200, 0.5));
  const lost = frame(300, 0.5); lost.arms.left.elbow.visibility = 0;
  a.update(lost);
  const out = a.update(frame(400, 0.5));
  assert.equal(out.elapsedMs, 400);
  assert.equal(out.assessableMs, 200);
  assert.ok(out.assessableMs <= out.elapsedMs);
});

test('slow movement is detected at different camera frame rates', () => {
  for (const interval of [16, 33, 100]) {
    const a = calibrated();
    let out = a.calibrate(frame(0));
    for (let time = interval; time <= 1000; time += interval) out = a.update(frame(time, time / 2000));
    assert.equal(out.phase, 'down', `${interval} ms frame interval`);
  }
});

test('finish freezes updates until reset and no cycle count is fabricated', () => {
  const a = calibrated(); a.update(frame(100, 0.5));
  const ended = a.finish();
  assert.deepEqual(a.update(frame(300, 1)), ended);
  a.reset();
  assert.equal(a.update(frame(400)).calibrated, false);
});

test('overflowing comparison geometry stays unknown instead of becoming zero error', () => {
  const a = createFrontViewAnalyzer(reference());
  const initial = frame(0); initial.width = Number.MAX_VALUE; initial.height = Number.MAX_VALUE;
  a.calibrate(initial);
  const huge = frame(100); huge.width = initial.width; huge.height = initial.height;
  huge.arms.left = { shoulder:p(1.7e308, 1.7e308), elbow:p(1.6e308, 1.7e308), wrist:p(1.5e308, 1.7e308) };
  a.update(huge);
  const out = a.update({ ...huge, timestampMs:300 });
  assert.equal(out.referenceMatch, 'unknown');
  assert.equal(out.bottomReached, false);
  assert.equal(out.assessableMs, 0);
});

test('reference fit rotates target with the planted hand baseline', () => {
  const input = frame(0);
  for (const arm of Object.values(input.arms)) for (const joint of Object.values(arm)) {
    const x = joint.x; joint.x = 500 - joint.y; joint.y = x;
  }
  const fitted = fitReference(reference(), input);
  assert.ok(fitted);
  assert.equal(fitted.bottom.left.wrist.x, 200);
  assert.equal(fitted.bottom.left.wrist.y, 100);
  assert.equal(fitted.bottom.left.shoulder.x, 320);
  assert.equal(fitted.bottom.left.shoulder.y, 150);
});
