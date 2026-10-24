# Person C — interface, guides, animated demonstration and presentation

**Your goal:** a tester understands setup, sees measured vs target positions,
receives one clear cue, and gets a readable summary. Build independently using
mock frames; do not wait for the camera or invent assessment logic in the UI.

## 0. Square zero: tools and checkout
1. Read docs/BOOTSTRAP.md. Install Node24, Git and editor; accept repo invitation.
2. Wait for A's initial main commit; clone the SAME repo A sends.
3. Open the cloned folder containing package.json. In its terminal:
   ```sh
   npm ci
   npm run check
   git switch -c feature/c-ui
   npm run dev
   ```
4. Open Vite's localhost address. Press Mock preview. You should see a synthetic
   moving skeleton and neutral assessment. A's live adapter and B's analyzer are
   intentionally incomplete. Mock is not a form-teaching animation.
5. Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md and shared types.

## 1. Your exact files
Writable: src/ui/**, tests/ui/**, public/demos/**, public/audio/**,
docs/PERSON_C.md, docs/status/C.md. Existing CSS/HTML inside your module is yours.
Keep global index.html, src/main.ts, shared contracts, fixtures and all packages
unchanged. No npm install; request a dependency from A only if essential.
Export `mountUI(root: HTMLElement): CoachUI` from src/ui/index.ts.

## 2. Give your AI this prompt FIRST
```text
You are Person C for FormCoach, an eight-hour pushup hackathon with three owners.
Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md, docs/PERSON_C.md and
src/shared/contracts.ts. Only edit src/ui/**, tests/ui/**, public/demos/**,
public/audio/** and my C status/guide. Preserve mountUI(root): CoachUI.
Use the supplied mock source through existing wiring. Do not edit fixtures, main,
tracking, analysis, shared types, package.json or package-lock. No new frameworks.
Build setup/live/summary views, aligned Canvas skeleton/target line, explicit
unknown/pass/fail labels, and a simple original animated pushup demonstration.
Never calculate form rules or reps in UI: render B's supplied state. Mock must be
labeled synthetic. First list changed files, then implement, run npm run check,
and report manual UI checks plus anything blocked by A/B.
```

## 3. First-hour UI: reuse the existing wiring
The starter mounts buttons, a persistent video, overlay, basic stats and summary.
Improve it in place rather than replace the architecture.
- mountUI creates DOM ONCE and returns its persistent HTMLVideoElement to A.
- bind connects existing actions.start('mock'|'camera'), stop(), reset().
- render(frame, view) updates labels/canvas; NEVER recreates the video element.
- setStatus shows model/camera errors and setup instructions as text.
- setRunning prevents duplicate starts; Stop must remain usable during startup.
- destroy removes animation RAF/timers/listeners that you created.
Use textContent for status, counters, cues, and other dynamic text. Keep controls
keyboard accessible; use real buttons and status/live text sparingly.

## 4. Three screens, not a complicated product
### Setup
- Short animated pushup demo; explicit supported side view and standard floor pushup.
- Instructions: camera beside body, approximately torso level, hands through ankles
  in frame at top and bottom, avoid steep overhead laptop view.
- Explain supported checks. Hip-line alignment is first; range checks optional.
- Show readiness from available state; do not invent a second calibration algorithm.
  Ask B for a cue if setup cannot be communicated through current state.
### Live
- Large completed movement-cycle count; Stop; one cue; visible tracking/source label.
- Actual skeleton solid. Shoulder-to-ankle target line dashed and clearly distinct.
- Gray = unknown/not assessable; green = supported alignment check passes;
  red = B reports sustained deviation. Do not independently debounce rules.
- Do not color every joint green and imply whole-body correctness.
- Do not flash rapidly. Pair colors with text/icons.
### Summary
- B's completed/incomplete/unassessed counts.
- Per-rep results if available: completed cycle vs target pass are different.
- List enabled checks; disabled ones say "not assessed".
- Unknown results excluded from pass denominator and explicitly counted.
- If there are no assessable reps, say so rather than calculating a percentage.
- Restart resets the session through supplied reset action, not your own local counts.

## 5. Overlay geometry (coordinate bugs are common)
- The frame carries source width/height. Its points are unmirrored intrinsic pixels.
- For a container cw/ch and source sw/sh: scale=min(cw/sw,ch/sh);
  drawWidth=sw*scale; drawHeight=sh*scale;
  offsetX=(cw-drawWidth)/2; offsetY=(ch-drawHeight)/2.
- Either draw in a source-sized canvas fitted identically with object-fit:contain,
  as the starter does, OR apply explicit offsets/scaling. Do not mix both methods.
- If you use a devicePixelRatio backing store, transform once consistently.
- Video and Canvas must have exactly the same content-fit rectangle. Skeleton must
  not stretch when camera is4:3 and stage16:9. Test browser resize.
- If mirroring is added, mirror BOTH video and overlay together. Leave metrics and
  underlying points unmirrored. Unmirrored is acceptable for the hackathon.
- Do not draw stale/low-visibility limbs as certain measurements. Missing points
  should not appear at screen origin. Unknown body line is gray or hidden.
- Do not invent a fixed screen-height "chest depth" line. A side-view elbow-angle
  proxy does not locate the chest surface. Optional angle arc can show B's metric.

## 6. Animated demonstration: maximum45 minutes initially
No teammate needs to record their personal demonstration. Create original simple
artwork. The demo is independent from the camera overlay and scoring.

### Fast path: Canvas mannequin in src/ui/demo.ts
1. Create a separate small canvas beside/above the camera stage. Keep it visible in
   setup, then small or paused during a set to save rendering work.
2. Define a side-view skeleton with head/shoulder/elbow/wrist/hip/knee/ankle/toe.
3. Set top and bottom poses for a standard floor pushup. Hand and toe contacts stay
   fixed; body moves as a coherent plank; elbow bends with plausible geometry.
4. Animate a down/up loop around4 seconds. Use a smooth interpolation parameter.
   Inspect intermediate poses: naive independent point interpolation can stretch
   limbs. If obvious, solve connected segments at fixed lengths or simplify the rig.
5. Draw head circle and neutral-colored limb capsules/lines plus floor. No anatomy
   textures required. Add a visible label "Pushup demonstration · side view".
6. Review the motion with someone knowledgeable. Never treat generated animation
   as measurement ground truth or proof of the thresholds.
7. Keep its RAF identifier and cancel in destroy; don't start a new loop every render.
8. Provide pause/replay. Respect reduced-motion preference if readily achievable.

### Blender path (only if you already know it)
Use a simple original/licensed rig and side camera; keyframe top/down/bottom/up/top,
keep hands/toes planted and segment lengths consistent. Render a modest-resolution
loop to public/demos/pushup.webm or MP4; test the actual codec. Use
`${import.meta.env.BASE_URL}demos/pushup.webm` for hosted subpath compatibility.
Do not learn rigging from scratch today. Skip muscle shading and photorealism.
Do not embed watermarked stock examples without the necessary rights.

## 7. Develop independently when B/A aren't ready
- The supplied Mock preview drives moving landmarks immediately. It is deliberately
  synthetic and does not promise good rep geometry or successful B counts.
- To test UI statuses, add test-only SessionView fixtures under tests/ui or a
  UI-local development harness clearly labeled preview. Do not change shared
  fixtures or production counts. Remove any fake-state UI controls before submission.
- Check unknown/pass/fail, huge counts, zero reps, model failure message, lost pose,
  disabled range checks, summary, and reset rendering.
- Do not make B change contracts simply for visual convenience; use existing fields.

## 8. Test and publish your handoff
```sh
npm run check
git fetch origin
npm run ownership -- C
git add src/ui tests/ui public/demos public/audio docs/status/C.md
git commit -m "C: add pushup setup, overlay and animated demo"
git push -u origin feature/c-ui
```
If public/demos or audio has no files, omit it from git add. Open PR to main;
A reviews and merges. Tell B which state labels/cues look confusing, and tell A
about actual camera misalignment without editing their files.
After squash merge, make the next branch from updated main (TEAM_WORKFLOW).

## 9. Your final two hours
- Test with another student who has not watched you build it. Can they position the
  camera and understand a red/gray line without explanation?
- Verify camera framing, persistent video, Stop, Restart, readable error and zero set.
- Rehearse2 minutes: problem, animated demo, live pushups, feedback, summary,
  supported limits, small honest test results, link.
- Prepare a screen-recorded backup of the working app. Label replay honestly.
- Collect the submission link from A and verify it loads in a fresh browser.
- Do not add new animations, fonts, chart libraries or voice features in the final hour.
