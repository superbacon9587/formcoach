import type { PoseFrame, SessionView } from '../shared/contracts';

/** Displays B's measurements; never infers form, confidence scores or reps. */
export function createMeasurementsPanel() {
  const element = document.createElement('section');
  element.className = 'measurements';
  element.setAttribute('aria-labelledby', 'measurements-title');
  element.innerHTML = `
    <div class="measurements-heading">
      <div><span class="measurements-label">PERSON B · MEASUREMENTS</span>
      <h2 id="measurements-title">Arm position</h2></div>
      <span class="measurement-source">NO INPUT</span>
    </div>
    <div class="measurements-grid">
      <div><span class="measurement-caption">Elbow bend</span>
        <strong class="measurement-angle">—</strong>
        <span class="measurement-side">Waiting for joint data</span></div>
      <div class="measurement-detail"><span class="measurement-caption">Measurement status</span>
        <strong class="measurement-status">Waiting</strong>
        <p class="measurement-help">Start mock preview or the camera to see measurements.</p></div>
    </div>
    <p class="measurement-note">Angle as seen by the camera. Pushup depth and form are not assessed yet.</p>`;
  const angle = element.querySelector<HTMLElement>('.measurement-angle')!;
  const side = element.querySelector<HTMLElement>('.measurement-side')!;
  const source = element.querySelector<HTMLElement>('.measurement-source')!;
  const status = element.querySelector<HTMLElement>('.measurement-status')!;
  const help = element.querySelector<HTMLElement>('.measurement-help')!;
  const note = element.querySelector<HTMLElement>('.measurement-note')!;
  return {
    element,
    render(frame: PoseFrame | null, view: SessionView) {
      const measurable = frame !== null && view.elbowDeg !== null && Number.isFinite(view.elbowDeg);
      angle.textContent = measurable ? `${Math.round(view.elbowDeg!)}°` : '—';
      side.textContent = frame?.side ? `${frame.side === 'left' ? 'Left' : 'Right'} arm supplied by tracking` : 'Waiting for joint data';
      source.textContent = !frame ? 'NO INPUT' : frame.source === 'mock' ? 'SYNTHETIC INPUT' : 'CAMERA INPUT';
      status.textContent = !frame ? 'Waiting' : measurable ? 'Measurable' : 'Uncertain';
      help.textContent = !frame ? 'Start mock preview or the camera to see measurements.'
        : measurable ? 'Shoulder, elbow and wrist are available. This is a measurement, not a form score.'
        : 'Keep your shoulder, elbow and wrist in view. Unreliable measurements stay blank.';
      note.textContent = view.enabledChecks.alignment
        ? 'Angle as seen by the camera. Form feedback currently supports side-view pushups.'
        : 'Angle as seen by the camera. Pushup depth and form are not assessed yet.';
    }
  };
}
