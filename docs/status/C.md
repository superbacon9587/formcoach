# Person C status

- Branch: feature/c-ui
- Working:
  - Three views driven by setRunning/render: Setup -> Live -> Summary. Failed startup
    (e.g. camera error) returns to Setup with the status message; Stop -> Summary;
    "Back to setup" calls the supplied reset; "Repeat set" restarts the last mode.
  - Setup: original animated pushup demonstration (src/ui/demo.ts: Canvas, rigid plank
    + 2-link elbow IK, fixed limb lengths, hands/toes planted, ~4 s loop, Pause/Replay,
    reduced-motion aware, paused when hidden, cleaned up in destroy), camera
    instructions, and the list of checks from B's enabledChecks.
  - Live: big completed count, phase, B's elbow angle, one cue, Stop, source badge
    (MOCK · SYNTHETIC LANDMARKS / LIVE CAMERA), tracking banner incl. "pose lost".
    Check chips: unknown = "?" gray, disabled = "Not assessed" gray, pass = check
    green, fail = cross red. Colour is always paired with icon + text.
  - Overlay: neutral solid skeleton, dashed shoulder->ankle target line coloured by
    B's alignment status with a text label, hip ring on fail, elbow arc showing B's
    elbowDeg. Points below 0.6 visibility or absent are not drawn; lost pose draws
    nothing. Canvas is source-sized with object-fit: contain, same box as the video
    (verified with a 4:3 frame in the 16:9 stage). No mirroring.
  - Summary: B's completed/incomplete/unassessed counts, per-check tallies with
    unknown excluded from the denominator and counted separately, no percentage when
    nothing is assessable, disabled checks say "Not assessed", per-rep table,
    active vs assessable time, final cue.
- Tested:
  - npm run check passes (16 tests incl. tests/ui/labels.test.ts, tests/ui/demo.test.ts).
  - npm run ownership -- C passes.
  - Headless Chromium on mock input: setup -> live -> stop -> summary -> reset -> setup;
    same video element across runs; camera failure returns to setup with A's message;
    390 px phone width has no horizontal scroll; no console errors.
  - Pass/fail/summary visuals checked by injecting SessionView state from the test
    browser only (no fake-state controls in the app).
- Missing:
  - Live camera alignment NOT verified (A's adapter not implemented yet). Mock only.
  - Real check states only appear once B enables checks.
  - Demo motion should be reviewed by someone knowledgeable about pushups.
- Cross-owner requests:
  - B: cue text is shown verbatim; keep cues short (under ~60 chars) and actionable.
  - A: please confirm frame width/height equal video.videoWidth/videoHeight; the
    overlay alignment relies on it.
- Next milestone: test with A's live camera; fix any misalignment; run the
  "fresh tester" check from PERSON_C section 9.
