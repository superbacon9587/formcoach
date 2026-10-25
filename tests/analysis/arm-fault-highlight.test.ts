import test from 'node:test';import assert from 'node:assert/strict';
import {createAngleAnalyzer} from '../../src/analysis';import {mockAtAngles} from '../../src/fixtures/mock';
function run(){const a=createAngleAnalyzer({cameraView:'side',angleSpace:'image'});let t=0,v=a.finish(0);a.reset();
 const hold=(angle:number,ms:number,lost=false)=>{for(let n=0;n<ms;n+=33){t+=33;const f=mockAtAngles(t,angle);const arm=f.arms!.left!,s=arm.shoulder!,end={x:550,y:200,visibility:1};arm.ankle=end;arm.hip={x:(s.x+end.x)/2,y:(s.y+end.y)/2,visibility:1};if(lost)f.tracking='lost';v=a.update(f);}return v;};
 return {hold,get view(){return v;}};
}
test('shallow return highlights arms while aligned body remains green; clears and loss is gray',()=>{
 const h=run();h.hold(170,400);h.hold(125,250);let v=h.hold(170,300);
 assert.equal(v.incomplete,1);assert.equal(v.coaching?.armVisualStatus,'fail');assert.equal(v.coaching?.visualStatus,'pass');assert.equal(v.coaching?.armFaults?.depth,true);assert.equal(v.checks.depth,'fail');
 v=h.hold(170,1500);assert.equal(v.coaching?.armVisualStatus,'pass');
 v=h.hold(170,33,true);assert.equal(v.coaching?.armVisualStatus,'unknown');
});
test('ordinary descent and bottom are not lockout failures; another descent confirms missed lockout once',()=>{
 const h=run();h.hold(170,400);let v=h.hold(90,250);assert.notEqual(v.coaching?.armVisualStatus,'fail');
 v=h.hold(140,250);assert.equal(v.totalAttempts,0);assert.notEqual(v.coaching?.armVisualStatus,'fail');
 v=h.hold(90,200);assert.equal(v.totalAttempts,1);assert.equal(v.reps[0].checks.extension,'fail');assert.equal(v.reps[0].checks.depth,'pass');assert.equal(v.coaching?.armVisualStatus,'fail');assert.equal(v.coaching?.armFaults?.extension,true);assert.equal(v.coaching?.visualStatus,'pass');
 v=h.hold(90,200);assert.equal(v.totalAttempts,1);
 v=h.hold(170,300);assert.equal(v.totalAttempts,2);assert.equal(v.completed,1);
});
