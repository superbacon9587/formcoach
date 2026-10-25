import test from 'node:test';import assert from 'node:assert/strict';
import {createAngleAnalyzer as createAnalyzer} from '../../src/analysis';import {mockAtAngles} from '../../src/fixtures/mock';
import {repFeedback} from '../../src/analysis/rep-feedback';
/** Synthetic fault injections inspired by the recording, not extracted joint telemetry. */
function setup(){
  const a=createAnalyzer({cameraView:'front',angleSpace:'world'});let t=0,v=a.finish(0);a.reset();
  function hold(image:number,world:number,ms=300,hidden=false){
    for(let elapsed=0;elapsed<ms;elapsed+=33){t+=33;const f=mockAtAngles(t,image);f.source='camera';f.worldArms={};
      const pose=mockAtAngles(t,world);
      for(const side of ['left','right'] as const){f.worldArms[side]={};for(const key of ['shoulder','elbow','wrist'] as const){const p=pose.arms![side]![key]!;f.worldArms[side]![key]={...p,x:p.x/1000,y:p.y/1000,z:0};}}
      if(hidden){f.arms!.right={};}v=a.update(f);
    }return v;
  }
  return {a,hold,get view(){return v;},get t(){return t;}};
}
test('bottom-world-angle flip cannot masquerade as a return to top; attempt remains counted and ungraded',()=>{
  const h=setup();h.hold(170,170,500);h.hold(120,125);h.hold(85,105);
  h.hold(85,170,500);assert.equal(h.view.totalAttempts,0,'must not close while shoulders remain lowered');
  assert.equal(h.view.coaching?.depthConfidence,'uncertain');
  h.hold(170,165,600);assert.equal(h.view.totalAttempts,1);assert.equal(h.view.completed,0);
  assert.equal(h.view.reps[0].feedback?.score,null);assert.equal(h.view.reps[0].checks.depth,'unknown');
});
test('near-target elbow estimate counts in tally with a positive graded suggestion',()=>{
  const h=setup();h.hold(170,170,500);h.hold(120,125);h.hold(90,103,500);h.hold(170,165,600);
  assert.equal(h.view.totalAttempts,1);assert.equal(h.view.incomplete,1);assert.equal(h.view.reps[0].feedback?.depth,'near');
  assert.ok(h.view.formScore!>=80);assert.match(h.view.suggestions!.join(' '),/Elbow depth -/);
});
test('brief bottom occlusion preserves effort, but never produces a confident depth grade',()=>{
  const h=setup();h.hold(170,170,500);h.hold(120,125);h.hold(85,95,200);h.hold(85,95,300,true);
  assert.equal(h.view.coaching?.visualStatus,'unknown');h.hold(170,165,600);
  assert.equal(h.view.totalAttempts,1);assert.equal(h.view.reps[0].feedback?.score,null);
});
test('full and partial attempts both appear in total; uncertain tracking is never assigned a zero score',()=>{
  const near=repFeedback(103,165,90,160,'pass',false);assert.ok(near.score!>80);assert.equal(near.depth,'near');
  const unsure=repFeedback(150,165,90,160,'pass',true);assert.equal(unsure.score,null);assert.equal(unsure.depth,'uncertain');
});
test('body-height proxy alone cannot certify physical 90-degree depth',()=>{
  const h=setup();h.hold(170,170,500);h.hold(85,170,600);h.hold(170,170,600);
  assert.equal(h.view.totalAttempts,1);assert.equal(h.view.reps[0].checks.depth,'unknown');assert.equal(h.view.completed,0);
});
