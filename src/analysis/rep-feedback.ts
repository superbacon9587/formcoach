import type { RepFeedback } from '../shared/quality';
import type { CheckStatus, CheckResults, RepResult } from '../shared/contracts';
import { PUSHUP_RULES as R } from './pushup-rules';
export function repFeedback(min:number,finish:number|null,bottom:number,top:number,alignment:CheckStatus,uncertain:boolean,cameraView:'front'|'side'='front',checks?:CheckResults):RepFeedback {
  const assessed=checks??{alignment,depth:uncertain?'unknown':min<=bottom+R.depthToleranceDeg?'pass':'fail',extension:uncertain?'unknown':finish!==null&&finish>=top-R.lockoutToleranceDeg?'pass':'fail'};
  const suggestions=faultSuggestions(assessed,bottom,cameraView);
  if(uncertain)return {score:null,depth:'uncertain',suggestions};
  const depth=min<=bottom+R.depthToleranceDeg?'met':min<=bottom+20?'near':'partial';
  const range=Math.max(30,top-bottom);
  const depthScore=Math.max(0,Math.min(1,(top-min)/range));
  const extensionScore=finish===null?null:Math.max(0,Math.min(1,(finish-bottom)/range));
  let weighted=depthScore*0.6,weight=0.6;
  if(extensionScore!==null){weighted+=extensionScore*0.25;weight+=0.25;}
  if(alignment!=='unknown'){weighted+=(alignment==='pass'?1:0.6)*0.15;weight+=0.15;}
  return {score:Math.round(weighted/weight*100),depth,suggestions};
}

/** Corrections are generated from failed checks, never from unknown measurements. */
export function faultSuggestions(checks:CheckResults,bottom=90,cameraView:'front'|'side'='side'):string[]{
  const cues:string[]=[];
  if(checks.alignment==='fail')cues.push(cameraView==='side'
    ?'Body alignment - Tighten your core and squeeze your glutes. Move your shoulders and hips up and down together.'
    :'Arm alignment - Bend and straighten both arms together. Keep your chest centered between your hands.');
  if(checks.depth==='fail')cues.push(`Elbow depth - Bend your elbows to about ${bottom} degrees before pressing back up. Lower only as far as you can comfortably control.`);
  if(checks.extension==='fail')cues.push('Lockout - Push back up until your arms are straight before starting the next rep. Avoid snapping your elbows straight.');
  return cues;
}

/** Each failed check appears once, even if it failed on several reps. */
export function sessionSuggestions(reps:readonly RepResult[]):string[]{
  return [...new Set(reps.flatMap(r=>r.feedback?.suggestions??[]))];
}
