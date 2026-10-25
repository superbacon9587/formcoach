import { projectFrontArm } from '../shared/front-guide';
import { DEFAULT_SETTINGS } from '../shared/coaching';
import type { PoseFrame, SourceOptions, StopSource } from '../shared/contracts';
import type { ArmPose } from '../shared/coaching';
/** Deterministic integration input; not recorded human footage or model output. */
export function mockAtAngles(timestampMs:number,leftDeg:number,rightDeg=leftDeg):PoseFrame {
  const arm=(side:'left'|'right',deg:number):ArmPose=>{
    const sign=side==='left'?-1:1,wrist={x:side==='left'?190:450,y:310,visibility:1};
    const radians=(180-deg)/2*Math.PI/180;
    const h=130*Math.cos(radians),off=130*Math.sin(radians);
    const elbow={x:wrist.x+sign*off,y:wrist.y-h,visibility:1};
    const shoulder={x:wrist.x,y:wrist.y-2*h,visibility:1};
    return {wrist,elbow,shoulder,hip:{x:side==='left'?245:395,y:100,visibility:1},
      knee:{x:side==='left'?270:370,y:130,visibility:1},ankle:{x:side==='left'?285:355,y:155,visibility:1}};
  };
  const arms={left:arm('left',leftDeg),right:arm('right',rightDeg)};
  return {timestampMs,width:640,height:360,source:'mock',cameraView:'front',side:'left',joints:arms.left,arms,tracking:'valid'};
}
export function mockFrame(timestampMs:number):PoseFrame {
  const t=timestampMs%4000;
  const deg=t<600?170:t<1800?170-(t-600)/1200*85:t<2200?85:t<3400?85+(t-2200)/1200*85:170;
  // Every third cycle intentionally shallow; this must not count as a completed target rep.
  return mockAtAngles(timestampMs,Math.floor(timestampMs/4000)%3===2?Math.max(120,deg):deg);
}
/** Synthetic frontal path exactly shares the locked reference geometry. */
export function mockPathFrame(timestampMs:number):PoseFrame {
  const t=timestampMs%4000;
  const progress=t<600?0:t<1800?(t-600)/1200:t<2200?1:t<3400?1-(t-2200)/1200:0;
  const p=Math.floor(timestampMs/4000)%3===2?progress*0.55:progress;
  const angle=DEFAULT_SETTINGS.topDeg+(DEFAULT_SETTINGS.bottomDeg-DEFAULT_SETTINGS.topDeg)*p;
  const arms={left:projectFrontArm(640,480,angle,'left'),right:projectFrontArm(640,480,angle,'right')};
  return {timestampMs,width:640,height:480,source:'mock',cameraView:'front',side:'left',tracking:'valid',arms,joints:arms.left};
}
export async function startMockSource(options:SourceOptions):Promise<StopSource>{
  options.onStatus('MOCK / SYNTHETIC: two full cycles then one shallow attempt. Not camera inference.');
  const start=performance.now();let id=0,stopped=false;
  const tick=(now:number)=>{if(stopped)return;options.onFrame(options.cameraView==='front'?mockPathFrame(now-start):mockFrame(now-start));id=requestAnimationFrame(tick);};
  id=requestAnimationFrame(tick);return()=>{stopped=true;cancelAnimationFrame(id);};
}
