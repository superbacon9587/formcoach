# Person A — repository, camera, tracking and integration

**Your goal:** deliver trustworthy live PoseFrames, integrate the three branches,
and put the app on a working HTTPS link. You do not implement B's assessment or
C's UI. Eight-hour project; first camera handoff within one hour.

## 0. Square zero: tools and repo
1. Read docs/BOOTSTRAP.md. Install Node 24 LTS, Git, editor; sign in to GitHub.
2. You alone create/initialize the repo, invite teammates, push the initial main,
   and confirm checks. Do not run npm create vite again: this starter is ready.
3. Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md.
4. In your project terminal: `git switch -c feature/a-camera` after bootstrap.
5. Run `npm ci`, `npm run check`, `npm run dev`. Open the printed address; Mock
   preview should move. The camera throws a clear TODO until you implement it.
6. Keep one terminal for Vite and another for Git/tests. Ctrl+C stops a process.

## 1. Your exact writable files
- src/tracking/** and tests/tracking/**.
- scripts/setup-assets.mjs, package.json/package-lock.json, vite.config.ts,
  tsconfig.json, .github/workflows/ci.yml, THIRD_PARTY_NOTICES.md.
- docs/PERSON_A.md and docs/status/A.md.
- All other files are read-only during parallel work. Shared main/contracts can
  change only after team agreement, in a separate integration PR. Ownership script
  correctly flags those exceptions; document approval instead of bypassing it.
- No dependency changes unless necessary. B/C must never install alternatives.

## 2. Give your AI this prompt FIRST
```text
You are Person A on FormCoach, an eight-hour three-student pushup hackathon.
Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md, docs/PERSON_A.md and
src/shared/contracts.ts before editing. Stay in A-owned paths listed in AGENTS.md.
Implement startCameraSource(options): Promise<StopSource> in src/tracking/index.ts.
Preserve the exact API. Emit unmirrored intrinsic-pixel landmarks, increasing
millisecond timestamps, side and tracking status. Emit explicit lost frames.
Do not calculate form faults/reps or rewrite UI, shared contracts, fixtures or
main.ts. Do not replace libraries or regenerate others' work. First tell me the
files you will change; then implement camera acquisition, MediaPipe and cleanup.
Use npm run check. Report mock vs actual-device testing separately. If a shared
change is needed, propose it and wait for the team's agreement on that change.
```

## 3. Download assets (10 minutes)
```sh
npm ci
npm run assets
```
This copies WASM from the installed package and downloads the official Lite model.
Both generated asset directories are ignored. Each developer who needs live camera
runs this locally; CI checks do not need assets because they do not infer poses.
Do not copy assets from another package version.

Expected local files:
- public/models/pose_landmarker_lite.task
- public/wasm/* (matching installed package)

If download fails, use the official model links in the MediaPipe docs; save to the
same path. Do not substitute a random model or a vision-language checkpoint.
Record asset source/version/license in THIRD_PARTY_NOTICES.md.

## 4. Implement the source in small pieces (first hour)
Internals may be camera.ts, model.ts and landmarks.ts inside src/tracking/.
Preserve src/tracking/index.ts as the public entry point.

### 4a. Camera first
- Request getUserMedia only after the already-wired Live camera click.
- Prefer a modest input size such as 640x480. Exact returned dimensions may differ.
- Set video.srcObject; ensure muted/playsInline; await metadata and play().
- Return a stopper that cancels callbacks and stops every stream track.
- If any later initialization fails, clean up tracks and references before throwing.
- Do not silently show mock points on failure; onStatus should explain the failure.

### 4b. Create MediaPipe
Use the installed package, not a CDN @latest:
```ts
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
const base = import.meta.env.BASE_URL;
const vision = await FilesetResolver.forVisionTasks(`${base}wasm`);
const pose = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: `${base}models/pose_landmarker_lite.task`,
    delegate: 'GPU'
  },
  runningMode: 'VIDEO', numPoses: 1
});
```
Use BASE_URL for model/WASM so GitHub Pages subpaths work. On GPU initialization
failure, retry with CPU. Keep model loading status visible. Never loosen checks
just because the model loads slowly. Use the package's actual types/signatures.

### 4c. Fresh frames and coordinates
- requestVideoFrameCallback is useful; requestAnimationFrame + currentTime guard
  is sufficient. Process a decoded camera frame only once.
- detectForVideo is synchronous. No parallel inference queue. Skip frames to keep
  UI responsive; a worker is optional, not the first-hour task.
- Inference timestamp: increasing performance.now() milliseconds.
- Convert normalized x to x * video.videoWidth and y to y * video.videoHeight.
- Preserve visibility. Map visible-side joints:
  left: shoulder11, elbow13, wrist15, hip23, knee25, ankle27;
  right: shoulder12, elbow14, wrist16, hip24, knee26, ankle28.
- Choose visible side using a short stable window. Keep it locked while reliably
  tracked; on loss/reacquisition, reselect and tell B to restart the attempt.
  Emit lost before a side change so B cannot bridge sides as one rep.
- Emit a PoseFrame through options.onFrame. Do not calculate angles or faults here.
- For no pose, emit joints:{}, side:null, tracking:'lost'. Partial points are allowed
  with tracking:'partial'; never fill missing joints with stale ones or zeros.
- Add a freshness watchdog: if camera frames stop arriving (tab/device stall), emit
  unknown/lost status instead of leaving a green overlay. Reset it on Stop.

### 4d. Cleanup and repeated starts
Stop must cancel frame callback/RAF, clear watchdog, stop camera tracks, pause and
clear srcObject, close pose when safe, and guard against late callbacks.
Make cleanup safe if called twice. Test Stop during model loading; main will call
the stopper when pending startup resolves. Reject errors cleanly with no leaked
camera; browser camera light should turn off after Stop.

## 5. First handoff, before polishing
- npm run check passes.
- A live camera sample reaches C's skeleton without contract changes.
- Missing pose emits an explicit empty frame.
- Report video dimensions, selected side and observed processed FPS to B/C.
- Push a small PR using the common workflow. Do not wait for every edge case.

## 6. Integrate B/C safely (hour 2 onward)
1. Review B/C PRs against their assigned folders and contract v1.
2. Merge only one at a time. Require tests/build; check semantic behavior locally.
3. After merge: pull main, npm ci, npm run assets if packages changed, npm run dev.
4. Verify camera -> B's view -> C's rendering -> Stop. Agree on a shared change only
   if the current contract is inadequate; apply via dedicated integration PR.
5. Announce merged PR and ask teammates to fetch/merge origin/main before next PR.
6. Do not resolve ownership failures by moving code between other people's folders.

## 7. Deploy early (by elapsed hour 3)
Pick one hosting route; do not build a backend.

### Fast manual static deploy
- Use a team-approved static HTTPS host that accepts dist (for example Netlify Drop).
- Run npm ci, npm run assets, npm run check. Confirm dist includes models and WASM.
- Upload dist, not the repo root. Open the HTTPS URL and test the actual camera.
- Repeat production build/upload after the final merge. A localhost success is not
  proof that deployment has the model assets or correct paths.

### GitHub Pages route (if already familiar)
- Repository Settings > Pages > Source: GitHub Actions (if available).
- Add a deployment workflow in your lane. It must checkout main, setup Node 24,
  npm ci, npm run assets, npm run check, configure Pages, upload dist with
  actions/upload-pages-artifact, then actions/deploy-pages with pages:write and
  id-token:write and the github-pages environment. Use current official examples.
- Keep vite base './' or configure the correct repository base. All asset paths
  must use import.meta.env.BASE_URL, not root-absolute /models on a project site.
- Test a cold load of the final Pages link. Skip this route if Actions/permissions
  consume more time than a manual static deployment.

## 8. Useful verification and failure cases
- Permission denied: readable retry. No camera: no fake success.
- Model path 404: check network tab, run assets, BASE_URL and case-sensitive filename.
- Jitter: confidence gate first, then mild smoothing. Do not smooth through loss.
- Coordinates stretched: source dimensions and letterboxing, not CSS clientWidth.
- Tracking at floor: improve framing; compare Full only if time and hardware allow.
- Hidden tab/Stop: no lingering timers or green status. Restart creates a clean session.
- Browser model integration needs real-device tests; the starter boundary test is
  only an API smoke test and does not establish inference accuracy.

## 9. Your Git commands for handoff
```sh
git status
npm run check
git fetch origin
npm run ownership -- A
git add src/tracking tests/tracking docs/status/A.md
# Add other A-owned config files explicitly ONLY if you changed them.
git commit -m "A: connect live pose tracking"
git push -u origin feature/a-camera
```
Create a PR to main. Review your own PR too; do not skip checks because you merge.
After squash merge, start your next branch from freshly pulled main.

## 10. Done and deadline
By hour 6 freeze features. Final two hours: camera on presentation laptop, cold-load
HTTPS test, no missing assets, no exposed recordings, backup screen recording,
submission. You own integration health, not all three students' implementation.

Official docs:
- https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- https://vite.dev/guide/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
