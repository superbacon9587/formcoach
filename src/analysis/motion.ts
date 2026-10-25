import type { ArmPose } from '../shared/coaching';
import type { Side } from '../shared/contracts';
import { isUsablePoint } from './metrics';
/** Perspective-dependent motion proxy. It corroborates a cycle, NEVER proves 90° depth. */
export function shoulderProfile(arms:Partial<Record<Side,ArmPose>>) {
  const l=arms.left,r=arms.right;
  if(!isUsablePoint(l?.shoulder)||!isUsablePoint(r?.shoulder)||!isUsablePoint(l?.wrist)||!isUsablePoint(r?.wrist))return null;
  const dx=r.wrist.x-l.wrist.x,dy=r.wrist.y-l.wrist.y,span=Math.hypot(dx,dy);
  if(span<20)return null;
  const sx=(l.shoulder.x+r.shoulder.x)/2,sy=(l.shoulder.y+r.shoulder.y)/2;
  const wx=(l.wrist.x+r.wrist.x)/2,wy=(l.wrist.y+r.wrist.y)/2;
  const height=Math.abs(dx*(sy-wy)-dy*(sx-wx))/(span*span);
  return Number.isFinite(height)?{height,span,wx,wy}:null;
}
export function median(values:readonly number[]):number {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
}
