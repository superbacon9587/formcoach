import type { PoseFrame, SourceOptions, StopSource } from '../shared/contracts';
/** Synthetic skeleton, not a biomechanical reference or accuracy test. */
export function mockFrame(timestampMs: number): PoseFrame {
  const t=(timestampMs%4000)/4000;
  const low=(1-Math.cos(2*Math.PI*t))/2;
  const shoulder={x:150+low*18,y:180+low*105,visibility:1};
  const ankle={x:560,y:280,visibility:1};
  const extra=Math.floor(timestampMs/4000)%2===1?35:0;
  const hip={x:350,y:shoulder.y+(ankle.y-shoulder.y)*200/(ankle.x-shoulder.x)+extra,visibility:1};
  return { timestampMs,width:640,height:360,source:'mock',side:'left',tracking:'valid',
    joints:{shoulder,elbow:{x:170+low*58,y:240+low*22,visibility:1},
      wrist:{x:190,y:310,visibility:1},hip,
      knee:{x:450,y:hip.y+(ankle.y-hip.y)*0.5,visibility:1},ankle} };
}
export async function startMockSource(options: SourceOptions): Promise<StopSource> {
  options.onStatus('MOCK INPUT · synthetic landmarks, not live camera');
  let id=0,stopped=false; const start=performance.now();
  function tick(now:number){ if(stopped)return;options.onFrame(mockFrame(now-start));id=requestAnimationFrame(tick); }
  id=requestAnimationFrame(tick);
  return ()=>{stopped=true;cancelAnimationFrame(id);};
}
