import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyzer } from '../../src/analysis';
import { hipDeviation } from '../../src/analysis/metrics';
import type { Point, PoseFrame } from '../../src/shared/contracts';

const p = (x: number, y: number, visibility = 1): Point => ({ x, y, visibility });
function sample(time: number, angle = 180, deviation = 0): PoseFrame {
  const radians = angle * Math.PI / 180;
  const shoulder = p(200 + 100 * Math.sin(radians), 200 + 100 * Math.cos(radians));
  return { timestampMs:time, width:640, height:480, source:'mock', side:'left', tracking:'valid',
    joints:{ shoulder, elbow:p(200, 200), wrist:p(200, 300),
      hip:p(shoulder.x + 150, shoulder.y + deviation * 300),
      knee:p(shoulder.x + 225, shoulder.y), ankle:p(shoulder.x + 300, shoulder.y) } };
}
function harness(interval = 20) {
  const a = createAnalyzer(); let time = 0, angle = 180, deviation = 0;
  let view = a.update(sample(time, angle, deviation));
  return { a, get time() { return time; }, get view() { return view; },
    hold(nextAngle: number, duration: number, dev = deviation) {
      angle = nextAngle; deviation = dev;
      for (let elapsed = 0; elapsed < duration; elapsed += interval) {
        time += interval; view = a.update(sample(time, angle, deviation));
      }
      return view;
    },
    ramp(next: number, duration: number, dev = deviation) {
      const from = angle; deviation = dev;
      const steps = Math.ceil(duration / interval);
      for (let step = 1; step <= steps; step++) {
        angle = from + (next - from) * step / steps; time += interval;
        view = a.update(sample(time, angle, deviation));
      }
      return view;
    },
    frame(f: PoseFrame) { time = f.timestampMs; view = a.update(f); return view; }
  };
}
function cycle(h: ReturnType<typeof harness>, bottom = 80, duration = 600) {
  h.ramp(bottom, duration); h.hold(bottom, 200); h.ramp(180, duration); return h.hold(180, 300);
}

test('normalized hip deviation is scale/translation invariant and rejects invalid geometry', () => {
  assert.equal(hipDeviation(p(0, 0), p(50, 10), p(100, 0)), 0.1);
  assert.equal(hipDeviation(p(20, 30), p(120, 50), p(220, 30)), 0.1);
  assert.equal(hipDeviation(p(100, 0), p(50, 10), p(0, 0)), 0.1);
  assert.equal(hipDeviation(p(0, 0), p(50, 0), p(100, 0)), 0);
  for (const hip of [undefined, p(0, NaN), p(10, 10, 0.2)]) assert.equal(hipDeviation(p(0, 0), hip, p(100, 0)), null);
  assert.equal(hipDeviation(p(0, 0), p(10, 10), p(0, 0)), null);
});

test('one supported cycle counts once and records phase-specific ranges', () => {
  const h = harness(); h.hold(180, 300);
  h.ramp(80, 600); assert.equal(h.view.phase, 'down');
  h.hold(80, 300); h.ramp(120, 400); assert.equal(h.view.phase, 'up');
  h.ramp(180, 400); const out = h.hold(180, 300);
  assert.equal(out.completed, 1); assert.equal(out.incomplete, 0);
  assert.equal(out.reps.length, 1); assert.equal(out.phase, 'ready');
  assert.ok(out.reps[0].minElbowDeg! < 85);
  assert.ok(out.reps[0].finishElbowDeg! >= 160);
  assert.deepEqual(out.reps[0].checks, { alignment:'pass', depth:'pass', extension:'pass' });
  assert.equal(h.hold(180, 1000).completed, 1);
});

test('initial bent-arm setup, standing arm movements and top jitter do not count', () => {
  const a = createAnalyzer();
  for (let t = 0; t <= 500; t += 20) a.update(sample(t, 90));
  assert.equal(a.finish(500).reps.length, 0);
  const h = harness();
  for (let t = 20; t < 2000; t += 20) h.frame(sample(t, t % 40 ? 161 : 168));
  assert.equal(h.view.completed, 0);
  const standing = createAnalyzer();
  for (let t = 0; t < 2000; t += 20) {
    const f = sample(t, t < 400 || t > 1500 ? 180 : 90);
    const s = f.joints.shoulder!; f.joints.ankle = p(s.x, s.y + 300);
    standing.update(f);
  }
  assert.equal(standing.finish(2000).reps.length, 0);
});

