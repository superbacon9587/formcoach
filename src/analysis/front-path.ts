import type { Analyzer, CheckStatus, PoseFrame, RepResult, SessionView, Side } from '../shared/contracts';
import type { ArmPose, CoachSettings } from '../shared/coaching';
import { DEFAULT_SETTINGS } from '../shared/coaching';
import { createFrontGuide, DEFAULT_PLACEMENT, type GuidePlacement } from '../shared/front-guide';
import { emptyView } from '../shared/defaults';
import { angleDeg, isUsablePoint } from './metrics';
import { median } from './motion';
const SIDES=['left','right'] as const,JOINTS=['shoulder','elbow','wrist'] as const;
const HOLD=150,LOST=800,FAIL_HOLD=350,PATH_BAND=0.22;
type Attempt={start:number;minAngle:number;maxLeft:number;maxRight:number;uncertain:boolean;alignment:CheckStatus};
/** Front-only engine: exactly six image joints. No hips, torso, legs or world coordinates. */
export function createFrontPathAnalyzer(input:Partial<CoachSettings>={}):Analyzer {
  const settings={...DEFAULT_SETTINGS,...input,cameraView:'front' as const,angleSpace:'image' as const};
  if(!Number.isFinite(settings.bottomDeg)||!Number.isFinite(settings.topDeg)||settings.bottomDeg<65||settings.bottomDeg>120||settings.topDeg<140||settings.topDeg>180||settings.topDeg-settings.bottomDeg<30)
    throw new Error('Reference targets: bottom 65–120°, top 140–180°, separated by at least 30°.');
  let placement={...DEFAULT_PLACEMENT},width=640,height=480;
  let guide=createFrontGuide(width,height,settings,placement),locked=false,armed=false,finished=false;
  let view=emptyView(),reps:RepResult[]=[],attempt:Attempt|null=null;
  let last:number|null=null,topSince:number|null=null,lostSince:number|null=null,badSince:number|null=null;
  let previousValid=false,alignment:CheckStatus='unknown';
  let rawProgress:{left:number|null;right:number|null}={left:null,right:null};
  let histories:Record<Side,number[]>={left:[],right:[]};
  function snapshot(){return structuredClone(view);}
  function close(t:number,outcome:RepResult['outcome']){
    if(!attempt)return;
    const depth=Math.min(attempt.maxLeft,attempt.maxRight),uncertain=attempt.uncertain||outcome==='unassessed';
    const hit=depth>=0.85;
    const suggestions=uncertain?['Attempt recorded. Arm-path tracking was interrupted; no depth grade was assigned.']:
      hit?['Lower arm target reached. Keep a controlled return to the upper guide.']:
      depth>=0.55?['Close to the lower guide. Next set, work toward a little more controlled arm travel.']:
        ['Partial attempt recorded. Work toward the lower dashed arm path at a comfortable range.'];
    reps.push({id:reps.length+1,startedAtMs:attempt.start,endedAtMs:t,outcome,minElbowDeg:attempt.minAngle,
      finishElbowDeg:outcome==='unassessed'?null:view.elbowDeg,
      checks:{alignment:attempt.alignment,depth:uncertain?'unknown':hit?'pass':'fail',extension:outcome==='unassessed'?'unknown':outcome==='completed'?'pass':'fail'},
      feedback:{score:uncertain?null:Math.round(55+45*Math.min(1,Math.max(0,depth))),depth:uncertain?'uncertain':hit?'met':depth>=0.55?'near':'partial',suggestions}});
    attempt=null;topSince=null;
  }
  function publish(cue:string,valid:boolean):SessionView {
    const grades=reps.flatMap(r=>r.feedback?.score==null?[]:[r.feedback.score]);
    view={...view,totalAttempts:reps.length,completed:reps.filter(r=>r.outcome==='completed').length,
      incomplete:reps.filter(r=>r.outcome==='incomplete').length,unassessed:reps.filter(r=>r.outcome==='unassessed').length,
      reps:structuredClone(reps),formScore:grades.length?Math.round(grades.reduce((a,b)=>a+b,0)/grades.length):null,
      suggestions:[...new Set(reps.flatMap(r=>r.feedback?.suggestions??[]))].slice(0,3),hipDeviation:null,cue,
      enabledChecks:{alignment:true,depth:true,extension:true},
      checks:valid&&armed?{alignment,depth:attempt&&Math.min(attempt.maxLeft,attempt.maxRight)>=0.85?'pass':'unknown',extension:view.phase==='ready'?'pass':'unknown'}:
        {alignment:'unknown',depth:'unknown',extension:'unknown'},
      coaching:{cameraView:'front',angleSpace:'image',measurementMode:'arm-path',fixedGuides:structuredClone(guide),guideLocked:locked,
        pathProgress:{...rawProgress},leftElbowDeg:view.coaching?.leftElbowDeg??null,rightElbowDeg:view.coaching?.rightElbowDeg??null,
        bottomDeg:settings.bottomDeg,topDeg:settings.topDeg,targetDeg:settings.bottomDeg,armed,depthReached:!!attempt&&Math.min(attempt.maxLeft,attempt.maxRight)>=0.85,
        visualStatus:!valid||!locked||!armed?'unknown':alignment==='fail'?'fail':alignment==='pass'?'pass':'unknown',guideArms:{}}};
    return snapshot();
  }
  function interrupted(t:number){
    previousValid=false;topSince=null;badSince=null;alignment='unknown';histories={left:[],right:[]};rawProgress={left:null,right:null};
    lostSince??=t;if(attempt)attempt.uncertain=true;
    if(t-lostSince>=LOST){close(t,'unassessed');armed=false;}
    view.phase='paused';view.elbowDeg=null;view.coaching=undefined;
    return publish('Arm tracking uncertain. Keep both shoulders, elbows and wrists visible; the fixed guide stays in place.',false);
  }
  function reset(){
    locked=false;armed=false;finished=false;attempt=null;reps=[];last=topSince=lostSince=badSince=null;alignment='unknown';previousValid=false;
    histories={left:[],right:[]};rawProgress={left:null,right:null};view=emptyView();placement={...DEFAULT_PLACEMENT};
    guide=createFrontGuide(width,height,settings,placement);
  }
  return {
    update(frame:PoseFrame){
      if(finished)return snapshot();const t=frame.timestampMs;
      if(!Number.isFinite(t)||t<0||!Number.isFinite(frame.width)||!Number.isFinite(frame.height)||frame.width<=0||frame.height<=0)return interrupted(last??0);
      if(last!==null&&t<=last)return interrupted(last);
      const dt=last===null?0:t-last;
      if(width!==frame.width||height!==frame.height){close(t,'unassessed');width=frame.width;height=frame.height;guide=createFrontGuide(width,height,settings,placement);locked=false;armed=false;topSince=null;}
      if(dt>1000){close(t,'unassessed');armed=false;previousValid=false;histories={left:[],right:[]};topSince=null;}
      if(dt<=1000)view.elapsedMs+=dt;last=t;
      if(frame.source==='mock')locked=true;
      const arms=frame.arms??{};
      const complete=SIDES.every(side=>JOINTS.every(key=>{const p=arms[side]?.[key];return isUsablePoint(p)&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;}));
      if(!complete)return interrupted(t);
      if(lostSince!==null){if(t-lostSince>=LOST){close(t,'unassessed');armed=false;}lostSince=null;}
      if(previousValid)view.assessableMs+=Math.min(dt,1000);previousValid=true;
      const progress={left:0,right:0},errors:number[]=[];
      const projected:{left:number|null;right:number|null}={left:null,right:null};
      for(const side of SIDES){
        const arm=arms[side]!,a=guide.top[side],b=guide.bottom[side];
        projected[side]=angleDeg(arm.shoulder,arm.elbow,arm.wrist);
        if(projected[side]===null)return interrupted(t);
        let numerator=0,denominator=0;
        for(const key of ['shoulder','elbow'] as const){const dx=b[key]!.x-a[key]!.x,dy=b[key]!.y-a[key]!.y;numerator+=(arm[key]!.x-a[key]!.x)*dx+(arm[key]!.y-a[key]!.y)*dy;denominator+=dx*dx+dy*dy;}
        const p=numerator/denominator;
        if(!Number.isFinite(p))return interrupted(t);
        histories[side].push(p);if(histories[side].length>3)histories[side].shift();progress[side]=median(histories[side]);
        // Extrapolate past the bottom: deeper travel alone is not an alignment fault.
        const stage=Math.max(-0.25,Math.min(2.5,progress[side]));
        for(const key of JOINTS){const x=a[key]!.x+stage*(b[key]!.x-a[key]!.x),y=a[key]!.y+stage*(b[key]!.y-a[key]!.y);errors.push(Math.hypot(arm[key]!.x-x,arm[key]!.y-y)/guide.span);}
      }
      rawProgress=progress;view.coaching={...view.coaching!,leftElbowDeg:projected.left,rightElbowDeg:projected.right};
      view.elbowDeg=projected.left!==null&&projected.right!==null?(projected.left+projected.right)/2:null;
      const worst=Math.max(...errors),sync=Math.abs(progress.left-progress.right);
      if(worst>PATH_BAND||sync>0.55){badSince??=t;if(t-badSince>=FAIL_HOLD)alignment='fail';}
      else{badSince=null;alignment='pass';}
      if(!locked){armed=false;view.phase='ready';return publish('Adjust the fixed guide size/position, line up at its upper arms, then click Lock guide & start set.',true);}
      const top=Math.max(progress.left,progress.right)<=0.16&&Math.min(progress.left,progress.right)>=-0.35&&worst<0.30;
      if(!top)topSince=null;
      if(!armed){view.phase='ready';if(top){topSince??=t;if(t-topSince>=HOLD)armed=true;}return publish(armed?'Ready. Lower along the fixed arm paths.':'Line up with both upper dashed arms and hold briefly.',true);}
      if(!attempt&&Math.max(progress.left,progress.right)>0.22){attempt={start:t,minAngle:view.elbowDeg??180,maxLeft:0,maxRight:0,uncertain:false,alignment};view.phase='down';}
      if(attempt){
        attempt.maxLeft=Math.max(attempt.maxLeft,progress.left);attempt.maxRight=Math.max(attempt.maxRight,progress.right);
        attempt.minAngle=Math.min(attempt.minAngle,view.elbowDeg??180);if(alignment==='fail')attempt.alignment='fail';
        const min=Math.min(progress.left,progress.right),maxSeen=Math.min(attempt.maxLeft,attempt.maxRight);
        view.phase=min>=0.85?'bottom':min<maxSeen-0.12?'up':'down';
        if(top){topSince??=t;if(t-topSince>=HOLD&&t-attempt.start>=350){const full=maxSeen>=0.85&&!attempt.uncertain;close(t,full?'completed':'incomplete');view.phase='ready';}}
      }else view.phase='ready';
      return publish(alignment==='fail'?'Bring your arms toward the fixed guide; keep hands near the hand targets.':attempt
        ?view.phase==='bottom'?'Lower target reached. Push back to the upper arm guide.':'Follow the fixed arm paths. Partial attempts are recorded too.'
        :reps.at(-1)?.feedback?.suggestions[0]??'Ready for the next attempt.',true);
    },
    finish(t){if(finished)return snapshot();finished=true;close(Number.isFinite(t)?Math.max(last??0,t):last??0,lostSince!==null?'unassessed':'incomplete');return publish(view.cue??'Set recorded.',false);},
    reset,
    setGuide(next){
      if(locked||!Object.values(next).every(Number.isFinite))return snapshot();
      placement={scale:Math.max(0.6,Math.min(1.4,next.scale)),offsetX:Math.max(-0.2,Math.min(0.2,next.offsetX)),offsetY:Math.max(-0.2,Math.min(0.12,next.offsetY))};
      guide=createFrontGuide(width,height,settings,placement);histories={left:[],right:[]};
      return publish('Guide moved by your controls only. Line up, then lock it.',false);
    },
    lockGuide(){locked=true;armed=false;topSince=null;histories={left:[],right:[]};return publish('Guide locked. Line up with the upper dashed arms and hold briefly.',false);}
  };
}
