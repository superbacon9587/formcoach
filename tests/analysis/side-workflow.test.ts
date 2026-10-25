import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalyzer,createAngleAnalyzer} from '../../src/analysis';
import {mockAtAngles} from '../../src/fixtures/mock';
import type {PoseFrame} from '../../src/shared/contracts';
function camera(t:number,deg=170):PoseFrame {
 const f=mockAtAngles(t,deg);f.source='camera';f.cameraView='side';
 const a=f.arms!.left!;const s=a.shoulder!,end={x:550,y:200,visibility:1};
 a.ankle=end;a.knee={x:s.x+(end.x-s.x)*0.75,y:s.y+(end.y-s.y)*0.75,visibility:1};a.hip={x:(s.x+end.x)/2,y:(s.y+end.y)/2,visibility:1};f.joints=a;return f;
}
test('camera waits for position, counts down 3/2/1, arms at Go, then counts a quick rep',()=>{
 const a=createAnalyzer();let v=a.update(camera(0,90));assert.equal(v.totalAttempts,0);
 const seen=new Set<number>();
 for(let t=100;t<=4100;t+=100){v=a.update(camera(t));if(v.coaching?.countdownSeconds)seen.add(v.coaching.countdownSeconds);assert.equal(v.totalAttempts,0);}
 assert.deepEqual([...seen],[3,2,1]);assert.equal(v.coaching?.armed,true);
 for(const [t,d] of [[4200,140],[4233,90],[4266,90],[4299,120],[4332,170],[4365,170],[4398,170],[4431,170],[4464,170]])v=a.update(camera(t,d));
 assert.equal(v.completed,1);assert.equal(a.finish(4500).completed,1);
});
test('losing hip visibility before countdown keeps setup uncounted',()=>{
 const a=createAnalyzer();for(let t=0;t<400;t+=100)a.update(camera(t));
 const bad=camera(400);delete bad.arms!.left!.hip;
 let v=a.update(bad);assert.equal(v.coaching?.preparation,'positioning');
 v=a.update(camera(500));assert.equal(v.coaching?.preparation,'positioning');assert.equal(a.finish(2200).totalAttempts,0);
});
test('short bottom visits count at 15/30/60 fps without a bottom hold; isolated spikes do not',()=>{
 for(const fps of [15,30,60]){
 const a=createAngleAnalyzer({cameraView:'side',angleSpace:'image'});let t=0,v=a.finish(0);a.reset();
 const hold=(d:number,n:number)=>{for(let i=0;i<n;i++){t+=1000/fps;v=a.update(camera(t,d));}};
 hold(170,Math.ceil(fps*.4));hold(140,Math.ceil(fps*.15));hold(90,2);hold(120,Math.ceil(fps*.15));hold(170,Math.ceil(fps*.3));assert.equal(v.completed,1,`${fps}fps`);
 }
 const a=createAngleAnalyzer({cameraView:'side',angleSpace:'image'});let v;
 for(let t=0;t<=1200;t+=33)v=a.update(camera(t,t===660?85:t>400&&t<900?130:170));
 assert.equal(v!.completed,0);
});
test('side alignment suggestion is relevant and session suggestions are unique',()=>{
 const a=createAngleAnalyzer({cameraView:'side',angleSpace:'image'});let t=0;
 const hold=(deg:number,n:number)=>{for(let i=0;i<n;i++){t+=33;const f=camera(t,deg);f.arms!.left!.hip!.y+=100;a.update(f);}};
 for(let i=0;i<2;i++){hold(170,15);hold(130,15);hold(85,15);hold(170,15);}
 const v=a.finish(t);assert.ok(v.suggestions?.some(s=>s.includes('hips')));assert.equal(v.suggestions?.length,new Set(v.suggestions).size);
});

test('plank confirmation precedes green and countdown; countdown continues through loss',()=>{
 const a=createAnalyzer();let v=a.update(camera(100));assert.equal(v.coaching?.visualStatus,'unknown');
 for(let t=200;t<=600;t+=100)v=a.update(camera(t));assert.equal(v.coaching?.visualStatus,'unknown');
 v=a.update(camera(700));assert.equal(v.coaching?.visualStatus,'pass');assert.equal(v.coaching?.preparation,'positioning');assert.equal(v.coaching?.countdownSeconds,undefined);
 for(let t=800;t<=1000;t+=100)v=a.update(camera(t));assert.equal(v.coaching?.countdownSeconds,3);
 for(let t=1100;t<=3900;t+=100){v=a.update({...camera(t),tracking:'lost'});assert.equal(v.totalAttempts,0);assert.equal(v.coaching?.preparation,'countdown');}
 assert.equal(v.coaching?.countdownSeconds,1);assert.equal(v.coaching?.visualStatus,'unknown');
 v=a.update({...camera(4000),tracking:'lost'});assert.equal(v.coaching?.preparation,'active');assert.equal(v.coaching?.countdownSeconds,0);assert.equal(v.coaching?.armed,false);
 for(let t=4100;t<=4900;t+=100)v=a.update(camera(t));assert.equal(v.coaching?.countdownSeconds,0);
 v=a.update(camera(5000));assert.equal(v.coaching?.countdownSeconds,undefined);assert.equal(v.totalAttempts,0);
});
