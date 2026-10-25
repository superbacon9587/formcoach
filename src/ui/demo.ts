import { drawFrontDemo } from './front-demo';
/**
 * Animated pushup demonstration (Person C) - original Canvas mannequin, side view.
 *
 * Independent from the camera overlay and from scoring. Illustration only:
 * never use this animation as measurement ground truth or to justify thresholds.
 *
 * Rig:
 *  - Toes and hands stay planted on the floor.
 *  - The body (toe -> ankle -> knee -> hip -> shoulder -> head) moves as one rigid
 *    plank pivoting about the toes, so legs and torso never stretch.
 *  - The elbow is solved with 2-link inverse kinematics from the fixed wrist and
 *    the moving shoulder, so upper arm and forearm keep fixed lengths.
 */

export interface Vec { x: number; y: number }

export interface PushupPose {
  toe: Vec; ankle: Vec; knee: Vec; hip: Vec; shoulder: Vec;
  elbow: Vec; wrist: Vec; hand: Vec; neck: Vec; head: Vec;
  /** 0 = top (arms extended), 1 = bottom */
  depth: number;
}

export interface PushupDemo {
  readonly root: HTMLElement;
  setView(view:'front'|'side',bottom?:number,top?:number): void;
  play(): void;
  pause(): void;
  replay(): void;
  isPlaying(): boolean;
  /** Visible view -> resume (unless the user paused or prefers reduced motion); hidden -> pause. */
  setActive(active: boolean): void;
  destroy(): void;
}

// --------------------------------------------------------------------- rig ---
// Model units ~ metres, y points UP, floor at y = 0, person faces +x.
export const RIG = {
  toeToAnkle: 0.12,
  toeToKnee: 0.58,
  toeToHip: 1.02,
  toeToShoulder: 1.45,
  upperArm: 0.30,
  forearm: 0.27,
  handLen: 0.08,
  wristX: 1.35,           // hand roughly under the shoulder at the top
  shoulderTopY: 0.585,    // arms nearly locked out (~165° elbow)
  shoulderBottomY: 0.30,  // chest about a fist off the floor
  headRadius: 0.105,
} as const;

const PERIOD_MS = 4000;   // one full down/up cycle
const HOLD_TOP = 0.12;    // fraction of the cycle paused at the top
const HOLD_BOTTOM = 0.06; // brief pause at the bottom

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const len = (a: Vec): number => Math.hypot(a.x, a.y);
const ease = (u: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

/** Map time within one cycle (0..1) to depth (0 = top, 1 = bottom), with holds. */
export function cycleDepth(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const move = (1 - HOLD_TOP - HOLD_BOTTOM) / 2;
  if (p < HOLD_TOP) return 0;
  if (p < HOLD_TOP + move) return ease((p - HOLD_TOP) / move);
  if (p < HOLD_TOP + move + HOLD_BOTTOM) return 1;
  return 1 - ease((p - HOLD_TOP - move - HOLD_BOTTOM) / move);
}

/** Two-link IK: elbow position from shoulder, wrist and fixed segment lengths. */
function solveElbow(shoulder: Vec, wrist: Vec, upper: number, fore: number): Vec {
  const d0 = sub(wrist, shoulder);
  const d = Math.min(Math.max(len(d0), Math.abs(upper - fore) + 1e-6), upper + fore - 1e-6);
  const u = mul(d0, 1 / (len(d0) || 1));
  const along = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(upper * upper - along * along, 0));
  const base = add(shoulder, mul(u, along));
  const c1 = add(base, { x: -u.y * h, y: u.x * h });
  const c2 = add(base, { x: u.y * h, y: -u.x * h });
  // In a standard pushup seen from the side the elbow points back, toward the feet.
  return c1.x < c2.x ? c1 : c2;
}

/** Full pose for a given depth (0 = top, 1 = bottom). Exported for tests. */
export function pushupPose(depth: number): PushupPose {
  const d = Math.min(1, Math.max(0, depth));
  const sy = RIG.shoulderTopY + (RIG.shoulderBottomY - RIG.shoulderTopY) * d;
  const theta = Math.asin(sy / RIG.toeToShoulder);   // plank angle above the floor
  const dir: Vec = { x: Math.cos(theta), y: Math.sin(theta) };
  const up: Vec = { x: -dir.y, y: dir.x };
  const at = (k: number): Vec => mul(dir, k);
  const shoulder = at(RIG.toeToShoulder);
  const wrist: Vec = { x: RIG.wristX, y: 0.02 };
  return {
    toe: { x: 0, y: 0 },
    ankle: add(at(RIG.toeToAnkle), mul(up, 0.04)),
    knee: at(RIG.toeToKnee),
    hip: at(RIG.toeToHip),
    shoulder,
    elbow: solveElbow(shoulder, wrist, RIG.upperArm, RIG.forearm),
    wrist,
    hand: { x: RIG.wristX + RIG.handLen, y: 0 },
    neck: add(at(RIG.toeToShoulder + 0.07), mul(up, 0.03)),
    head: add(at(RIG.toeToShoulder + 0.07 + RIG.headRadius + 0.02), mul(up, 0.05)),
    depth: d,
  };
}

// ----------------------------------------------------------------- drawing ---
type Palette = { body: string; limbFar: string; floor: string };

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  // Neutral on purpose: green/red/gray are reserved for assessment states.
  return {
    body: v('--demo-body', '#7f93ad'),
    limbFar: v('--demo-limb-far', '#4d5f76'),
    floor: v('--demo-floor', '#5d6b7e'),
  };
}

function drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, pose: PushupPose, pal: Palette) {
  ctx.clearRect(0, 0, w, h);
  const minX = -0.15, maxX = 1.75, maxY = 0.95;
  const margin = Math.max(8, Math.min(w, h) * 0.06);
  const scale = Math.min((w - 2 * margin) / (maxX - minX), (h - 2 * margin) / maxY);
  const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
  const floorY = h - margin;
  const P = (p: Vec) => ({ x: ox + p.x * scale, y: floorY - p.y * scale });
  const seg = (a: Vec, b: Vec, width: number, color: string) => {
    const A = P(a), B = P(b);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  };

  ctx.strokeStyle = pal.floor;
  ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.beginPath();
  ctx.moveTo(P({ x: minX + 0.05, y: 0 }).x, floorY);
  ctx.lineTo(P({ x: maxX - 0.05, y: 0 }).x, floorY);
  ctx.stroke();

  const off: Vec = { x: 0.03, y: 0 };               // far-side arm, slightly offset
  seg(add(pose.shoulder, off), add(pose.elbow, off), 0.055, pal.limbFar);
  seg(add(pose.elbow, off), add(pose.wrist, off), 0.05, pal.limbFar);

  seg(pose.toe, pose.ankle, 0.05, pal.body);
  seg(pose.ankle, pose.knee, 0.075, pal.body);
  seg(pose.knee, pose.hip, 0.095, pal.body);
  seg(pose.hip, pose.shoulder, 0.15, pal.body);
  seg(pose.shoulder, pose.neck, 0.07, pal.body);
  seg(pose.shoulder, pose.elbow, 0.06, pal.body);
  seg(pose.elbow, pose.wrist, 0.055, pal.body);
  seg(pose.wrist, pose.hand, 0.04, pal.body);

  const H = P(pose.head);
  ctx.fillStyle = pal.body;
  ctx.beginPath();
  ctx.arc(H.x, H.y, RIG.headRadius * scale, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------- mount ---
export function mountPushupDemo(container: HTMLElement): PushupDemo {
  const root = document.createElement('figure');
  root.className = 'demo';

  const canvas = document.createElement('canvas');
  canvas.className = 'demo-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'Animated front view of a standard floor pushup. The body stays in one straight line from shoulders to ankles while the elbows bend and straighten.');

  const caption = document.createElement('figcaption');
  const title = document.createElement('span');
  title.textContent = 'Pushup demonstration · front view';
  const note = document.createElement('small');
  note.textContent = 'Illustration only, not a measurement';
  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  const replayBtn = document.createElement('button');
  replayBtn.type = 'button';
  replayBtn.textContent = 'Replay';
  const controls = document.createElement('span');
  controls.className = 'demo-controls';
  controls.append(playBtn, replayBtn);
  caption.append(title, note, controls);

  root.append(canvas, caption);
  container.append(root);

  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rafId: number | null = null;
  let playing = false;
  let active = true;
  let userPaused = reduceMotion;  // reduced motion: start paused until the user presses Play
  let elapsed = 0;
  let lastTs: number | null = null;
  let cssW = 0, cssH = 0;
  let palette = readPalette(root);
  let destroyed = false;
  let cameraView:'front'|'side'='front',bottomTarget=90,topTarget=160;

  const render = () => {
    if (!ctx || cssW === 0 || cssH === 0) return;
    const depth = !playing && elapsed === 0 && reduceMotion ? 0.5 : cycleDepth(elapsed / PERIOD_MS);
    if(cameraView==='front')drawFrontDemo(ctx,cssW,cssH,depth,bottomTarget,topTarget);
    else drawPose(ctx, cssW, cssH, pushupPose(depth), palette);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;   // hidden view
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);            // one consistent DPR transform
    palette = readPalette(root);
    render();
  };

  const tick = (ts: number) => {
    rafId = null;
    if (!playing || destroyed) return;
    if (lastTs !== null) elapsed += Math.min(ts - lastTs, 100);   // no jump after tab switch
    lastTs = ts;
    render();
    rafId = requestAnimationFrame(tick);
  };

  const updateButton = () => {
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(playing));
  };

  const startLoop = () => {
    if (destroyed || playing) return;
    playing = true;
    lastTs = null;
    if (rafId === null) rafId = requestAnimationFrame(tick);       // never two loops
    updateButton();
  };

  const stopLoop = () => {
    playing = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    updateButton();
    render();
  };

  const play = () => { userPaused = false; if (active) startLoop(); };
  const pause = () => { userPaused = true; stopLoop(); };
  const replay = () => { elapsed = 0; lastTs = null; render(); play(); };
  const onPlayClick = () => (playing ? pause() : play());

  playBtn.addEventListener('click', onPlayClick);
  replayBtn.addEventListener('click', replay);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  updateButton();
  if (!userPaused) startLoop();

  return {
    root,
    setView(next,bottom=90,top=160){cameraView=next;bottomTarget=bottom;topTarget=top;title.textContent=`Pushup demonstration · ${next} view`;canvas.setAttribute('aria-label',`Animated ${next} view of floor pushup arm movement.`);render();},
    play,
    pause,
    replay,
    isPlaying: () => playing,
    setActive(next: boolean) {
      active = next;
      if (!next) stopLoop();
      else {
        resize();
        if (!userPaused) startLoop();
      }
    },
    destroy() {
      destroyed = true;
      stopLoop();
      playBtn.removeEventListener('click', onPlayClick);
      replayBtn.removeEventListener('click', replay);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      root.remove();
    },
  };
}
