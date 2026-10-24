import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame, SourceOptions, StopSource } from '../shared/contracts';
import { createSideSelector } from './landmarks';

/** A bounded wait also disposes resources that arrive after a startup timeout. */
async function bounded<T>(pending: Promise<T>, label: string, dispose?: (value: T) => void): Promise<T> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending.then(value => { if (expired) dispose?.(value); return value; }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error(`${label} timed out. Please retry.`)); }, 30_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function startCameraSource(options: SourceOptions): Promise<StopSource> {
  const { video, onFrame, onStatus } = options;
  let stream: MediaStream | undefined;
  let pose: PoseLandmarker | undefined;
  let stopped = false;
  let raf: number | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let lastVideoTime = -1;
  let lastFresh = performance.now();
  let lastTimestamp = -1;
  let stale = false;
  let lastTracking: PoseFrame['tracking'] | undefined;
  const selector = createSideSelector();
  const stop: StopSource = () => {
    if (stopped) return;
    stopped = true;
    if (raf !== undefined) cancelAnimationFrame(raf);
    clearInterval(watchdog);
    stream?.getTracks().forEach(track => track.stop());
    if (stream && video.srcObject === stream) {
      video.pause();
      video.srcObject = null;
    }
    pose?.close();
    pose = undefined;
  };
  const timestamp = () => (lastTimestamp = Math.max(performance.now(), lastTimestamp + 0.001));
  const emit = (tracking: Pick<PoseFrame, 'joints' | 'side' | 'tracking'>, time = timestamp()) => {
    onFrame({ timestampMs: time, width: video.videoWidth, height: video.videoHeight,
      source: 'camera', ...tracking });
    if (tracking.tracking !== lastTracking) {
      lastTracking = tracking.tracking;
      onStatus(tracking.tracking === 'lost' ? 'Pose lost. Keep your full body visible in side view.' :
        `Live camera: ${tracking.side} side, ${tracking.tracking} tracking.`);
    }
  };
  const lost = () => { selector.reset(); emit({ joints: {}, side: null, tracking: 'lost' }); };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost and a supported browser.');
    onStatus('Requesting camera permission…');
    stream = await bounded(navigator.mediaDevices.getUserMedia({ audio: false,
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } }),
    'Camera permission', late => late.getTracks().forEach(track => track.stop()));
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await bounded(video.play(), 'Camera playback');
    if (!video.videoWidth || !video.videoHeight) throw new Error('Camera has no video dimensions. Check the device and retry.');
    onStatus('Loading local pose model and WASM…');
    const base = import.meta.env.BASE_URL;
    const vision = await bounded(FilesetResolver.forVisionTasks(`${base}wasm`), 'WASM loading');
    const create = (delegate: 'GPU' | 'CPU') => bounded(PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${base}models/pose_landmarker_lite.task`, delegate },
      runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
    }), `${delegate} pose initialization`, late => late.close());
    try { pose = await create('GPU'); }
    catch {
      onStatus('GPU initialization failed. Retrying pose model on CPU…');
      pose = await create('CPU');
    }
    lastFresh = performance.now();
    onStatus('Camera ready. Keep your full body visible in side view.');
    const tick = () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          lastFresh = performance.now();
          stale = false;
          const time = timestamp();
          const result = pose!.detectForVideo(video, time);
          try { emit(selector.select(result.landmarks[0] ?? [], video.videoWidth, video.videoHeight), time); }
          finally { result.close(); }
        }
        if (!stopped) raf = requestAnimationFrame(tick);
      } catch (error) {
        try { lost(); } finally { stop(); }
        onStatus(`Camera tracking stopped: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    watchdog = setInterval(() => {
      if (stopped || stale || performance.now() - lastFresh < 1500) return;
      stale = true;
      try {
        lost();
        onStatus('Camera frames stalled. Check the camera or return to this tab.');
      } catch { stop(); }
    }, 250);
    raf = requestAnimationFrame(tick);
    return stop;
  } catch (error) {
    stop();
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Unable to start camera tracking: ${detail}. Check camera permission and local assets (npm run assets).`;
    onStatus(message);
    throw new Error(message, { cause: error });
  }
}
