import type { Point, PoseFrame, Side } from '../shared/contracts';
import type { ArmPose } from '../shared/coaching';
/** Small display/image smoothing only. Missing points stay absent; no extrapolation. */
export function createFrameSmoother(){
  let previous:PoseFrame|null=null;
  return {update(frame:PoseFrame):PoseFrame {
    const dt=previous?frame.timestampMs-previous.timestampMs:0;
    const canBlend=previous&&dt>0&&dt<=200&&frame.width===previous.width&&frame.height===previous.height
      &&frame.cameraView===previous.cameraView&&frame.tracking!=='lost'&&previous.tracking!=='lost';
    const alpha=canBlend?1-Math.exp(-dt/50):1;
    const smooth=(current:ArmPose,old:ArmPose|undefined):ArmPose=>{
      const out:ArmPose={};
      for(const [name,p] of Object.entries(current)){
        if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
        const key=name as keyof ArmPose;const last=old?.[key];let point:Point={...p!};
        if(canBlend&&last&&Math.min(last.visibility,p!.visibility)>=0.6
          &&Math.hypot(last.x-p!.x,last.y-p!.y)<Math.hypot(frame.width,frame.height)*0.25)
          point={...p!,x:last.x+alpha*(p!.x-last.x),y:last.y+alpha*(p!.y-last.y)};
        out[key]=point;
      }return out;
    };
    const arms:Partial<Record<Side,ArmPose>>={};
    for(const side of ['left','right'] as const)if(frame.arms?.[side])arms[side]=smooth(frame.arms[side]!,previous?.arms?.[side]);
    const joints=frame.side&&arms[frame.side]?arms[frame.side]!:smooth(frame.joints,previous?.joints);
    const out={...frame,joints,...(frame.arms?{arms}:{})};previous=out;return out;
  },reset(){previous=null;}};
}
