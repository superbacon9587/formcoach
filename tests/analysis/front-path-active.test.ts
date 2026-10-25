import test from 'node:test';import assert from 'node:assert/strict';
import {createFrontPathAnalyzer as createAnalyzer} from '../../src/analysis/front-path';
import {createFrontGuide,DEFAULT_PLACEMENT} from '../../src/shared/front-guide';
import {DEFAULT_SETTINGS,type ArmPose} from '../../src/shared/coaching';
import type {PoseFrame,Side} from '../../src/shared/contracts';
const guide=createFrontGuide(640,480,DEFAULT_SETTINGS);
function frame(t:number,progress:number,source:'camera'|'mock'='camera'):PoseFrame {
  const arms:Record<Side,ArmPose>={left:{},right:{}};
  for(const side of ['left','right'] as const)for(const k of ['shoulder','elbow','wrist'] as const){const a=guide.top[side][k]!,b=guide.bottom[side][k]!;arms[side][k]={x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress,visibility:1};}
  return {timestampMs:t,width:640,height:480,source,cameraView:'front',side:'left',joints:arms.left,arms,tracking:'valid'};
}
function run(fps=30){const a=createAnalyzer();let t=0,v=a.finish(0);a.reset();a.lockGuide!();
  function hold(p:number,duration=300,change?:(f:PoseFrame)=>void){for(let dt=0;dt<duration;dt+=1000/fps){t+=1000/fps;const f=frame(t,p);change?.(f);v=a.update(f);}return v;}
  function cycle(p=1){hold(0,350);hold(0.4,200);hold(p,350);hold(0.4,200);return hold(0,350);}
  return {a,hold,cycle,get view(){return v;},get t(){return t;}};
}
test('active front mode counts with exactly six arm joints and no hips, torso, legs or world coordinates',()=>{
  const h=run();h.cycle();assert.equal(h.view.totalAttempts,1);assert.equal(h.view.completed,1);assert.equal(h.view.coaching?.measurementMode,'arm-path');
  assert.equal(h.view.coaching?.angleSpace,'image');h.cycle();h.cycle(0.55);assert.equal(h.view.totalAttempts,3);assert.equal(h.view.incomplete,1);
});
test('torso disappearance and wild world coordinates cannot affect the front arm-path counter',()=>{
  const h=run();const corrupt=(f:PoseFrame)=>{f.worldArms={left:{hip:{x:NaN,y:NaN,z:NaN,visibility:0}}};f.joints.hip={x:-100,y:-100,visibility:0};};
  h.hold(0,400,corrupt);h.hold(0.5,250,corrupt);h.hold(1,400,corrupt);h.hold(0.5,250,corrupt);h.hold(0,400,corrupt);assert.equal(h.view.completed,1);
});
test('guide positions are identical through top, bottom, drift and lost tracking',()=>{
  const h=run();h.hold(0,350);const first=structuredClone(h.view.coaching!.fixedGuides);
  h.hold(1);assert.deepEqual(h.view.coaching!.fixedGuides,first);
  h.hold(0.5,400,f=>{for(const arm of Object.values(f.arms!))for(const p of Object.values(arm!))p!.x+=60;});assert.deepEqual(h.view.coaching!.fixedGuides,first);
  h.hold(0,300,f=>{f.arms={};f.joints={};f.tracking='lost';});assert.deepEqual(h.view.coaching!.fixedGuides,first);
});
test('camera requires explicit guide lock; controls move it only before lock',()=>{
  const a=createAnalyzer();let t=0;
  for(let i=0;i<20;i++){t+=33;a.update(frame(t,0));}
  assert.equal(a.update(frame(t+33,1)).coaching?.armed,false);
  const moved=a.setGuide!({scale:1.1,offsetX:0.05,offsetY:-0.03});assert.notDeepEqual(moved.coaching!.fixedGuides,guide);
  const locked=a.lockGuide!();const refused=a.setGuide!({...DEFAULT_PLACEMENT});assert.deepEqual(refused.coaching!.fixedGuides,locked.coaching!.fixedGuides);
});
test('projected elbow angle is diagnostic only: crossing exact 90 is not required to follow the path',()=>{
  const h=run();h.hold(0,400);h.hold(1,400);assert.ok(h.view.elbowDeg!>100,'front projection differs from rig angle');h.hold(0,400);assert.equal(h.view.completed,1);
});
test('arm occlusion pauses safely without losing the fixed guide or inventing successful depth',()=>{
  const h=run();h.hold(0,400);h.hold(0.5,300);h.hold(1,1000,f=>{delete f.arms!.right!.elbow;});
  assert.equal(h.view.coaching?.visualStatus,'unknown');assert.ok(h.view.coaching?.fixedGuides);assert.equal(h.view.unassessed,1);assert.equal(h.view.completed,0);
});
test('fixed-guide cycles are time-based at 15, 30 and 60fps; reset/finish remain idempotent',()=>{
  for(const fps of [15,30,60]){const h=run(fps);h.cycle();assert.equal(h.view.totalAttempts,1);const out=h.a.finish(h.t);assert.deepEqual(h.a.finish(h.t+100),out);h.a.reset();assert.equal(h.a.finish(0).totalAttempts,0);}
});
