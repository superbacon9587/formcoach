/** Single-computer group integration; no remote mutations during local testing. */
import { createAnalyzer } from './analysis';
import { startCameraSource } from './tracking';
import { startMockSource } from './fixtures/mock';
import { mountUI } from './ui';
import type { GuidePlacement } from './shared/front-guide';
import { DEFAULT_SETTINGS, type CoachSettings } from './shared/coaching';
import type { PoseFrame, StopSource } from './shared/contracts';
const root=document.querySelector<HTMLElement>('#app');
if(!root)throw new Error('Missing #app');
const ui=mountUI(root); let analyzer=createAnalyzer();
let stopSource:StopSource|null=null,lastFrame:PoseFrame|null=null;
let token=0,lastTimestamp=0,starting=false;
let diagnostics:unknown[]=[];
function stop(){
  token++;starting=false;stopSource?.();stopSource=null;
  ui.render(lastFrame,analyzer.finish(lastTimestamp));ui.setRunning(false);
}
function reset(){stop();diagnostics=[];analyzer.reset();lastFrame=null;lastTimestamp=0;ui.render(null,analyzer.finish(0));ui.setStatus('Ready. Choose mock preview or live camera.');}
async function start(mode:'mock'|'camera',settings:CoachSettings=DEFAULT_SETTINGS){
  if(starting)return;
  stop();reset();starting=true; const run=++token;ui.setRunning(true);
  try{
    analyzer=createAnalyzer(settings);
    const source=mode==='mock'?startMockSource:startCameraSource;
    const stopper=await source({video:ui.video,cameraView:settings.cameraView,onFrame(frame){
      if(run!==token)return;lastFrame=frame;lastTimestamp=frame.timestampMs;
      const view=analyzer.update(frame);
      diagnostics.push({timestampMs:frame.timestampMs,source:frame.source,tracking:frame.tracking,
        phase:view.phase,totalAttempts:view.totalAttempts,completed:view.completed,incomplete:view.incomplete,
        armMeasurements:view.coaching,visibility:Object.fromEntries(Object.entries(frame.arms??{}).map(([side,arm])=>[side,Object.fromEntries(Object.entries(arm??{}).map(([joint,p])=>[joint,p?.visibility??null]))])),cue:view.cue});
      if(diagnostics.length>20000)diagnostics.shift();
      ui.render(frame,view);
    },onStatus(message){if(run===token)ui.setStatus(message);}});
    if(run!==token)stopper();else stopSource=stopper;
  }catch(error){if(run===token){ui.setStatus(error instanceof Error?error.message:String(error));ui.setRunning(false);}}
  finally{if(run===token)starting=false;}
}
function downloadDiagnostics(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,samples:diagnostics},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='formcoach-diagnostics.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setGuide(placement:GuidePlacement){const view=analyzer.setGuide?.(placement);if(view)ui.render(lastFrame,view);}
function lockGuide(){const view=analyzer.lockGuide?.();if(view)ui.render(lastFrame,view);}
ui.bind({start,stop,reset,downloadDiagnostics,setGuide,lockGuide});reset();
window.addEventListener('pagehide',()=>{stop();ui.destroy();});
