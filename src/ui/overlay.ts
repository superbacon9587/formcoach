import type { JointName, Point, PoseFrame, SessionView } from '../shared/contracts';
import type { ArmPose } from '../shared/coaching';
import { formatDegrees } from './labels';
export const TONE_COLORS={neutral:'#8a96a8',pass:'#3fd49b',fail:'#ff6b6e'};
const bones:readonly [JointName,JointName][]=[['shoulder','elbow'],['elbow','wrist'],['shoulder','hip'],['hip','knee'],['knee','ankle']];
const usable=(p:Point|undefined):p is Point=>!!p&&p.visibility>=0.6&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function line(ctx:CanvasRenderingContext2D,p:Point|undefined,q:Point|undefined){if(!usable(p)||!usable(q))return;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
export function overlayStyle(view:SessionView,t:number,reducedMotion=false,region:'body'|'arms'='body'){
  const tone=(region==='arms'?view.coaching?.armVisualStatus??view.coaching?.visualStatus:view.coaching?.visualStatus)??'unknown';
  return {color:tone==='pass'?TONE_COLORS.pass:tone==='fail'?TONE_COLORS.fail:TONE_COLORS.neutral,
    // Slow red pulse; reduced-motion mode is solid. Never blink to green on failure.
    alpha:tone==='fail'&&!reducedMotion?(Math.floor(t/400)%2===0?1:0.4):1,
    glow:tone==='unknown'?0:18};
}
export function drawOverlay(canvas:HTMLCanvasElement,frame:PoseFrame|null,view:SessionView){
  const w=frame?.width??640,h=frame?.height??360;
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,w,h);
  if(!frame)return;
  const front=view.coaching?.cameraView==='front';
  if(!front&&frame.tracking==='lost')return;
  const u=w/640;
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const style=overlayStyle(view,frame.timestampMs,reduced),armStyle=overlayStyle(view,frame.timestampMs,reduced,'arms'),coaching=view.coaching;
  const actual:Partial<Record<'left'|'right',ArmPose>>=frame.arms??(frame.side?{[frame.side]:frame.joints}:{});
  ctx.save();ctx.lineCap='round';
  // Dashed targets come from the analyzer's configured angle; measured skeleton stays solid.
  ctx.strokeStyle='#9ccfff';ctx.globalAlpha=0.85;ctx.lineWidth=3*u;ctx.setLineDash([10*u,8*u]);
  if(front&&coaching?.fixedGuides){
    for(const [name,color] of [['top','#b7adff'],['bottom','#87dcff']] as const){
      ctx.strokeStyle=color;
      for(const arm of Object.values(coaching.fixedGuides[name])){
        line(ctx,arm.shoulder,arm.elbow);line(ctx,arm.elbow,arm.wrist);
        for(const key of ['shoulder','elbow'] as const){const p=arm[key];if(usable(p)){ctx.beginPath();ctx.arc(p.x,p.y,6*u,0,Math.PI*2);ctx.stroke();}}
        if(usable(arm.wrist)){ctx.beginPath();ctx.arc(arm.wrist.x,arm.wrist.y,12*u,0,Math.PI*2);ctx.stroke();}
      }
      ctx.fillStyle=color;ctx.font=`600 ${Math.round(12*u)}px system-ui`;
      const arm=coaching.fixedGuides[name].right;
      if(usable(arm.shoulder))ctx.fillText(name==='top'?'UPPER TARGET':'LOWER TARGET',12*u,Math.max(18*u,arm.shoulder.y-12*u));
    }
  }else for(const guide of Object.values(coaching?.guideArms??{}))if(guide){line(ctx,guide.shoulder,guide.elbow);line(ctx,guide.elbow,guide.wrist);}
  if(coaching?.cameraView==='side')line(ctx,frame.joints.shoulder,frame.joints.ankle);
  ctx.setLineDash([]);ctx.strokeStyle=style.color;ctx.fillStyle=style.color;ctx.shadowColor=style.color;
  ctx.shadowBlur=style.glow*u;ctx.globalAlpha=style.alpha;ctx.lineWidth=5*u;
  const isArm=(name:string)=>['shoulder','elbow','wrist'].includes(name);
  const apply=(s:typeof style)=>{ctx.strokeStyle=ctx.fillStyle=ctx.shadowColor=s.color;ctx.shadowBlur=s.glow*u;ctx.globalAlpha=s.alpha;};
  for(const arm of Object.values(actual))if(arm){
    for(const [a,b] of bones)if(!front||(isArm(a)&&isArm(b))){apply(isArm(a)&&isArm(b)?armStyle:style);line(ctx,arm[a],arm[b]);}
    for(const [name,p] of Object.entries(arm))if((!front||isArm(name))&&usable(p)){apply(isArm(name)?armStyle:style);ctx.beginPath();ctx.arc(p.x,p.y,5*u,0,Math.PI*2);ctx.fill();}
  }
  apply(style);
  if(!front&&actual.left&&actual.right){line(ctx,actual.left.shoulder,actual.right.shoulder);line(ctx,actual.left.hip,actual.right.hip);}
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.font=`600 ${Math.round(14*u)}px system-ui`;ctx.textAlign='center';
  for(const side of ['left','right'] as const){
    const arm=actual[side];const e=arm?.elbow;if(!usable(e))continue;
    const deg=side==='left'?coaching?.leftElbowDeg:coaching?.rightElbowDeg;
    ctx.fillStyle='#061423';ctx.fillRect(e.x-44*u,e.y-39*u,88*u,24*u);ctx.fillStyle='#f1f5fb';
    ctx.fillText(`${side==='left'?'L':'R'} ${formatDegrees(deg??null)}`,e.x,e.y-22*u);
  }
  if(coaching){
    if(coaching.armVisualStatus==='fail'){ctx.fillStyle=TONE_COLORS.fail;ctx.textAlign='left';ctx.fillText(coaching.armFaults?.extension?'LOCKOUT: push back to straight arms':'DEPTH: lower a little farther before pushing up',16*u,28*u);}
    ctx.fillStyle='#081727dc';ctx.fillRect(8*u,h-66*u,w-16*u,28*u);ctx.fillStyle='#bfe5ff';ctx.textAlign='left';
    ctx.fillText(front?`FIXED ARM GUIDE · ${coaching.guideLocked?'LOCKED':'ADJUST THEN LOCK'} · hips/torso not used`:`Dashed: ${coaching.targetDeg}° arm target`,16*u,h-47*u);
  }
  ctx.restore();
}
