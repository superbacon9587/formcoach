/** Frozen integration shell: change only by team agreement, applied by A. */
import { createAnalyzer } from './analysis';
import { startCameraSource } from './tracking';
import { startMockSource } from './fixtures/mock';
import { mountUI } from './ui';
import type { PoseFrame, StopSource } from './shared/contracts';
const root=document.querySelector<HTMLElement>('#app');
if(!root)throw new Error('Missing #app');
const ui=mountUI(root), analyzer=createAnalyzer();
let stopSource:StopSource|null=null,lastFrame:PoseFrame|null=null;
let token=0,lastTimestamp=0,starting=false;
function stop(){
  token++;starting=false;stopSource?.();stopSource=null;
  ui.render(lastFrame,analyzer.finish(lastTimestamp));ui.setRunning(false);
}
function reset(){stop();analyzer.reset();lastFrame=null;lastTimestamp=0;ui.render(null,analyzer.finish(0));ui.setStatus('Ready. Choose mock preview or live camera.');}
async function start(mode:'mock'|'camera'){
  if(starting)return;
  stop();reset();starting=true; const run=++token;ui.setRunning(true);
  try{
    const source=mode==='mock'?startMockSource:startCameraSource;
    const stopper=await source({video:ui.video,onFrame(frame){
      if(run!==token)return;lastFrame=frame;lastTimestamp=frame.timestampMs;
      ui.render(frame,analyzer.update(frame));
    },onStatus(message){if(run===token)ui.setStatus(message);}});
    if(run!==token)stopper();else stopSource=stopper;
  }catch(error){if(run===token){ui.setStatus(error instanceof Error?error.message:String(error));ui.setRunning(false);}}
  finally{if(run===token)starting=false;}
}
ui.bind({start,stop,reset});reset();
window.addEventListener('pagehide',()=>{stop();ui.destroy();});
