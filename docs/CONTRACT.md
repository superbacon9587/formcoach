# Frozen contract v1

Authoritative types: src/shared/contracts.ts. Read this alongside the types.

## Allowed imports
- tracking -> shared (and @mediapipe/tasks-vision). No analysis or UI imports.
- analysis -> shared. No DOM, video, UI, network, or MediaPipe imports.
- ui -> shared. No analysis or tracking implementation imports.
- main -> all three entry points plus mock fixtures. Main owns wiring only.

## Entry points that MUST stay stable
- A: `startCameraSource(options: SourceOptions): Promise<StopSource>` in src/tracking/index.ts.
- B: `createAnalyzer(): Analyzer` in src/analysis/index.ts.
- C: `mountUI(root: HTMLElement): CoachUI` in src/ui/index.ts.

Main already connects them. Each owner can add internal modules under their folder.
A camera source must clean up on startup failure, not just on normal Stop.
If Stop is pressed during startup, main invalidates that run and calls its stopper
as soon as startup resolves. A must reject hung initialization cleanly.

## Frame semantics
- x/y: unmirrored intrinsic source-video pixels. Never CSS coordinates.
- width/height: source dimensions. Different frames can have different dimensions.
- timestampMs: finite, monotonic milliseconds, one source session. Reset analysis
  before switching sources. Camera may use performance.now(); mock uses elapsed time.
- side: visible side locked for the current tracking segment; null if none.
- visibility: 0..1. Missing points are ABSENT, not (0,0).
- tracking valid means candidate required points are available, not "correct form".
  B still checks the specific joints for each rule.
- On lost pose, A EMITS a frame with joints:{} and tracking:'lost'. Silence would
  leave a stale green screen. Emit a freshness timeout if decoded frames stall.
- Mock is synthetic fixture input, not an animation reference or a live camera.

## Analyzer semantics
- update returns a complete SessionView; it must not mutate its input frame.
- Capture/check joints per rule. Null metrics mean unknown, never 0 or pass.
- All timestamps/timers use milliseconds, not frame counts.
- enabledChecks tells UI which checks actually exist. Off stays unknown.
- reset clears state, reps, timings, pending faults, and calibration.
- finish closes an active attempt once and is IDEMPOTENT when called repeatedly.
  This matters because main calls finish during resets as well as Stop.
- Only count a completed cycle after supported top -> down -> reversal -> up -> top.
  Incomplete and tracking-obscured attempts are separate outcomes.
- If paused, use phase:'paused'. Lost tracking immediately makes affected current
  checks unknown; never count a cycle across a long blind segment.
- Use fresh return objects/rep arrays so UI snapshots do not change behind its back.
- elapsedMs counts active session duration; assessableMs counts time for which all
  ENABLED checks were assessable. Do not exceed elapsedMs. Exclude huge/stale gaps.
- Rep check results summarize evidence for that rep. Unknown is distinct from fail.
  Minimum elbow and finishing extension come from the appropriate phases.
- The starter intentionally enables no checks. This is not finished assessment.

## UI semantics
- mountUI creates and returns a persistent video element. Do not replace it on render.
- bind attaches the provided actions. render displays state; it does not infer it.
- setRunning disables duplicate starts. Keep Stop available for a running/startup session.
- Status/cue text is textContent, not unsanitized innerHTML from user data.
- show source label: MOCK or LIVE CAMERA. Unknown/disabled checks must be neutral.
- draw actual points and separate dashed target line in the SAME fitted coordinate
  rectangle as the video. Letterbox calculations and mirroring must match exactly.
- destroy removes UI timers/listeners; A's stop function handles camera/model resources.

## Changing a shared file
1. Propose exact change + reason + effect on A/B/C to the team.
2. Agree on the complete new contract together. No private AI invention of an API.
3. A applies it on feature/a-contract-v2, adjusts integration/fixtures, runs checks,
   and merges a dedicated PR BEFORE dependent owner branches.
4. Everyone pulls it and updates in their own folders. Record version/migration here.
5. Frozen-file ownership check will flag it; note the approved exception in the PR.

Do not make a change merely to evade ownership checking. No split copies of contracts.
