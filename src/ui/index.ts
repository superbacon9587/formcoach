import type { CoachUI, PoseFrame, SessionView } from '../shared/contracts';
import { emptyView } from '../shared/defaults';
import { mountPushupDemo } from './demo';
import {
  CHECK_HELP, CHECK_KEYS, CHECK_NAMES, OUTCOME_NAMES, PHASE_NAMES,
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
      <ol class="steps">
        <li><strong>Side view.</strong> Put the camera beside you, about torso height, pointing at your side.</li>
        <li><strong>Whole body in frame.</strong> Hands through ankles must stay visible at the top and the bottom of each rep.</li>
        <li><strong>No steep angles.</strong> Avoid a laptop looking down from above; raise or move the camera instead.</li>
        <li><strong>Standard floor pushup.</strong> Hands under shoulders, body straight, like the demonstration.</li>
      </ol>
      <h3>What this version checks</h3>
      <ul class="checklist" id="setup-checks"></ul>
      <div class="actions">
        <button id="camera" class="primary" type="button">Start live camera</button>
        <button id="mock" type="button">Mock preview <span class="muted">(synthetic)</span></button>
      </div>
    </div>
  </section>

  <section id="view-live" class="view live" hidden aria-label="Live set">
    <div class="stage">
      <video muted playsinline></video>
      <canvas aria-hidden="true"></canvas>
      <span id="source" class="badge">NO INPUT</span>
      <span id="tracking" class="tracking" data-tone="neutral"></span>
    </div>
    <aside class="panel">
      <div class="count"><strong id="count">0</strong><span>completed reps</span></div>
      <p class="phase">Phase: <span id="phase">Ready</span> · Elbow <span id="elbow">—</span></p>
      <ul class="chips" id="live-checks" aria-label="Current checks"></ul>
      <p id="cue" class="cue" aria-live="polite"></p>
      <button id="stop" class="stop" type="button" disabled>Stop set</button>
    </aside>
  </section>

  <section id="view-summary" class="view summary" hidden aria-labelledby="summary-title">
    <h2 id="summary-title">Set summary</h2>
    <p id="sum-source" class="muted"></p>
    <div class="totals">
      <article><strong id="sum-completed">0</strong><span>Completed</span></article>
      <article><strong id="sum-incomplete">0</strong><span>Incomplete</span></article>
      <article><strong id="sum-unassessed">0</strong><span>Not assessable</span></article>
    </div>
    <h3>Form checks</h3>
    <ul class="tallies" id="sum-checks"></ul>
    <p id="sum-time" class="muted"></p>
    <p id="sum-cue" class="cue"></p>
    <h3>Rep by rep</h3>
    <p class="muted">A completed rep and a passing rep are different: a completed rep can still need adjusting.</p>
    <div class="table-wrap" id="sum-reps"></div>
    <div class="actions">
      <button id="again" class="primary" type="button">Repeat set</button>
      <button id="reset" type="button">Back to setup</button>
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

  const start = (mode: 'mock' | 'camera') => { lastMode = mode; void actions?.start(mode); };
  btn.camera.onclick = () => start('camera');
  btn.mock.onclick = () => start('mock');
  btn.again.onclick = () => start(lastMode);
  btn.stop.onclick = () => actions?.stop();
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
    q('#count').textContent = formatCount(view.completed);
    q('#phase').textContent = PHASE_NAMES[view.phase] ?? view.phase;
    q('#elbow').textContent = formatDegrees(view.elbowDeg);
    for (const key of CHECK_KEYS) {
      const label = statusLabel(view.checks[key], view.enabledChecks[key]);
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
    sumCue.textContent = view.cue ? `Next time: ${view.cue}` : '';
    sumCue.hidden = !view.cue;

    const wrap = q('#sum-reps');
    wrap.replaceChildren();
    if (view.reps.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No reps were recorded in this set.';
      wrap.append(p);
      return;
    }
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const h of ['#', 'Outcome', ...CHECK_KEYS.map(k => CHECK_NAMES[k]), 'Lowest elbow']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      head.append(th);
    }
    const body = table.createTBody();
    for (const rep of view.reps) {
      const row = body.insertRow();
      row.insertCell().textContent = String(rep.id);
      row.insertCell().textContent = OUTCOME_NAMES[rep.outcome] ?? rep.outcome;
      for (const key of CHECK_KEYS) {
        const label = statusLabel(rep.checks[key], view.enabledChecks[key]);
        const cell = row.insertCell();
        cell.dataset.tone = label.tone;
        cell.textContent = `${label.icon} ${label.text}`;
      }
      row.insertCell().textContent = formatDegrees(rep.minElbowDeg);
    }
    wrap.append(table);
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
      btn.camera.disabled = next;
      btn.mock.disabled = next;
      btn.again.disabled = next;
      btn.stop.disabled = !next;     // Stop stays usable during startup
      if (next) {
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
