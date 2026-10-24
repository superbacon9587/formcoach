import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleDepth, pushupPose, RIG } from '../../src/ui/demo';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
  const d = Math.abs(Math.atan2(a.y - b.y, a.x - b.x) - Math.atan2(c.y - b.y, c.x - b.x)) * 180 / Math.PI;
  return d > 180 ? 360 - d : d;
};

test('demo limbs keep fixed lengths and contacts stay planted through the motion', () => {
  const first = pushupPose(0);
  for (let i = 0; i <= 50; i++) {
    const p = pushupPose(i / 50);
    for (const [a, b] of [['ankle', 'knee'], ['knee', 'hip'], ['hip', 'shoulder']] as const) {
      assert.ok(Math.abs(dist(p[a], p[b]) - dist(first[a], first[b])) < 1e-9, `${a}-${b} stretched`);
    }
    assert.ok(Math.abs(dist(p.shoulder, p.elbow) - RIG.upperArm) < 1e-6);
    assert.ok(Math.abs(dist(p.elbow, p.wrist) - RIG.forearm) < 1e-6);
    assert.deepEqual(p.toe, first.toe);
    assert.deepEqual(p.wrist, first.wrist);
    assert.ok(p.elbow.x < p.shoulder.x, 'elbow should point back toward the feet');
  }
});

test('demo shows near lockout at the top and a deep bend at the bottom', () => {
  const top = pushupPose(0), bottom = pushupPose(1);
  assert.ok(angle(top.shoulder, top.elbow, top.wrist) > 160);
  assert.ok(angle(bottom.shoulder, bottom.elbow, bottom.wrist) < 90);
});

test('demo loop starts and ends at the top with a hold', () => {
  assert.equal(cycleDepth(0), 0);
  assert.equal(cycleDepth(0.05), 0);
  assert.ok(cycleDepth(0.999) < 0.01);
  assert.ok(Math.max(...Array.from({ length: 100 }, (_, i) => cycleDepth(i / 100))) === 1);
});
