import type { Point, Side } from './contracts';
import type { ArmPose, CoachSettings } from './coaching';
export type GuidePlacement={scale:number;offsetX:number;offsetY:number};
export const DEFAULT_PLACEMENT:GuidePlacement={scale:1,offsetX:0,offsetY:0};
export type FrontGuide={top:Record<Side,ArmPose>;bottom:Record<Side,ArmPose>;span:number};
export type Vec3={x:number;y:number;z:number};
export const FRONT_RIG={upper:0.32,fore:0.30,shoulderX:0.24,wristX:0.40,shoulderZ:-0.28};
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** Front orthographic illustration of a fixed-length 3D arm. Angle is in the rig, not camera pixels. */
export function frontArmRig(degrees:number,side:Side){
  const sign=side==='left'?1:-1; // anatomical left appears on image right
  const {upper,fore,shoulderX,wristX,shoulderZ}=FRONT_RIG;
  const d2=upper*upper+fore*fore-2*upper*fore*Math.cos(degrees*Math.PI/180);
  const y=Math.sqrt(Math.max(0.002,d2-(wristX-shoulderX)**2-shoulderZ**2));
  const shoulder={x:sign*shoulderX,y,z:shoulderZ},wrist={x:sign*wristX,y:0,z:0};
  const delta={x:wrist.x-shoulder.x,y:-y,z:-shoulderZ},d=norm(delta),u={x:delta.x/d,y:delta.y/d,z:delta.z/d};
  const along=(upper*upper-fore*fore+d*d)/(2*d),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
  const preferred={x:sign*0.25,y:0,z:1},component=dot(preferred,u);
  const raw={x:preferred.x-component*u.x,y:-component*u.y,z:1-component*u.z};
  const n=norm(raw),v={x:raw.x/n,y:raw.y/n,z:raw.z/n};
  const elbow={x:shoulder.x+along*u.x+radius*v.x,y:shoulder.y+along*u.y+radius*v.y,z:shoulder.z+along*u.z+radius*v.z};
  return {shoulder,elbow,wrist};
}
export function projectFrontArm(width:number,height:number,degrees:number,side:Side,placement:GuidePlacement=DEFAULT_PLACEMENT):ArmPose {
  const size=Math.min(width*0.62,height*0.9)*placement.scale;
  const margin=Math.min(width,height)*0.025;
  const cx=Math.max(size*0.4+margin,Math.min(width-size*0.4-margin,width*(0.5+placement.offsetX)));
  const floor=Math.max(size*0.54+margin,Math.min(height-margin,height*(0.86+placement.offsetY)));
  const world=frontArmRig(degrees,side);
  const project=(p:Vec3):Point=>({x:cx+p.x*size,y:floor-p.y*size,visibility:1});
  return {shoulder:project(world.shoulder),elbow:project(world.elbow),wrist:project(world.wrist)};
}
/** No live landmarks enter this function. These camera-space targets cannot chase the user. */
export function createFrontGuide(width:number,height:number,settings:Pick<CoachSettings,'bottomDeg'|'topDeg'>,placement:GuidePlacement=DEFAULT_PLACEMENT):FrontGuide {
  const pose=(a:number)=>({left:projectFrontArm(width,height,a,'left',placement),right:projectFrontArm(width,height,a,'right',placement)});
  const top=pose(settings.topDeg),bottom=pose(settings.bottomDeg);
  return {top,bottom,span:Math.hypot(top.left.wrist!.x-top.right.wrist!.x,top.left.wrist!.y-top.right.wrist!.y)};
}
