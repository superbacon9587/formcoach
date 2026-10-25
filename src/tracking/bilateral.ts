import type { PoseFrame, JointName, Side, Point } from '../shared/contracts';
import type { WorldPoint, WorldPose, ArmPose } from '../shared/coaching';
type Landmark = { x:number; y:number; z?:number; visibility?:number };
const names:JointName[]=['shoulder','elbow','wrist','hip','knee','ankle'];
const indices={left:[11,13,15,23,25,27],right:[12,14,16,24,26,28]};
/** Keep both sides. World coordinates are estimated meters; image coords pixels. */
export function bilateralFrame(points:readonly Landmark[], world:readonly Landmark[],width:number,height:number,armsOnly=false):
  Pick<PoseFrame,'arms'|'worldArms'> {
  const arms:Partial<Record<Side,ArmPose>>={},worldArms:Partial<Record<Side,WorldPose>>={};
  for(const side of ['left','right'] as const){
    const image:ArmPose={},space:WorldPose={};
    indices[side].forEach((index,i)=>{
      if(armsOnly&&i>=3)return;
      const p=points[index],q=world[index];
      if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.visibility)&&p.visibility!>=0.5){
        const visibility=Math.max(0,Math.min(1,p.visibility!));
        const point:Point={x:p.x*width,y:p.y*height,visibility};image[names[i]]=point;
        if(q&&Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z)){
          const v=Number.isFinite(q.visibility)?Math.min(visibility,q.visibility!):visibility;
          const wp:WorldPoint={x:q.x,y:q.y,z:q.z!,visibility:v};space[names[i]]=wp;
        }
      }
    });
    arms[side]=image;worldArms[side]=space;
  }
  return {arms,worldArms};
}
