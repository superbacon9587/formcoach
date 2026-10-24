import type { CoachUI } from '../shared/contracts';
import { drawOverlay } from './overlay';
import './styles.css';
export function mountUI(root: HTMLElement): CoachUI {
  root.innerHTML=`<main><header><span class="eyebrow">HACKATHON STARTER · CONTRACT v1</span><h1>FormCoach <small>pushups</small></h1><p>Side-view movement feedback. Start with a mock preview while the team builds.</p></header>
  <section class="controls"><button id="mock">Mock preview</button><button id="camera">Live camera</button><button id="stop" disabled>Stop set</button><button id="reset">Reset</button></section>
  <p id="status" role="status"></p><section class="stage"><video muted playsinline></video><canvas></canvas><span id="source">NO INPUT</span></section>
  <section class="stats"><article><strong id="count">0</strong><span>Completed cycles</span></article><article><strong id="alignment">unknown</strong><span>Hip alignment</span></article><article><strong id="phase">ready</strong><span>Phase</span></article></section>
  <p id="cue">Checks not implemented yet.</p><section id="summary"><h2>Set summary</h2><p id="results">No assessed reps.</p></section>
  <footer>Starter status: UI and mock wiring work. A implements camera tracking; B implements assessment; C improves the experience. Unknown never means good form.</footer></main>`;
  const q=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const video=q<HTMLVideoElement>('video'),canvas=q<HTMLCanvasElement>('canvas');
  let actions:Parameters<CoachUI['bind']>[0]|null=null;
  q('#mock').onclick=()=>void actions?.start('mock');q('#camera').onclick=()=>void actions?.start('camera');
  q('#stop').onclick=()=>actions?.stop();q('#reset').onclick=()=>actions?.reset();
  return {
    video,bind(a){actions=a;},
    render(frame,view){
      q('#source').textContent=frame?`${frame.source.toUpperCase()} INPUT`:'NO INPUT';
      q('#count').textContent=String(view.completed);q('#alignment').textContent=view.checks.alignment;
      q('#phase').textContent=view.phase;q('#cue').textContent=view.cue??'Only enabled, assessable checks may pass.';
      q('#results').textContent=`${view.completed} completed · ${view.incomplete} incomplete · ${view.unassessed} unassessed. Checks enabled: ${Object.entries(view.enabledChecks).filter(([,v])=>v).map(([k])=>k).join(', ')||'none yet'}.`;
      video.style.visibility=frame?.source==='camera'?'visible':'hidden';drawOverlay(canvas,frame,view);
    },
    setStatus(message){q('#status').textContent=message;},
    setRunning(running){q<HTMLButtonElement>('#mock').disabled=running;q<HTMLButtonElement>('#camera').disabled=running;q<HTMLButtonElement>('#stop').disabled=!running;},
    destroy(){actions=null;root.replaceChildren();}
  };
}
