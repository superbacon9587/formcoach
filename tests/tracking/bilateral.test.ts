import test from 'node:test';import assert from 'node:assert/strict';
import { bilateralFrame } from '../../src/tracking/bilateral';
test('bilateral mapper keeps both arms, uses intrinsic pixels and preserves separate world coordinates',()=>{
  const p=Array.from({length:33},()=>({x:0.25,y:0.5,z:0.1,visibility:0.9}));
  p[12].x=0.75;const f=bilateralFrame(p,p,640,480);
  assert.equal(f.arms!.left!.shoulder!.x,160);assert.equal(f.arms!.right!.shoulder!.x,480);
  assert.equal(f.arms!.left!.shoulder!.y,240);assert.equal(f.worldArms!.left!.shoulder!.x,0.25);
  p[14].visibility=0.1;const bad=bilateralFrame(p,p,640,480);assert.equal(bad.arms!.right!.elbow,undefined);
});
test('front mapper discards torso, hips and legs while keeping both arm triplets',()=>{
  const p=Array.from({length:33},()=>({x:0.5,y:0.5,z:0.1,visibility:0.9}));
  for(const index of [23,24,25,26,27,28])p[index].visibility=0;
  const f=bilateralFrame(p,[],640,480,true);
  assert.deepEqual(Object.keys(f.arms!.left!).sort(),['elbow','shoulder','wrist']);
  assert.deepEqual(Object.keys(f.arms!.right!).sort(),['elbow','shoulder','wrist']);
});
