import test from 'node:test';
import assert from 'node:assert/strict';
import { createSideSelector } from '../../src/tracking/landmarks';

const pose = (left = 0.9, right = 0.7) => Array.from({ length: 33 }, (_, i) => ({
  x: 0.25, y: 0.75, visibility: i % 2 ? left : right,
}));

test('locks a stable side and converts unmirrored intrinsic coordinates', () => {
  const selector = createSideSelector();
  assert.equal(selector.select(pose(), 640, 480).tracking, 'lost');
  assert.equal(selector.select(pose(), 640, 480).tracking, 'lost');
  const frame = selector.select(pose(), 640, 480);
  assert.equal(frame.side, 'left');
  assert.equal(frame.tracking, 'valid');
  assert.deepEqual(frame.joints.wrist, { x: 160, y: 360, visibility: 0.9 });
  assert.equal(selector.select(pose(0.6, 1), 640, 480).side, 'left');
});

test('omits missing joints and emits loss before selecting the opposite side', () => {
  const selector = createSideSelector();
  for (let i = 0; i < 3; i++) selector.select(pose(), 640, 480);
  const partial = pose();
  partial[13].visibility = 0.1;
  partial[15].x = NaN;
  const frame = selector.select(partial, 640, 480);
  assert.equal(frame.tracking, 'partial');
  assert.equal(frame.joints.elbow, undefined);
  assert.equal(frame.joints.wrist, undefined);
  assert.deepEqual(selector.select(pose(0.1, 1), 640, 480), { joints: {}, side: null, tracking: 'lost' });
  assert.equal(selector.select(pose(0.1, 1), 640, 480).tracking, 'lost');
  assert.equal(selector.select(pose(0.1, 1), 640, 480).tracking, 'lost');
  assert.equal(selector.select(pose(0.1, 1), 640, 480).side, 'right');
  assert.deepEqual(selector.select([], 640, 480), { joints: {}, side: null, tracking: 'lost' });
});

test('unstable selection and missing visibility never become valid tracking', () => {
  const selector = createSideSelector();
  for (let i = 0; i < 8; i++) {
    assert.equal(selector.select(pose(i % 2 ? 0.6 : 1, i % 2 ? 1 : 0.6), 640, 480).tracking, 'lost');
  }
  assert.equal(selector.select([{ x: 0, y: 0 }], 640, 480).tracking, 'lost');
});