test('shallow movement counts as a cycle with a failed depth target only after ascent', () => {
  const h = harness(); h.hold(180, 300); h.ramp(120, 500);
  assert.equal(h.view.checks.depth, 'unknown');
  h.hold(120, 200); h.ramp(180, 500); const out = h.hold(180, 300);
  assert.equal(out.completed, 1); assert.equal(out.reps[0].checks.depth, 'fail');
});

test('unfinished extension cannot borrow the initial top angle', () => {
  const h = harness(); h.hold(180, 300); h.ramp(80, 600); h.hold(80, 200);
  h.ramp(150, 600); h.hold(150, 300);
  assert.equal(h.view.completed, 0);
  const out = h.a.finish(h.time);
  assert.equal(out.incomplete, 1);
  assert.equal(out.reps[0].checks.extension, 'fail');
  assert.ok(out.reps[0].finishElbowDeg! < 160);
  assert.deepEqual(h.a.finish(h.time + 100), out);
});

test('a sustained new descent closes one incomplete attempt and allows the next', () => {
  const h = harness(); h.hold(180, 300); h.ramp(80, 600); h.hold(80, 200);
  h.ramp(150, 600); h.hold(150, 200); h.ramp(80, 600); h.hold(80, 400);
  assert.equal(h.view.incomplete, 1);
  h.ramp(180, 600); const out = h.hold(180, 300);
  assert.equal(out.completed, 1); assert.equal(out.incomplete, 1);
});

test('sustained alignment fault is sticky for the rep but live feedback can recover', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600, 0.08);
  assert.equal(h.view.checks.alignment, 'fail');
  h.hold(100, 500, 0); assert.equal(h.view.checks.alignment, 'pass');
  h.ramp(180, 600); const out = h.hold(180, 300);
  assert.equal(out.reps.length, 1); assert.equal(out.reps[0].checks.alignment, 'fail');
});

test('one bad alignment frame is filtered and missing body data is immediately unknown', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600);
  h.hold(100, 20, 0.1); assert.notEqual(h.view.checks.alignment, 'fail');
  h.hold(100, 100, 0);
  const f = sample(h.time + 20, 100); delete f.joints.hip;
  assert.equal(h.frame(f).checks.alignment, 'unknown');
  h.hold(100, 100, 0.1); assert.equal(h.view.checks.alignment, 'unknown');
});

test('body-only tracking loss can leave counting available but alignment unassessed', () => {
  const h = harness(); h.hold(180, 300);
  const path = [140, 120, 100, 80, 80, 100, 120, 140, 165, 180, 180, 180];
  for (const angle of path) {
    const f = sample(h.time + 100, angle); delete f.joints.hip; h.frame(f);
  }
  assert.equal(h.view.completed, 1);
  assert.equal(h.view.reps[0].checks.alignment, 'unknown');
});

test('brief blind arm interval never becomes an assessed completed cycle', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600);
  const lost = sample(h.time + 20); lost.tracking = 'lost'; lost.joints = {};
  assert.equal(h.frame(lost).phase, 'paused');
  h.hold(100, 100); h.ramp(80, 200); h.hold(80, 200); h.ramp(180, 600); h.hold(180, 300);
  assert.equal(h.view.completed, 0);
  assert.equal(h.view.unassessed, 1);
});

test('long arm loss closes once, requires a new top, and does not double count on Stop', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600);
  for (let n = 0; n < 20; n++) h.frame({ ...sample(h.time + 20), joints:{}, tracking:'lost', side:null });
  assert.equal(h.view.unassessed, 1);
  h.hold(100, 200); h.ramp(180, 500); h.hold(180, 300);
  assert.equal(h.view.completed, 0); assert.equal(h.a.finish(h.time).unassessed, 1);
});

test('side, dimensions, source or timestamp gaps never bridge attempts', () => {
  for (const kind of ['side', 'dimensions', 'source', 'gap'] as const) {
    const h = harness(); h.hold(180, 300); h.ramp(100, 600);
    const f = sample(h.time + (kind === 'gap' ? 2000 : 20), 100);
    if (kind === 'side') f.side = 'right';
    if (kind === 'dimensions') f.width = 800;
    if (kind === 'source') f.source = 'camera';
    const out = h.frame(f);
    assert.equal(out.completed, 0, kind); assert.equal(out.unassessed, 1, kind);
    assert.equal(out.phase, 'paused', kind);
    assert.ok(out.assessableMs <= out.elapsedMs);
  }
});

test('slow reps and paused bottoms work at different frame rates', () => {
  for (const interval of [16, 33, 100]) {
    const h = harness(interval); h.hold(180, 400);
    h.ramp(80, 3000); h.hold(80, 2000); h.ramp(180, 3000); h.hold(180, 400);
    assert.equal(h.view.completed, 1, String(interval));
    assert.equal(h.view.reps[0].checks.depth, 'pass');
  }
});

