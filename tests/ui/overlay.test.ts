import test from 'node:test';import assert from 'node:assert/strict';
import {overlayStyle,TONE_COLORS} from '../../src/ui/overlay';
import {emptyView} from '../../src/shared/defaults';import type { SessionView } from '../../src/shared/contracts';
function view(status:'pass'|'fail'|'unknown'):SessionView {return {...emptyView(),coaching:{cameraView:'front',angleSpace:'world',leftElbowDeg:170,rightElbowDeg:170,bottomDeg:90,topDeg:160,targetDeg:90,armed:true,depthReached:false,visualStatus:status,guideArms:{}}};}
test('green glow, red pulse, neutral unknown; reduced motion stays steady red',()=>{
  assert.equal(overlayStyle(view('pass'),0).color,TONE_COLORS.pass);assert.ok(overlayStyle(view('pass'),0).glow>0);
  assert.equal(overlayStyle(view('fail'),0).color,TONE_COLORS.fail);assert.notEqual(overlayStyle(view('fail'),0).alpha,overlayStyle(view('fail'),500).alpha);
  assert.equal(overlayStyle(view('fail'),500,true).alpha,1);assert.equal(overlayStyle(view('unknown'),0).glow,0);
});

test('front overlay draws exactly the arm segments, even when a frame contains old hip/leg points',async()=>{
  const {drawOverlay}=await import('../../src/ui/overlay');
  const {createFrontGuide}=await import('../../src/shared/front-guide');
  const {DEFAULT_SETTINGS}=await import('../../src/shared/coaching');
  const {mockAtAngles}=await import('../../src/fixtures/mock');
  let color='',greenSegments=0;
  const ctx=new Proxy({},{get(_target,key){if(key==='strokeStyle')return color;if(key==='stroke')return ()=>{if(color===TONE_COLORS.pass)greenSegments++;};return ()=>{};},set(_target,key,value){if(key==='strokeStyle')color=value;return true;}});
  const canvas={width:640,height:360,getContext:()=>ctx} as unknown as HTMLCanvasElement;
  const v=view('pass');v.coaching!.fixedGuides=createFrontGuide(640,360,DEFAULT_SETTINGS);
  const f=mockAtAngles(0,170);drawOverlay(canvas,f,v);
  assert.equal(greenSegments,4,'only two upper-arm and two forearm lines may be green');
});

test('arm fault changes only arm segments; body segments keep their alignment color',async()=>{
 const {drawOverlay}=await import('../../src/ui/overlay');const {mockAtAngles}=await import('../../src/fixtures/mock');
 let color='';const strokes:string[]=[];
 const ctx=new Proxy({},{get(_target,key){if(key==='strokeStyle')return color;if(key==='stroke')return ()=>strokes.push(color);return ()=>{};},set(_target,key,value){if(key==='strokeStyle')color=value;return true;}});
 const canvas={width:640,height:360,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 const v=view('pass');v.coaching!.cameraView='side';v.coaching!.armVisualStatus='fail';v.coaching!.armFaults={depth:true,extension:false};
 const f=mockAtAngles(0,130);f.arms={left:f.arms!.left};drawOverlay(canvas,f,v);
 assert.equal(strokes.filter(c=>c===TONE_COLORS.fail).length,2,'only upper arm and forearm red');
 assert.equal(strokes.filter(c=>c===TONE_COLORS.pass).length,3,'torso and legs remain green');
 assert.equal(overlayStyle(v,500,true,'arms').alpha,1);
});
