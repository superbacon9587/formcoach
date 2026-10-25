import type { Analyzer, PoseFrame, SessionView } from '../shared/contracts';
import { plankReadiness } from './plank-ready';
import type { Point } from '../shared/contracts';

/** Camera-only preparation gate. All timing uses fresh pose timestamps. */
export function withPreparation(make:()=>Analyzer,top:number):Analyzer {
  let engine=make(),active=false,stableSince:number|null=null,last:number|null=null;
  let latest:SessionView|null=null;
  let goAt:number|null=null,countdownStarted=false;
  let anchor:Point[]|null=null;
  return {
    update(frame:PoseFrame){
      if(frame.source==='mock')return latest=engine.update(frame);
      if(active){
        const view=engine.update(frame);
        return latest={...view,coaching:view.coaching?{...view.coaching,preparation:'active',countdownSeconds:goAt!==null&&frame.timestampMs-goAt<1000?0:undefined}:undefined};
      }
      const t=frame.timestampMs;
      if(!Number.isFinite(t)||last!==null&&t<=last)return latest??engine.update(frame);
      const fresh=Number.isFinite(t)&&(last===null||t>last&&t-last<=500);
      last=t;
      const preview=engine.update(frame);
      const pose=plankReadiness(frame,preview.elbowDeg,top);
      const ready=fresh&&pose.ready;
      if(!countdownStarted){
        if(!ready){stableSince=null;anchor=null;engine=make();}
        else {
          const moving=anchor&&pose.points.some((p,i)=>Math.hypot(p.x-anchor![i].x,p.y-anchor![i].y)>pose.span*0.06);
          if(stableSince===null||moving){stableSince=t;anchor=structuredClone(pose.points);}
        }
      }
      const elapsed=stableSince===null?0:t-stableSince;
      const confirmed=ready&&elapsed>=600;
      if(confirmed&&elapsed>=900)countdownStarted=true;
      if(countdownStarted&&elapsed>=3900){
        active=true;goAt=t;engine=make();
        if(ready)engine.update({...frame,timestampMs:Math.max(0,t-200)});
        const view=engine.update(frame);
        latest={...view,cue:'Go! Begin your pushups.',coaching:view.coaching?{...view.coaching,preparation:'active',countdownSeconds:0}:undefined};
        return structuredClone(latest);
      }
      const counting=countdownStarted;
      latest={...preview,completed:0,incomplete:0,unassessed:0,totalAttempts:0,reps:[],formScore:null,suggestions:[],elapsedMs:0,assessableMs:0,
        phase:'ready',checks:{alignment:confirmed?'pass':'unknown',depth:'unknown',extension:confirmed?'pass':'unknown'},
        cue:counting?`Begin in ${Math.ceil((3900-elapsed)/1000)}… Hold your top position.`:confirmed?'Position confirmed. Stay green; the countdown is about to begin.':pose.reason,
        coaching:preview.coaching?{...preview.coaching,armed:false,visualStatus:confirmed?'pass':'unknown',armVisualStatus:confirmed?'pass':'unknown',armFaults:{depth:false,extension:false},preparation:counting?'countdown':'positioning',countdownSeconds:counting?Math.ceil((3900-elapsed)/1000):undefined}:undefined};
      return structuredClone(latest);
    },
    finish(t){if(active)return engine.finish(t);engine.reset();return engine.finish(t);},
    reset(){engine=make();active=false;stableSince=last=null;goAt=null;countdownStarted=false;anchor=null;latest=null;},
  };
}
