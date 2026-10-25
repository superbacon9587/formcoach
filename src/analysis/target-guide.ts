import type { Point, Side } from '../shared/contracts';
import type { ArmPose } from '../shared/coaching';
/** A schematic 2D arm target from calibrated screen lengths; NOT a 3D ground truth. */
export function angleGuide(arm:ArmPose,angleDeg:number,side:Side):ArmPose {
  const s=arm.shoulder,e=arm.elbow,w=arm.wrist;if(!s||!e||!w)return {};
  const upper=Math.hypot(s.x-e.x,s.y-e.y),lower=Math.hypot(e.x-w.x,e.y-w.y);
  const baseline=Math.hypot(s.x-w.x,s.y-w.y);if(Math.min(upper,lower,baseline)<1)return {};
  const r=Math.sqrt(Math.max(1,upper*upper+lower*lower-2*upper*lower*Math.cos(angleDeg*Math.PI/180)));
  const ux=(s.x-w.x)/baseline,uy=(s.y-w.y)/baseline;
  const shoulder:Point={x:w.x+ux*r,y:w.y+uy*r,visibility:1};
  const along=(lower*lower+r*r-upper*upper)/(2*r);
  const off=Math.sqrt(Math.max(0,lower*lower-along*along));
  const candidates=[1,-1].map(sign=>({x:w.x+ux*along-sign*uy*off,y:w.y+uy*along+sign*ux*off,visibility:1}));
  // Choose the elbow branch nearest the calibrated elbow; handles either camera side.
  const elbow=candidates.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
  void side;
  return {shoulder,elbow,wrist:{...w}};
}
