import test from 'node:test';
import assert from 'node:assert/strict';
import type { Point, PoseFrame } from '../../src/shared/contracts';
import { createAnalyzer } from '../../src/analysis';
import { angleDeg, distancePx, isUsablePoint } from '../../src/analysis/metrics';

const point = (x: number, y: number, visibility = 1): Point => ({ x, y, visibility });
const frame = (): PoseFrame => ({ timestampMs: 1000, width: 640, height: 360,
  source: 'mock', side: 'left', tracking: 'partial',
  joints: { shoulder: point(0, 100), elbow: point(100, 100), wrist: point(100, 200) } });

test('angle measures the middle joint in degrees', () => {
  assert.equal(angleDeg(point(0, 1), point(0, 0), point(1, 0)), 90);
  assert.equal(angleDeg(point(-1, 0), point(0, 0), point(1, 0)), 180);
  assert.ok(Math.abs(angleDeg(point(1, 1), point(0, 0), point(1, 0))! - 45) < 1e-10);
});

test('angles survive translation, uniform scaling and reflection', () => {
  assert.equal(angleDeg(point(10, 20), point(20, 20), point(20, 30)), 90);
  assert.equal(angleDeg(point(0, 1000), point(0, 0), point(-1000, 0)), 90);
});

test('visibility gate accepts its boundary and rejects malformed points', () => {
  assert.equal(isUsablePoint(point(0, 0, 0.6)), true);
  for (const p of [undefined, point(0, 0, 0.59), point(NaN, 0), point(0, Infinity),
    point(0, 0, NaN), point(0, 0, 1.1), point(0, 0, -1)]) {
    assert.equal(isUsablePoint(p), false);
    assert.equal(angleDeg(p, point(1, 1), point(2, 1)), null);
    assert.equal(distancePx(p, point(1, 1)), null);
  }
});

test('invalid geometry or any unreliable angle endpoint returns null', () => {
  assert.equal(angleDeg(point(0, 0), point(0, 0), point(1, 0)), null);
  assert.equal(angleDeg(point(0, 1), undefined, point(1, 0)), null);
  assert.equal(angleDeg(point(0, 1), point(0, 0), point(1, 0, 0.1)), null);
  assert.equal(distancePx(point(-Number.MAX_VALUE, 0), point(Number.MAX_VALUE, 0)), null);
});

test('distance uses source pixels and permits coincident points', () => {
  assert.equal(distancePx(point(10, 20), point(13, 24)), 5);
  assert.equal(distancePx(point(10, 20), point(10, 20)), 0);
});

test('analyzer publishes an arm measurement without claiming a form pass', () => {
  const a = createAnalyzer();
  const input = frame();
  const before = structuredClone(input);
  const view = a.update(input);
  assert.equal(view.elbowDeg, 90);
  assert.equal(view.hipDeviation, null);
  assert.deepEqual(view.checks, { alignment: 'unknown', depth: 'unknown', extension: 'unknown' });
  assert.deepEqual(view.enabledChecks, { alignment: false, depth: false, extension: false });
  assert.equal(view.completed, 0);
  assert.deepEqual(input, before);
  const lost = a.update({ ...input, timestampMs: 1100, tracking: 'lost' });
  assert.equal(lost.elbowDeg, null);
  assert.equal(lost.phase, 'paused');
  assert.equal(view.elbowDeg, 90);
  assert.notEqual(lost.checks, view.checks);
  a.reset();
  assert.equal(a.finish(0).elbowDeg, null);
});

test('analyzer does not reuse stale arm measurements', () => {
  const a = createAnalyzer();
  a.update(frame());
  const invalid = frame();
  invalid.joints.wrist = point(100, 200, 0.1);
  assert.equal(a.update(invalid).elbowDeg, null);
});
