import test from 'node:test';import assert from 'node:assert/strict';
import { createAngleAnalyzer as createAnalyzer } from '../../src/analysis';
import { angleDeg } from '../../src/analysis/metrics';
import { mockAtAngles, mockFrame } from '../../src/fixtures/mock';
import type { CoachSettings } from '../../src/shared/coaching';
import type { PoseFrame } from '../../src/shared/contracts';
function harness(options:Partial<CoachSettings>={},fps=30){
  const analyzer=createAnalyzer({cameraView:'front',angleSpace:'image',...options});let t=0;
  let view=analyzer.finish(0);analyzer.reset();
  function hold(left:number,duration=250,right=left,mutate?:(f:PoseFrame)=>void){
    const step=1000/fps;
    for(let dt=0;dt<duration;dt+=step){t+=step;const f=mockAtAngles(t,left,right);mutate?.(f);view=analyzer.update(f);}
    return view;
  }
  function cycle(bottom=85){hold(170,350);hold(145,150);hold(120,150);hold(bottom,200);hold(120,150);return hold(170,350);}
  return {analyzer,hold,cycle,get t(){return t;},get view(){return view;}};
}
test('counts depth then final lockout exactly once and retains counts across frames',()=>{
  const h=harness();h.cycle();assert.equal(h.view.completed,1);assert.equal(h.view.reps[0].checks.depth,'pass');
  h.hold(170,800);assert.equal(h.view.completed,1);h.cycle();assert.equal(h.view.completed,2);
});
test('must see stable top before initial descent; starting at the bottom cannot count',()=>{
  const h=harness();h.hold(85,600);h.hold(170,600);assert.equal(h.view.completed,0);h.cycle();assert.equal(h.view.completed,1);
});
test('shallow attempt counts in the effort tally and provides feedback instead of red punishment',()=>{
  const h=harness();h.cycle(125);assert.equal(h.view.completed,0);assert.equal(h.view.incomplete,1);
  assert.equal(h.view.reps[0].checks.depth,'fail');assert.equal(h.view.reps[0].checks.extension,'pass');assert.equal(h.view.totalAttempts,1);assert.ok(h.view.reps[0].feedback!.score!>0);assert.notEqual(h.view.coaching?.visualStatus,'fail');
});
test('both arms must reach depth; one bent arm is insufficient',()=>{
  const h=harness();h.hold(170,400);h.hold(85,500,170);assert.equal(h.view.coaching?.visualStatus,'fail');
  h.hold(170,400);assert.equal(h.view.completed,0);assert.equal(h.view.incomplete,1);
});
test('both arms must return to lockout; initial extension cannot satisfy finish',()=>{
  const h=harness();h.hold(170,400);h.hold(85,300);h.hold(170,500,130);
  assert.equal(h.view.completed,0);const out=h.analyzer.finish(h.t);assert.equal(out.incomplete,1);assert.equal(out.reps[0].checks.extension,'fail');
});
test('one depth frame and top jitter cannot count a rep',()=>{
  const h=harness();h.hold(170,400);h.hold(140,200);h.hold(85,1);h.hold(120,250);h.hold(170,300);
  assert.equal(h.view.completed,0);const j=harness();for(let i=0;i<20;i++)j.hold(i%2?158:161,33);assert.equal(j.view.completed,0);
});
test('tracking loss immediately turns unknown and long loss prevents a blind rep',()=>{
  const h=harness();h.hold(170,400);h.hold(85,200);
  h.hold(85,100,85,f=>{f.arms!.right={};});assert.equal(h.view.checks.alignment,'unknown');assert.equal(h.view.coaching?.visualStatus,'unknown');
  h.hold(85,850,85,f=>{f.tracking='lost';f.joints={};f.arms={};});h.hold(170,400);
  assert.equal(h.view.completed,0);assert.equal(h.view.unassessed,1);h.cycle();assert.equal(h.view.completed,1);
});
test('finish idempotent; reset complete; snapshots and input independent',()=>{
  const h=harness();h.cycle();const old=structuredClone(h.view);h.hold(140,200);
  const out=h.analyzer.finish(h.t);assert.deepEqual(h.analyzer.finish(h.t+100),out);
  assert.equal(out.incomplete,1);assert.equal(old.completed,1);assert.equal(old.reps.length,1);
  h.analyzer.reset();assert.equal(h.analyzer.finish(0).completed,0);
  const a=createAnalyzer({angleSpace:'image'}),f=mockAtAngles(0,170),copy=structuredClone(f);a.update(f);assert.deepEqual(f,copy);
});
test('configuration drives both depth counter and dashed target, without hard-coded 90',()=>{
  const h=harness({bottomDeg:100,topDeg:155});h.hold(170,400);
  assert.equal(h.view.coaching?.targetDeg,100);
  const guide=h.view.coaching!.guideArms.left!;
  assert.ok(Math.abs(angleDeg(guide.shoulder,guide.elbow,guide.wrist)!-100)<1e-6);
  h.hold(145,150);h.hold(98,200);assert.equal(h.view.coaching?.targetDeg,155);h.hold(160,400);assert.equal(h.view.completed,1);
});
test('counts slow/paused reps at 15, 30 and 60fps using elapsed milliseconds',()=>{
  for(const fps of [15,30,60]){const h=harness({},fps);h.hold(170,500);h.hold(145,700);h.hold(120,900);h.hold(85,1000);h.hold(120,900);h.hold(170,500);assert.equal(h.view.completed,1,`fps ${fps}`);}
});
test('estimated 3D mode uses world angles even if the image projection stays straight',()=>{
  const h=harness({angleSpace:'world'});
  function holdWorld(deg:number,duration:number){h.hold(170,duration,170,f=>{
    const actual=mockAtAngles(f.timestampMs,deg);f.source='camera';f.worldArms={};
    for(const side of ['left','right'] as const){f.worldArms[side]={};for(const name of ['shoulder','elbow','wrist'] as const){
      const p=actual.arms![side]![name]!;f.worldArms[side]![name]={...p,x:p.x/1000,y:p.y/1000,z:0};
    }}
  });}
  holdWorld(170,400);holdWorld(140,200);holdWorld(85,300);holdWorld(120,200);holdWorld(170,400);
  assert.equal(h.view.completed,1);assert.equal(h.view.coaching?.angleSpace,'world');
});
test('camera world mode does not silently substitute projected angles when world data is missing',()=>{
  const h=harness({angleSpace:'world'});h.hold(170,500,170,f=>{f.source='camera';});assert.equal(h.view.coaching?.armed,false);assert.equal(h.view.elbowDeg,null);
});
test('synthetic integration sequence yields two completed and one shallow attempt',()=>{
  const a=createAnalyzer({cameraView:'front'});let v;
  for(let t=0;t<=12000;t+=33)v=a.update(mockFrame(t));
  assert.equal(v!.completed,2);assert.equal(v!.incomplete,1);
});
test('invalid config rejected and zero-rep summary contains no nonfinite counters',()=>{
  assert.throws(()=>createAnalyzer({bottomDeg:160,topDeg:90}));const a=createAnalyzer();const v=a.finish(0);
  assert.equal(v.completed,0);assert.ok(Number.isFinite(v.elapsedMs));
});
