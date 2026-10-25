import test from 'node:test';import assert from 'node:assert/strict';
import {createFrameSmoother} from '../../src/tracking/smoothing';import {mockAtAngles} from '../../src/fixtures/mock';
test('image smoothing dampens a small jump but never invents an occluded joint or mutates input',()=>{
  const s=createFrameSmoother(),a=mockAtAngles(0,170);s.update(a);
  const b=mockAtAngles(33,170);b.arms!.left!.elbow!.x+=20;const before=structuredClone(b);const out=s.update(b);
  assert.ok(out.arms!.left!.elbow!.x<b.arms!.left!.elbow!.x);assert.deepEqual(b,before);
  const missing=mockAtAngles(66,170);delete missing.arms!.left!.elbow;
  assert.equal(s.update(missing).arms!.left!.elbow,undefined);
  s.reset();assert.deepEqual(s.update(b).arms,b.arms);
});