test('elapsed time starts at the first timestamp; invalid frames add no assessable time', () => {
  const a = createAnalyzer(); const first = a.update(sample(500000));
  assert.equal(first.elapsedMs, 0);
  assert.equal(a.update(sample(500100)).elapsedMs, 100);
  const invalid = sample(500200); delete invalid.joints.hip;
  const out = a.update(invalid);
  assert.equal(out.elapsedMs, 200); assert.equal(out.assessableMs, 100);
  assert.equal(a.update(sample(500200)).elapsedMs, 200);
  assert.equal(a.update(sample(NaN)).elapsedMs, 200);
});

test('Stop during descent logs incomplete; reset clears records, faults, and timing', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600, 0.1);
  const out = h.a.finish(h.time);
  assert.equal(out.incomplete, 1); assert.equal(out.completed, 0);
  assert.deepEqual(h.a.update(sample(h.time + 20)), out);
  h.a.reset(); const reset = h.a.finish(0);
  assert.equal(reset.reps.length, 0); assert.equal(reset.incomplete, 0);
  assert.equal(reset.elapsedMs, 0); assert.equal(reset.assessableMs, 0);
  assert.deepEqual(reset.checks, { alignment:'unknown', depth:'unknown', extension:'unknown' });
});

test('input and previously returned rep arrays remain unchanged', () => {
  const h = harness(); h.hold(180, 300); const first = cycle(h); const saved = structuredClone(first);
  const input = sample(h.time + 20); const before = structuredClone(input); h.frame(input);
  cycle(h); assert.equal(h.view.completed, 2);
  assert.deepEqual(first, saved); assert.deepEqual(input, before);
});

test('one-frame arm outlier at the top cannot create a completed rep', () => {
  const h = harness(); h.hold(180, 400); h.hold(130, 20); h.hold(180, 1000);
  assert.equal(h.view.reps.length, 0);
});

test('exact candidate depth and top thresholds tolerate filter settling', () => {
  const h = harness(); h.hold(180, 300); h.ramp(90, 600); h.hold(90, 400);
  h.ramp(160, 600); const out = h.hold(160, 300);
  assert.equal(out.completed, 1);
  assert.equal(out.reps[0].checks.depth, 'pass');
  assert.equal(out.reps[0].checks.extension, 'pass');
});

test('extension is unknown while rising and only assessed at the end', () => {
  const h = harness(); h.hold(180, 300); h.ramp(80, 600); h.hold(80, 200);
  h.ramp(140, 600);
  assert.equal(h.view.phase, 'up'); assert.equal(h.view.checks.extension, 'unknown');
  assert.equal(h.a.finish(h.time).reps[0].checks.extension, 'fail');
});

test('Stop after a long blind timestamp gap records unassessed, not incomplete', () => {
  const h = harness(); h.hold(180, 300); h.ramp(100, 600);
  const out = h.a.finish(h.time + 2000);
  assert.equal(out.unassessed, 1); assert.equal(out.incomplete, 0);
  assert.equal(out.elapsedMs, h.time);
});

test('sag and pike cues keep their meaning when the subject faces the other way', () => {
  for (const reverse of [false, true]) for (const deviation of [-0.1, 0.1]) {
    const a = createAnalyzer(); let out = a.update(sample(0));
    for (let time = 20; time <= 400; time += 20) {
      const f = sample(time, 180, deviation);
      if (reverse) for (const point of Object.values(f.joints)) point.x = 640 - point.x;
      out = a.update(f);
    }
    assert.equal(out.checks.alignment, 'fail');
    assert.match(out.cue!, deviation > 0 ? /Raise/ : /Lower/);
  }
});

test('a setup alignment fault does not contaminate a rep performed after correction', () => {
  const h = harness(); h.hold(180, 400, 0.1);
  assert.equal(h.view.checks.alignment, 'fail');
  h.ramp(80, 600, 0); h.hold(80, 300); h.ramp(180, 600); const out = h.hold(180, 300);
  assert.equal(out.completed, 1);
  assert.equal(out.reps[0].checks.alignment, 'pass');
});

test('main reset can read finish(0) before the first frame without disabling the next run', () => {
  const a = createAnalyzer();
  a.reset(); assert.equal(a.finish(0).completed, 0);
  const out = a.update(sample(1000, 180));
  assert.equal(out.elbowDeg, 180);
  assert.equal(a.update(sample(1100, 180)).elapsedMs, 100);
});
