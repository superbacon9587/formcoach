import test from 'node:test';import assert from 'node:assert/strict';
import {plankReadiness} from '../../src/analysis/plank-ready';
import {createAnalyzer} from '../../src/analysis';import type {PoseFrame} from '../../src/shared/contracts';
function frame(t=0):PoseFrame{
 const p=(x:number,y:number)=>({x,y,visibility:1});
 const joints={shoulder:p(180,180),elbow:p(180,240),wrist:p(180,300),hip:p(360,205),knee:p(480,222),ankle:p(600,240)};
 return {timestampMs:t,width:800,height:480,source:'camera',side:'left',cameraView:'side',tracking:'valid',joints,arms:{left:joints}};
}
test('plank gate rejects standing, bent-over, pike and kneeling poses despite a straight elbow',()=>{
 const standing=frame();Object.assign(standing.joints,{shoulder:{x:200,y:60,visibility:1},hip:{x:210,y:220,visibility:1},knee:{x:215,y:320,visibility:1},ankle:{x:220,y:440,visibility:1}});
 assert.equal(plankReadiness(standing,175,160).ready,false);
 const pike=frame();pike.joints.hip={x:360,y:70,visibility:1};assert.equal(plankReadiness(pike,175,160).ready,false);
 const crouch=frame();crouch.joints.knee={x:270,y:300,visibility:1};crouch.joints.ankle={x:310,y:240,visibility:1};assert.equal(plankReadiness(crouch,175,160).ready,false);
 const bent=frame();bent.joints.shoulder={x:350,y:120,visibility:1};bent.joints.hip={x:230,y:140,visibility:1};bent.joints.knee={x:235,y:280,visibility:1};bent.joints.ankle={x:240,y:420,visibility:1};assert.equal(plankReadiness(bent,175,160).ready,false);
});
test('plank gate allows mild hip drift, soft elbows and either facing direction; requires visible knee',()=>{
 const f=frame();assert.equal(plankReadiness(f,145,160).ready,true);
 const reflected=frame();for(const p of Object.values(reflected.joints))p.x=800-p.x;assert.equal(plankReadiness(reflected,145,160).ready,true);
 delete f.joints.knee;assert.equal(plankReadiness(f,175,160).ready,false);
});
test('brief pose glimpses and moving into place never turn green; timing works at 15/30/60fps',()=>{
 for(const fps of [15,30,60]){
  const a=createAnalyzer();let v;const step=1000/fps;
  for(let t=0;t<500;t+=step){v=a.update(frame(t));assert.equal(v.coaching?.visualStatus,'unknown');}
  const lost=frame(500);lost.tracking='lost';a.update(lost);
  for(let t=500+step;t<1000;t+=step){v=a.update(frame(t));assert.equal(v.coaching?.visualStatus,'unknown');}
  for(let t=1000+step;t<=1700;t+=step)v=a.update(frame(t));
  assert.equal(v!.coaching?.visualStatus,'pass');assert.equal(v!.coaching?.countdownSeconds,3);
 }
 const a=createAnalyzer();let v;
 for(let t=0;t<1200;t+=100){const f=frame(t);for(const p of Object.values(f.joints))p.x+=t*.1;v=a.update(f);}
 assert.equal(v!.coaching?.visualStatus,'unknown');assert.equal(v!.coaching?.countdownSeconds,undefined);
});
