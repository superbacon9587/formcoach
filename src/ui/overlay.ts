/**
 * Camera overlay (Person C).
 *
 * Geometry: the canvas backing store is exactly the source frame size and is
 * fitted with CSS `object-fit: contain`, the same as the <video>, so both share
 * one content rectangle and joints are drawn directly in intrinsic source pixels.
 * We never mix this with manual offset/scale maths, and we do not mirror.
 *
 * Colours only reflect B's reported check state. The skeleton itself is always
 * neutral so it never implies whole-body correctness.
 */
import type { JointName, Point, PoseFrame, SessionView } from '../shared/contracts';
import { formatDegrees, statusLabel, type Tone } from './labels';

const MIN_VISIBILITY = 0.6;

export const TONE_COLORS: Record<Tone, string> = {
  neutral: '#8a96a8',
  pass: '#3fd49b',
  fail: '#ff6b6e',
};
const SKELETON = '#d3dceb';
const JOINT = '#f1f5fb';
const ANGLE = '#9cc2ff';

const BONES: readonly (readonly [JointName, JointName])[] = [
  ['shoulder', 'elbow'], ['elbow', 'wrist'], ['shoulder', 'hip'], ['hip', 'knee'], ['knee', 'ankle'],
];

/** A point we are willing to draw as a measurement. Absent/low-visibility = not drawn. */
function usable(p: Point | undefined): p is Point {
  return !!p && p.visibility >= MIN_VISIBILITY && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, color: string) {
  ctx.font = `600 ${Math.round(15 * u)}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 16 * u, h = 24 * u;
  const left = Math.min(Math.max(x - w / 2, 4 * u), ctx.canvas.width - w - 4 * u);
  const top = Math.min(Math.max(y - h / 2, 4 * u), ctx.canvas.height - h - 4 * u);
  ctx.fillStyle = 'rgba(10, 17, 28, 0.82)';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 6 * u);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 8 * u, top + h / 2 + u);
}

export function drawOverlay(canvas: HTMLCanvasElement, frame: PoseFrame | null, view: SessionView) {
  const w = frame?.width ?? 640, h = frame?.height ?? 360;
  if (canvas.width !== w) canvas.width = w;          // only reallocate when size changes
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, w, h);
  if (!frame || frame.tracking === 'lost') return;     // stage shows a "pose lost" banner instead

  const j = frame.joints;
  const u = Math.max(frame.width, 1) / 640;            // scale strokes/text with source size
  ctx.lineCap = 'round';

  // 1. Target body line: dashed shoulder -> ankle, coloured by B's alignment state.
  const s = j.shoulder, a = j.ankle;
  const align = statusLabel(view.checks.alignment, view.enabledChecks.alignment);
  const alignColor = TONE_COLORS[align.tone];
  if (usable(s) && usable(a)) {
    ctx.strokeStyle = alignColor;
    ctx.lineWidth = 3 * u;
    ctx.setLineDash([12 * u, 9 * u]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Actual skeleton: solid and neutral.
  ctx.strokeStyle = SKELETON;
  ctx.lineWidth = 5 * u;
  for (const [p, q] of BONES) {
    const P = j[p], Q = j[q];
    if (!usable(P) || !usable(Q)) continue;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(Q.x, Q.y);
    ctx.stroke();
  }

  // 3. Hip marker when B reports a sustained alignment deviation.
  const hip = j.hip;
  if (align.tone === 'fail' && usable(hip)) {
    ctx.strokeStyle = alignColor;
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(hip.x, hip.y, 13 * u, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Optional elbow arc showing B's elbow metric (no measurement here).
  const sh = j.shoulder, el = j.elbow, wr = j.wrist;
  if (view.elbowDeg !== null && usable(sh) && usable(el) && usable(wr)) {
    const a1 = Math.atan2(sh.y - el.y, sh.x - el.x);
    let diff = Math.atan2(wr.y - el.y, wr.x - el.x) - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    ctx.strokeStyle = ANGLE;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(el.x, el.y, 24 * u, a1, a1 + diff, diff < 0);
    ctx.stroke();
    const mid = a1 + diff / 2;
    pill(ctx, `elbow ${formatDegrees(view.elbowDeg)}`,
      el.x - Math.cos(mid) * 52 * u, el.y - Math.sin(mid) * 52 * u, u, ANGLE);
  }

  // 5. Joints.
  ctx.fillStyle = JOINT;
  for (const p of Object.values(j)) {
    if (!usable(p)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Label the target line with text + icon so colour is never the only signal.
  if (usable(s) && usable(a)) {
    pill(ctx, `${align.icon} Body line: ${align.text}`, (s.x + a.x) / 2, Math.min(s.y, a.y) - 34 * u,
      u, alignColor);
  }
}
