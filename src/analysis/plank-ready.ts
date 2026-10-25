import type {PoseFrame,Point} from '../shared/contracts';
import {angleDeg,isUsablePoint} from './metrics';
/** A permissive image-space start-pose filter, not an exercise or floor classifier. */
export function plankReadiness(frame:PoseFrame,elbow:number|null,top:number){
 const arm=frame.arms?.[frame.side??'left']??frame.joints;
 const keys=['shoulder','elbow','wrist','hip','knee','ankle'] as const;
 const points=keys.map(k=>arm[k]);
 const fail=(reason:string)=>({ready:false,reason,points:[] as Point[],span:0});
 if(frame.tracking==='lost'||points.some(p=>!isUsablePoint(p)||p.x<0||p.x>frame.width||p.y<0||p.y>frame.height))
  return fail('Show your side from shoulder to ankle, including your knee.');
 const [s,,w,h,k,a]=points as Point[];
 const span=Math.hypot(a.x-s.x,a.y-s.y);
 if(span<Math.min(frame.width,frame.height)*0.25)return fail('Move into view so your whole body is clearly visible.');
 if(Math.abs(a.x-s.x)/span<0.75)return fail('Extend your legs behind you into a side-view plank.');
 const hip=angleDeg(s,h,a),knee=angleDeg(h,k,a);
 if(hip===null||hip<155||knee===null||knee<150)return fail('Step your feet back and straighten your body and legs into a plank.');
 if(w.y-s.y<span*0.12||a.y-s.y<span*0.08)return fail('Place your hands below your shoulders and extend your feet behind you.');
 if(elbow===null||elbow<top-20)return fail('Push up to your usual straight-arm top position.');
 return {ready:true,reason:'Plank detected. Hold still briefly.',points:points as Point[],span};
}
