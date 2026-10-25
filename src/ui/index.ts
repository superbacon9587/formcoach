import type { CoachUI, PoseFrame, SessionView } from '../shared/contracts';
import { DEFAULT_SETTINGS, type CoachSettings } from '../shared/coaching';
import { emptyView } from '../shared/defaults';
import { mountPushupDemo } from './demo';
import {
  CHECK_HELP, CHECK_KEYS, CHECK_NAMES, PHASE_NAMES,
  formatCount, formatDegrees, formatSeconds, sourceLabel, statusLabel, tallyCheck, trackingLabel,
  type CheckKey,
} from './labels';
import { drawOverlay } from './overlay';
import { createMeasurementsPanel } from './measurements';
import './styles.css';

type ViewName = 'setup' | 'live' | 'summary';
type Actions = Parameters<CoachUI['bind']>[0];

/**
 * Person C entry point. Creates the DOM once (including the persistent <video>
 * handed to A) and only updates text/canvas afterwards. Renders B's SessionView;
 * never computes form metrics, faults or reps itself.
 */
export function mountUI(root: HTMLElement): CoachUI {
  root.innerHTML = `<main class="app">
  <header class="top">
    <span class="eyebrow">FORMCOACH · SIDE-VIEW PUSHUPS</span>
    <h1>FormCoach <small>pushups</small></h1>
  </header>
  <p id="status" class="status" role="status"></p>

  <section id="view-setup" class="view setup" aria-labelledby="setup-title">
    <div class="setup-demo" id="demo-slot"></div>
    <div class="setup-text">
      <h2 id="setup-title">Set up your camera</h2>
      <div class="camera-options">
        <label>Camera view <select id="camera-view"><option value="side">Side (one arm)</option></select></label>
        <label id="angle-settings">Side-view angle measurement <select id="angle-space"><option value="image">Side-view 2D (default)</option><option value="world">Estimated 3D (experimental)</option></select></label>
        <label>Reference bottom ° <input id="bottom-target" type="number" min="45" max="120" value="90" /></label>
        <label>Reference top ° <input id="top-target" type="number" min="140" max="180" value="160" /></label>
      </div>
      <p class="muted">Place the camera beside you, roughly at torso height. Keep your visible shoulder, elbow, wrist, hip and ankle inside the frame.</p>
      <ol class="steps">
        <li><strong>Start Camera.</strong> Take your time getting into position; setup movements do not count.</li>
        <li><strong>Hold the top position.</strong> Once your starting position is confirmed, the figure turns green. Hold your plank still briefly. The figure turns green, then a 3-second countdown runs on the camera without restarting. Stay in position until Go.</li>
        <li><strong>Perform your reps.</strong> Reach the elbow-depth target and return to the top. No bottom pause is required. Partial attempts count too.</li>
        <li><strong>End Set.</strong> Click the button on your laptop when finished to see suggestions for your next set.</li>
      </ol>
      <h3>What this version checks</h3>
      <ul class="checklist" id="setup-checks"></ul>
      <div class="actions">
        <button id="camera" class="primary" type="button">Start Camera</button>
        <button id="mock" type="button">Mock preview <span class="muted">(synthetic)</span></button>
      </div>
    </div>
  </section>

  <section id="view-live" class="view live" hidden aria-label="Live set">
    <div class="stage">
      <video muted playsinline></video>
      <canvas aria-hidden="true"></canvas>
      <div id="camera-countdown" class="camera-countdown" role="status" aria-live="polite" aria-atomic="true" hidden><strong id="countdown-number"></strong><span id="countdown-caption"></span></div>
      <div class="camera-count" aria-hidden="true"><strong id="camera-count">0</strong><span>REP ATTEMPTS</span></div>
      <span id="source" class="badge">NO INPUT</span>
      <span id="tracking" class="tracking" data-tone="neutral"></span>
    </div>
    <aside class="panel">
      <div id="guide-controls" class="guide-controls">
        <strong>Position the fixed arm guide</strong>
        <label>Size <input id="guide-scale" type="range" min="0.6" max="1.4" step="0.02" value="1" /></label>
        <label>Left / right <input id="guide-x" type="range" min="-0.2" max="0.2" step="0.01" value="0" /></label>
        <label>Up / down <input id="guide-y" type="range" min="-0.2" max="0.12" step="0.01" value="0" /></label>
        <button id="lock-guide" type="button">Lock guide & start set</button>
        <p class="muted">Guide stays fixed. Show just your arms; hips and legs are not required.</p>
      </div>
      <div class="count"><strong id="count">0</strong><span>rep attempts recorded</span></div>
      <p id="target-status" class="target-status"></p><p class="phase">Phase: <span id="phase">Ready</span> · Elbow <span id="elbow">—</span></p>
      <ul class="chips" id="live-checks" aria-label="Current checks"></ul>
      <p id="cue" class="cue" aria-live="polite"></p>
      <button id="stop" class="stop" type="button" disabled>End Set</button>
    </aside>
  </section>

  <section id="view-summary" class="view summary" hidden aria-labelledby="summary-title">
    <h2 id="summary-title">Set summary</h2>
    <p id="sum-source" class="muted"></p>
    <article class="suggestions-card" aria-labelledby="suggestions-title"><h3 id="suggestions-title">Suggestions for your next set</h3><ul id="sum-tips" class="coaching-tips"></ul></article><p id="sum-total" class="attempt-total"></p><p id="sum-grade" class="quality-grade"></p>
    <div class="totals">
      <article><strong id="sum-completed">0</strong><span>Depth + lockout met</span></article>
      <article><strong id="sum-incomplete">0</strong><span>Partial / needs review</span></article>
      <article><strong id="sum-unassessed">0</strong><span>Tracking interrupted</span></article>
    </div>
    <h3>Form checks</h3>
    <ul class="tallies" id="sum-checks"></ul>
    <p id="sum-time" class="muted"></p>
    <p id="sum-cue" class="cue"></p>
    <div class="actions">
      <button id="again" class="primary" type="button">Repeat set</button>
      <button id="reset" type="button">Back to setup</button>
      <button id="download-diagnostics" type="button">Download diagnostic measurements</button>
    </div>
  </section>

  <footer>Unknown or not-assessed never means good form. Mock preview uses synthetic landmarks, not a camera.
  Video stays on this device.</footer>
</main>`;

  const q = <T extends HTMLElement>(selector: string) => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`FormCoach UI missing ${selector}`);
    return el;
  };
  const video = q<HTMLVideoElement>('video');
  const canvas = q<HTMLCanvasElement>('.stage canvas');
  const measurements = createMeasurementsPanel();
  q('#view-live').append(measurements.element);
  const views: Record<ViewName, HTMLElement> = {
    setup: q('#view-setup'), live: q('#view-live'), summary: q('#view-summary'),
  };
  const btn = {
    camera: q<HTMLButtonElement>('#camera'), mock: q<HTMLButtonElement>('#mock'),
    stop: q<HTMLButtonElement>('#stop'), again: q<HTMLButtonElement>('#again'),
    reset: q<HTMLButtonElement>('#reset'),
  };
  const demo = mountPushupDemo(q('#demo-slot'));

  // Persistent check rows (created once, updated with textContent).
  const makeRows = (list: HTMLElement) => {
    const rows = {} as Record<CheckKey, { li: HTMLLIElement; icon: HTMLSpanElement; name: HTMLSpanElement; text: HTMLSpanElement }>;
    for (const key of CHECK_KEYS) {
      const li = document.createElement('li');
      const icon = document.createElement('span'); icon.className = 'icon';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = CHECK_NAMES[key];
      const text = document.createElement('span'); text.className = 'text';
      li.append(icon, name, text);
      list.append(li);
      rows[key] = { li, icon, name, text };
    }
    return rows;
  };
  const liveRows = makeRows(q('#live-checks'));
  const setupRows = makeRows(q('#setup-checks'));
  const summaryRows = makeRows(q('#sum-checks'));

  let actions: Actions | null = null;
  let running = false;
  let current: ViewName = 'setup';
  let framesThisRun = 0;
  let lastMode: 'mock' | 'camera' = 'camera';
  let lastFrame: PoseFrame | null = null;
  let lastView: SessionView = emptyView();

  const settings = (): CoachSettings => ({ cameraView:q<HTMLSelectElement>('#camera-view').value as CoachSettings['cameraView'], angleSpace:q<HTMLSelectElement>('#angle-space').value as CoachSettings['angleSpace'], bottomDeg:Number(q<HTMLInputElement>('#bottom-target').value), topDeg:Number(q<HTMLInputElement>('#top-target').value) });
  let lastSettings:CoachSettings={...DEFAULT_SETTINGS};
  function applyCameraView(){
    const cfg=settings();demo.setView(cfg.cameraView,Number.isFinite(cfg.bottomDeg)?cfg.bottomDeg:90,Number.isFinite(cfg.topDeg)?cfg.topDeg:160);
    q('#angle-settings').hidden=cfg.cameraView==='front';
    q<HTMLInputElement>('#bottom-target').min=cfg.cameraView==='front'?'65':'45';
  }
  for(const el of root.querySelectorAll('.camera-options select,.camera-options input'))el.addEventListener('change',applyCameraView);
  applyCameraView();
  for(const id of ['#guide-scale','#guide-x','#guide-y'])q<HTMLInputElement>(id).oninput=()=>actions?.setGuide?.({scale:Number(q<HTMLInputElement>('#guide-scale').value),offsetX:Number(q<HTMLInputElement>('#guide-x').value),offsetY:Number(q<HTMLInputElement>('#guide-y').value)});
  q('#lock-guide').onclick=()=>actions?.lockGuide?.();
  const start = (mode: 'mock' | 'camera') => { lastMode = mode; lastSettings=settings(); void actions?.start(mode,lastSettings); };
  btn.camera.onclick = () => start('camera');
  btn.mock.onclick = () => start('mock');
  btn.again.onclick = () => { void actions?.start(lastMode,lastSettings); };
  btn.stop.onclick = () => actions?.stop();
  q('#download-diagnostics').onclick = () => actions?.downloadDiagnostics?.();
  btn.reset.onclick = () => { framesThisRun = 0; actions?.reset(); };

  function show(name: ViewName) {
    current = name;
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
    demo.setActive(name === 'setup');
    if (name === 'summary') renderSummary(lastView);
  }

  function renderSetup(view: SessionView) {
    for (const key of CHECK_KEYS) {
      const on = view.enabledChecks[key];
      const r = setupRows[key];
      r.li.dataset.tone = 'neutral';
      r.icon.textContent = on ? '●' : '○';
      r.text.textContent = on ? CHECK_HELP[key] : `Not assessed yet · ${CHECK_HELP[key]}`;
    }
  }

  function renderLive(frame: PoseFrame | null, view: SessionView) {
    measurements.render(frame, view);
    q('#source').textContent = sourceLabel(frame);
    q('#source').dataset.source = frame?.source ?? 'none';
    const track = trackingLabel(frame);
    const trackEl = q('#tracking');
    trackEl.textContent = track.text;
    trackEl.dataset.tone = track.tone;
    const count=formatCount(view.totalAttempts ?? (view.completed+view.incomplete+view.unassessed));
    q('#count').textContent=count;
    q('#camera-count').textContent=count;
    const preparation=view.coaching?.preparation;
    const seconds=view.coaching?.countdownSeconds;
    const countdown=q('#camera-countdown');
    countdown.hidden=!running||frame?.source!=='camera'||!(preparation==='positioning'||preparation==='countdown'||preparation==='active'&&seconds===0);
    countdown.dataset.state=preparation??'';
    const positionReady=view.coaching?.visualStatus==='pass';
    const number=preparation==='positioning'?(positionReady?'READY':'GET READY'):seconds===0?'GO':String(seconds??'');
    const caption=preparation==='positioning'?(positionReady?'Position confirmed. Hold still for the countdown.':'Step back into a plank, then hold still briefly'):seconds===0?'Begin your pushups':'Hold your top position';
    if(q('#countdown-number').textContent!==number)q('#countdown-number').textContent=number;
    if(q('#countdown-caption').textContent!==caption)q('#countdown-caption').textContent=caption;
    q('#guide-controls').hidden=view.coaching?.cameraView!=='front';
    for(const el of root.querySelectorAll<HTMLInputElement|HTMLButtonElement>('#guide-controls input,#lock-guide'))el.disabled=!!view.coaching?.guideLocked;
    q('#lock-guide').textContent=view.coaching?.guideLocked?'Guide locked':'Lock guide & start set';
    q('#target-status').textContent = view.coaching?.measurementMode==='arm-path' ? `ARM PATH ONLY · ${view.coaching.guideLocked?'GUIDE LOCKED':'POSITION THE GUIDE, THEN LOCK'} · ${view.coaching.armed?'ARMED':'ALIGN WITH UPPER TARGET'}` : view.coaching ? `${view.coaching.angleSpace === 'world' ? 'Estimated 3D' : 'Projected 2D'} · depth ≤ ${view.coaching.bottomDeg}° (±8° tolerance) → lockout near ${view.coaching.topDeg}° · ${view.coaching.armed ? view.coaching.depthReached ? 'DEPTH REACHED — PUSH UP' : 'ARMED' : 'HOLD TOP TO ARM'}` : 'Waiting for measurements';
    if(view.coaching?.preparation && view.coaching.preparation!=='active')q('#target-status').textContent=view.coaching.preparation==='countdown'?`BEGIN IN ${view.coaching.countdownSeconds}`:'GET INTO POSITION · COUNTING HAS NOT STARTED';
    q('#phase').textContent = PHASE_NAMES[view.phase] ?? view.phase;
    q('#elbow').textContent = formatDegrees(view.elbowDeg);
    for (const key of CHECK_KEYS) {
      const label = statusLabel(view.checks[key], view.enabledChecks[key]);
      if(key==='depth'&&view.checks.depth==='unknown'&&view.coaching?.armed)label.text='In progress';
      const r = liveRows[key];
      r.li.dataset.tone = label.tone;
      r.icon.textContent = label.icon;
      r.text.textContent = label.text;
    }
    const cue = q('#cue');
    cue.textContent = view.cue ?? 'Cues appear here when a checked position needs attention.';
    cue.classList.toggle('muted', !view.cue);
    video.style.visibility = frame?.source === 'camera' ? 'visible' : 'hidden';
    drawOverlay(canvas, frame, view);
  }

  function renderSummary(view: SessionView) {
    q('#sum-source').textContent = lastFrame
      ? `Source: ${sourceLabel(lastFrame)}${lastFrame.source === 'mock' ? ' - results below are from synthetic input' : ''}`
      : '';
    q('#sum-total').textContent = `${formatCount(view.totalAttempts ?? (view.completed+view.incomplete+view.unassessed))} rep attempts recorded — including partial reps and tracking-interrupted attempts`;
    q('#sum-grade').textContent = view.formScore == null ? 'No reliable overall form estimate. Your effort is still recorded.' : `Estimated form score: ${view.formScore}/100 · ${view.reps.filter(r=>r.feedback?.score!=null).length} graded attempts · coaching feedback, not a safety rating`;
    const tips=q('#sum-tips');tips.replaceChildren();for(const text of [...new Set(view.suggestions?.length?view.suggestions:[view.reps.length&&view.reps.some(r=>Object.values(r.checks).includes('pass'))?'No form faults were detected in the checks the camera could assess.':'No form corrections are available yet. Keep your whole side in view so the camera can check your next attempt.'])]){const li=document.createElement('li');li.textContent=text;tips.append(li);}
    q('#sum-completed').textContent = formatCount(view.completed);
    q('#sum-incomplete').textContent = formatCount(view.incomplete);
    q('#sum-unassessed').textContent = formatCount(view.unassessed);
    for (const key of CHECK_KEYS) {
      const t = tallyCheck(view.reps, key, view.enabledChecks[key]);
      const r = summaryRows[key];
      r.li.dataset.tone = !t.enabled || t.assessed === 0 ? 'neutral' : t.fail > 0 ? 'fail' : 'pass';
      r.icon.textContent = !t.enabled ? '–' : t.assessed === 0 ? '?' : t.fail > 0 ? '✕' : '✓';
      r.text.textContent = t.text;
    }
    const anyEnabled = CHECK_KEYS.some(k => view.enabledChecks[k]);
    q('#sum-time').textContent = anyEnabled
      ? `Active ${formatSeconds(view.elapsedMs)} · every enabled check was assessable for ${formatSeconds(view.assessableMs)}`
      : `Active ${formatSeconds(view.elapsedMs)} · no form checks are enabled in this version yet`;
    const sumCue = q('#sum-cue');
    sumCue.textContent = '';
    sumCue.hidden = true;


  }

  renderSetup(lastView);

  return {
    video,
    bind(a) { actions = a; },
    render(frame, view) {
      // Count frames only while a set runs: main's reset() re-renders the old frame
      // after a set, which must not send "Back to setup" to the summary again.
      if (frame && running) { framesThisRun++; lastFrame = frame; }
      lastView = view;
      renderSetup(view);
      if (current === 'live' || running) renderLive(frame, view);
      if (current === 'summary') renderSummary(view);
    },
    setStatus(message) { q('#status').textContent = message; },
    setRunning(next) {
      running = next;
      root.querySelector('.app')?.classList.toggle('camera-layout',next);
      for(const control of root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.camera-options input,.camera-options select'))control.disabled=next;
      btn.camera.disabled = next;
      btn.mock.disabled = next;
      btn.again.disabled = next;
      btn.stop.disabled = !next;     // Stop stays usable during startup
      if (next) {
        q<HTMLInputElement>('#guide-scale').value='1';q<HTMLInputElement>('#guide-x').value='0';q<HTMLInputElement>('#guide-y').value='0';
        framesThisRun = 0;
        lastFrame = null;
        show('live');
        renderLive(null, lastView);
      } else {
        show(framesThisRun > 0 ? 'summary' : 'setup');   // failed startup returns to setup
      }
    },
    destroy() {
      demo.destroy();
      actions = null;
      root.replaceChildren();
    },
  };
}
