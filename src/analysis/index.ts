import type { Analyzer, CheckStatus, Phase, PoseFrame, RepResult, SessionView, Side } from '../shared/contracts';
import { emptyView } from '../shared/defaults';
import { DEFAULT_SETTINGS, type ArmPose, type CoachSettings, type WorldPose } from '../shared/coaching';
import { angleDeg, isUsablePoint } from './metrics';
import { angleGuide } from './target-guide';
import { withPreparation } from './preparation';
import { median, shoulderProfile } from './motion';
import { repFeedback, sessionSuggestions } from './rep-feedback';
import { PUSHUP_RULES as R } from './pushup-rules';

type Attempt={startedAtMs:number;min:number;depth:boolean;alignment:CheckStatus;maxDrop:number;uncertain:boolean;returnPeak?:number;reversalSince?:number};
export function worldElbow(arm:WorldPose|undefined):number|null {
  const a=arm?.shoulder,b=arm?.elbow,c=arm?.wrist;
  if(!isUsablePoint(a)||!isUsablePoint(b)||!isUsablePoint(c))return null;
  if(!Number.isFinite(a.z)||!Number.isFinite(b.z)||!Number.isFinite(c.z))return null;
  const u=[a.x-b.x,a.y-b.y,a.z-b.z],v=[c.x-b.x,c.y-b.y,c.z-b.z];
  const d=Math.hypot(...u)*Math.hypot(...v);if(!Number.isFinite(d)||d<1e-10)return null;
  return Math.acos(Math.max(-1,Math.min(1,u.reduce((n,x,i)=>n+x*v[i],0)/d)))*180/Math.PI;
}
export function createAnalyzer(input:Partial<CoachSettings>={}):Analyzer {
  const settings={...input,cameraView:'side' as const};
  return withPreparation(()=>createAngleAnalyzer(settings),settings.topDeg??DEFAULT_SETTINGS.topDeg);
}
/** Previous angular engine retained for Side mode and regression comparisons. */
export function createAngleAnalyzer(input:Partial<CoachSettings>={}):Analyzer {
  const config={...DEFAULT_SETTINGS,...input};
  if(!Number.isFinite(config.bottomDeg)||!Number.isFinite(config.topDeg)||config.bottomDeg<45
    ||config.bottomDeg>120||config.topDeg<140||config.topDeg>180||config.topDeg-config.bottomDeg<30)
    throw new Error('Choose bottom 45–120°, lockout 140–180°, with at least 30° between them.');
  let view=emptyView(),phase:Phase='ready',armed=false,finished=false;
  let lastTime:number|null=null,lossSince:number|null=null,topSince:number|null=null,bottomSince:number|null=null;
  let evidenceSince:number|null=null,recoverSince:number|null=null,alignment:CheckStatus='unknown';
  let previousValid=false,signature:string|null=null,attempt:Attempt|null=null,redUntil=-1;
  let calibrated:Partial<Record<Side,ArmPose>>={},left:number|null=null,right:number|null=null;
  let reps:RepResult[]=[];
  let activeSpace=config.angleSpace;
  let histories:Record<Side,number[]>={left:[],right:[]};
  let topProfile:ReturnType<typeof shoulderProfile>=null;
  let drop:number|null=null,lastDrop:number|null=null,lastRawMean:number|null=null,lastSmoothedMean:number|null=null;
  let lastFeedback:string|null=null;
  let noisyUntil=-1,armRedUntil=-1;
  let armFaults={depth:false,extension:false};
  let rawLeft:number|null=null,rawRight:number|null=null;
  const clearSamples=()=>{histories={left:[],right:[]};lastRawMean=null;lastDrop=null;lastSmoothedMean=null;};
  const copy=()=>structuredClone(view);
  const clearMotion=()=>{armed=false;phase='paused';topSince=bottomSince=null;calibrated={};topProfile=null;drop=null;clearSamples();};
  function log(outcome:RepResult['outcome'],t:number,finish:number|null){
    if(!attempt)return;
    if(attempt.maxDrop>=R.minimumDrop&&attempt.min>config.topDeg-R.startMarginDeg)attempt.uncertain=true;
    const uncertain=attempt.uncertain||outcome==='unassessed';
    const checks:RepResult['checks']={alignment:attempt.alignment,depth:uncertain?'unknown':attempt.depth?'pass':'fail',
      extension:outcome==='unassessed'?'unknown':finish!==null&&finish>=config.topDeg-R.lockoutToleranceDeg-1e-6?'pass':'fail'};
    const feedback=repFeedback(attempt.min,finish,config.bottomDeg,config.topDeg,attempt.alignment,uncertain,config.cameraView,checks);
    lastFeedback=feedback.suggestions[0]??null;
    reps.push({feedback,id:reps.length+1,startedAtMs:attempt.startedAtMs,endedAtMs:t,outcome,
      minElbowDeg:attempt.min,finishElbowDeg:finish,checks});
    armFaults={depth:checks.depth==='fail',extension:checks.extension==='fail'};
    armRedUntil=armFaults.depth||armFaults.extension?t+1200:-1;
    attempt=null;bottomSince=null;
  }
  function decorate(t:number,valid:boolean,depthReached:boolean,cue:string|null):SessionView {
    const topTarget=depthReached||phase==='up';const targetDeg=topTarget?config.topDeg:config.bottomDeg;
    const guideArms:Partial<Record<Side,ArmPose>>={};
    for(const side of ['left','right'] as const)if(calibrated[side])guideArms[side]=angleGuide(calibrated[side]!,targetDeg,side);
    const scored=reps.map(r=>r.feedback?.score).filter((n):n is number=>n!==null&&n!==undefined);
    const tips=sessionSuggestions(reps);
    view={...view,phase,totalAttempts:reps.length,formScore:scored.length?Math.round(scored.reduce((a,b)=>a+b,0)/scored.length):null,suggestions:tips,completed:reps.filter(r=>r.outcome==='completed').length,
      incomplete:reps.filter(r=>r.outcome==='incomplete').length,unassessed:reps.filter(r=>r.outcome==='unassessed').length,
      reps:structuredClone(reps),cue,enabledChecks:{alignment:true,depth:true,extension:true},
      checks:valid?{alignment,depth:t<armRedUntil&&armFaults.depth?'fail':depthReached?'pass':'unknown',extension:t<armRedUntil&&armFaults.extension?'fail':armed&&phase==='ready'?'pass':'unknown'}:
        {alignment:'unknown',depth:'unknown',extension:'unknown'},
      coaching:{cameraView:config.cameraView,angleSpace:activeSpace,leftElbowDeg:left,rightElbowDeg:right,rawLeftElbowDeg:rawLeft,rawRightElbowDeg:rawRight,
        bottomDeg:config.bottomDeg,topDeg:config.topDeg,targetDeg,armed,depthReached,shoulderDrop:drop,depthConfidence:attempt?.uncertain?'uncertain':'stable',
        armVisualStatus:!valid||!armed?'unknown':t<armRedUntil?'fail':alignment==='unknown'?'unknown':'pass',
        armFaults:t<armRedUntil?{...armFaults}:{depth:false,extension:false},
        visualStatus:!valid||!armed?'unknown':t<redUntil||alignment==='fail'?'fail':alignment==='pass'?'pass':'unknown',guideArms}};
    return copy();
  }
  function invalid(t:number,cue:string){
    lossSince??=lastTime??t;previousValid=false;topSince=bottomSince=null;
    if(attempt)attempt.uncertain=true;clearSamples();
    evidenceSince=recoverSince=null;alignment='unknown';phase='paused';
    // Interrupt depth evidence even during the grace period; never stitch endpoint holds across loss.
    if(t-lossSince>=R.lostResetMs){log('unassessed',t,null);clearMotion();}
    view.elbowDeg=null;view.hipDeviation=null;
    return decorate(t,false,attempt?.depth??false,cue);
  }
  return {
    update(frame){
      if(finished)return copy();
      const t=frame.timestampMs;
      activeSpace=frame.source==='mock'?'image':config.angleSpace;
      if(!Number.isFinite(t)||t<0||!Number.isFinite(frame.width)||frame.width<=0||!Number.isFinite(frame.height)||frame.height<=0)
        return invalid(lastTime??0,'Invalid camera data. Reset the set.');
      if(lastTime!==null&&t<=lastTime)return invalid(lastTime,'Waiting for fresh camera frames.');
      const dt=lastTime===null?0:t-lastTime;
      const tag=`${frame.source}/${frame.width}/${frame.height}/${config.cameraView==='side'?frame.side:'front'}`;
      if((signature!==null&&tag!==signature)||dt>R.maxFrameGapMs){
        log('unassessed',t,null);clearMotion();alignment='unknown';previousValid=false;evidenceSince=recoverSince=null;
      }
      signature=tag;
      if(dt<=R.maxFrameGapMs)view.elapsedMs+=dt;
      const sides:Side[]=config.cameraView==='front'?['left','right']:[frame.side??'left'];
      const arms:Partial<Record<Side,ArmPose>>=frame.arms??(frame.side?{[frame.side]:frame.joints}:{});
      const measured:Partial<Record<Side,number|null>>={};
      for(const side of sides){
        const arm=arms[side];
        const within=(['shoulder','elbow','wrist'] as const).every(k=>{
          const p=arm?.[k];return isUsablePoint(p)&&p.x>=0&&p.x<=frame.width&&p.y>=0&&p.y<=frame.height;
        });
        measured[side]=!within?null:config.angleSpace==='world'&&frame.source==='camera'
          ?worldElbow(frame.worldArms?.[side]):angleDeg(arm?.shoulder,arm?.elbow,arm?.wrist);
      }
      rawLeft=measured.left??null;rawRight=measured.right??null;
      left=rawLeft;right=rawRight;
      if(frame.tracking==='lost'||sides.some(s=>measured[s]===null||measured[s]===undefined)){
        const out=invalid(t,config.angleSpace==='world'&&frame.source==='camera'
          ?'Keep the visible-side shoulder, elbow and wrist clear. Waiting for confident 3D elbow tracking.'
          :'Keep the visible-side shoulder, elbow and wrist inside the frame.');lastTime=t;return out;
      }
      if(lossSince!==null){
        if(t-lossSince>=R.lostResetMs){log('unassessed',t,null);clearMotion();}
        lossSince=null;
      }
      const profile=config.cameraView==='front'?shoulderProfile(arms):null;
      const anchored=profile&&topProfile&&profile.span/topProfile.span>0.7&&profile.span/topProfile.span<1.4
        &&Math.hypot(profile.wx-topProfile.wx,profile.wy-topProfile.wy)<topProfile.span*0.25;
      drop=anchored&&topProfile!.height>0.15?Math.max(-0.3,Math.min(1.2,1-profile!.height/topProfile!.height)):null;
      const rawMean=sides.reduce((n,s)=>n+measured[s]!,0)/sides.length;
      // A large elbow-angle jump while shoulder height is nearly unchanged is not evidence of depth.
      if(attempt&&activeSpace==='world'&&lastRawMean!==null&&lastDrop!==null&&drop!==null&&drop>R.minimumDrop
        &&Math.abs(drop-lastDrop)<0.06&&Math.abs(rawMean-lastRawMean)>40){attempt.uncertain=true;noisyUntil=t+350;}
      lastRawMean=rawMean;lastDrop=drop;
      for(const side of sides){histories[side].push(measured[side]!);if(histories[side].length>3)histories[side].shift();measured[side]=median(histories[side]);}
      left=measured.left??null;right=measured.right??null;
      const angles=sides.map(s=>measured[s]!);const high=Math.max(...angles),low=Math.min(...angles);
      view.elbowDeg=angles.reduce((a,b)=>a+b,0)/angles.length;
      const angularSpeed=lastSmoothedMean===null||dt<=0?0:(view.elbowDeg-lastSmoothedMean)*1000/dt;
      lastSmoothedMean=view.elbowDeg;
      lastTime=t;
      let error:number|null=null,failBand:number=R.symmetryFailDeg,passBand:number=R.symmetryRecoverDeg;
      if(config.cameraView==='front')error=Math.abs(left!-right!);
      else {
        const arm=arms[sides[0]],s=arm?.shoulder,h=arm?.hip,a=arm?.ankle;
        if(isUsablePoint(s)&&isUsablePoint(h)&&isUsablePoint(a)){
          const dx=a.x-s.x,dy=a.y-s.y,d=dx*dx+dy*dy;
          if(d>1)error=Math.abs(dx*(h.y-s.y)-dy*(h.x-s.x))/d;
        }
        failBand=R.hipFail;passBand=R.hipRecover;
      }
      if(t<noisyUntil)error=null;
      if(previousValid&&error!==null&&dt<=R.maxFrameGapMs)view.assessableMs+=dt;
      previousValid=error!==null;
      view.hipDeviation=config.cameraView==='side'?error:null;
      if(error===null){alignment='unknown';evidenceSince=recoverSince=null;}
      else if(error>failBand){recoverSince=null;evidenceSince??=t;if(t-evidenceSince>=R.feedbackHoldMs)alignment='fail';}
      else if(error<passBand||(alignment==='unknown'&&error<=failBand)){evidenceSince=null;recoverSince??=t;if(t-recoverSince>=R.feedbackRecoverMs)alignment='pass';}
      else {evidenceSince=recoverSince=null;}
      if(attempt){attempt.min=Math.min(attempt.min,high);attempt.maxDrop=Math.max(attempt.maxDrop,drop??0);if(alignment==='fail')attempt.alignment='fail';
        else if(attempt.alignment!=='fail'&&alignment==='unknown')attempt.alignment='unknown';}
      const angleTop=low>=config.topDeg-R.lockoutToleranceDeg-1e-6;
      const motionRecovered=drop!==null&&drop<=R.recoveredDrop;
      const corroboratedReturn=!!attempt&&attempt.maxDrop>=R.minimumDrop&&motionRecovered&&low>=config.topDeg-R.returnToleranceDeg&&Math.abs(angularSpeed)<12;
      const atTop=(angleTop&&(topProfile===null||(drop!==null&&drop<=R.minimumDrop)))||corroboratedReturn;
      const atBottom=high<=config.bottomDeg+R.depthToleranceDeg+1e-6;
      // Starting another descent after a clear upward return ends the previous
      // cycle even when the person never reached the lockout threshold.
      if(config.cameraView==='side'&&attempt){
        if(high>=attempt.min+12)attempt.returnPeak=Math.max(attempt.returnPeak??high,high);
        if(attempt.returnPeak!==undefined&&attempt.returnPeak<config.topDeg-R.lockoutToleranceDeg
          &&high<=attempt.returnPeak-12){
          attempt.reversalSince??=t;
          if(t-attempt.reversalSince>=60&&t-attempt.startedAtMs>=R.minimumAttemptMs){
            const peak=attempt.returnPeak;
            log('incomplete',t,peak);
            attempt={startedAtMs:t,min:high,depth:false,alignment,maxDrop:drop??0,uncertain:false};
            phase='down';
          }
        }else attempt.reversalSince=undefined;
      }
      if(!atTop)topSince=null;
      if(!atBottom)bottomSince=null;
      let cue:string;
      if(!armed){
        phase='ready';if(atTop){topSince??=t;if(t-topSince>=R.topHoldMs){armed=true;
          calibrated=structuredClone(arms);topProfile=profile;phase='ready';}}
        cue=armed?'Ready. Lower until your visible elbow reaches the depth target.':`Hold your usual straight-arm top (target ${Math.round(config.topDeg)}°, with a small tracking tolerance).`;
      }else {
        if(!attempt&&!atTop&&(low<config.topDeg-R.startMarginDeg||(drop!==null&&drop>R.minimumDrop))){attempt={startedAtMs:t,min:high,depth:false,alignment,maxDrop:drop??0,uncertain:false};phase='down';}
        if(attempt){
          if(!attempt.depth)phase='down';
          if(atBottom){bottomSince??=t;if(t-bottomSince>=R.bottomHoldMs){attempt.depth=true;phase='bottom';}}
          if(attempt.depth&&!atBottom)phase='up';
          if(!attempt.depth&&drop!==null&&attempt.maxDrop>=R.minimumDrop){
            if(drop<attempt.maxDrop-0.07)phase='up';else if(drop>0.24)phase='bottom';
          }
          if(atTop){topSince??=t;if(t-topSince>=R.returnHoldMs&&t-attempt.startedAtMs>=R.minimumAttemptMs){const full=attempt.depth&&!attempt.uncertain&&low>=config.topDeg-R.lockoutToleranceDeg;log(full?'completed':'incomplete',t,low);phase='ready';}}
        }else phase='ready';
        cue=attempt?.uncertain?'Keep your elbow in view. Move the camera to your side if it loses your arm.':attempt?.depth
          ?`Depth reached. Push to ${config.topDeg}° lockout.`
          :attempt&&drop!==null&&drop>0.24?'Bottom movement detected. Return smoothly; depth feedback comes after the rep.'
          :attempt?`Move through a comfortable range; partial attempts are recorded too.`:lastFeedback??'Ready for the next rep.';
      }
      if(alignment==='fail')cue=config.cameraView==='front'?'Keep both arms moving together.':'Tighten your stomach and move your shoulders and hips together.';
      return decorate(t,error!==null,attempt?.depth??false,cue);
    },
    finish(t){
      if(finished)return copy();finished=true;
      const when=Number.isFinite(t)?Math.max(t,lastTime??0):lastTime??0;
      log(lossSince!==null?'unassessed':'incomplete',when,null);
      const scores=reps.map(r=>r.feedback?.score).filter((n):n is number=>n!==null&&n!==undefined);
      view={...view,totalAttempts:reps.length,formScore:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,suggestions:sessionSuggestions(reps),completed:reps.filter(r=>r.outcome==='completed').length,incomplete:reps.filter(r=>r.outcome==='incomplete').length,
        unassessed:reps.filter(r=>r.outcome==='unassessed').length,reps:structuredClone(reps)};
      return copy();
    },
    reset(){view=emptyView();phase='ready';armed=finished=previousValid=false;lastTime=lossSince=topSince=bottomSince=null;
      evidenceSince=recoverSince=null;alignment='unknown';signature=null;attempt=null;redUntil=-1;calibrated={};left=right=null;reps=[];armRedUntil=-1;armFaults={depth:false,extension:false};activeSpace=config.angleSpace;topProfile=null;drop=null;lastFeedback=null;noisyUntil=-1;rawLeft=rawRight=null;clearSamples();}
  };
}
