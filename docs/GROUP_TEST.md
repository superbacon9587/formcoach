# Current version: side-view workflow

See [V4 side-view update](SIDE_VIEW_UPDATE.md). This supersedes the front-view instructions below.

# Current V3: fixed front guide and arms-only front mode

Read [the V3 update guide](FIXED_FRONT_ARMS.md). This supersedes the older front-mode3D/angle
instructions below. Front mode now uses only six image arm joints, two stationary
reference poses, and an explicit manual guide lock. Side mode remains available.

# V2 update: effort tally and depth-estimate robustness

This supersedes the strict-count behavior described below. Read
[DEPTH_TALLY_UPDATE](DEPTH_TALLY_UPDATE.md). Recorded partial and uncertain attempts
now appear in the main tally; the grade is separate. Motion corroborates a cycle,
never proves physical90-degree depth. The previous V1 notes are historical.

# Group test: front-view pushups on one computer

## What was wrong
At baseline commit d9486631227e471c80eec4b7472fb36c5956484d, src/analysis/index.ts
was a measurement-only milestone: update() recreated emptyView every frame, and
there was no rep counter. A separate front-view reference prototype existed but
was not wired into main. This patch connects real counting in the live entry point.

## What changed
- One computer / one feature/group-front-view branch owns the combined integration.
  Pause A/B/C parallel edits while testing this version. Nothing is pushed by this patch.
- Front-view tracking emits both arms and the model's estimated world coordinates.
  Side remains an optional setup selection.
- Counter: stable initial lockout -> descent -> BOTH elbows at/below bottom target
  -> BOTH elbows at/above lockout target. At defaults: <=90 degrees, then >=160 degrees.
- Bottom evidence lasts60 ms; top evidence150 ms. No frame-count assumptions.
- A shallow cycle returning to lockout is an incomplete attempt, not a completed rep.
  Stop mid-cycle is incomplete. Long tracking loss interrupts/marks unassessed.
- Persistent counters, idempotent finish, clean reset, no counts across long blind gaps.
- Dashed calibrated arm targets and the counter share bottom/top angle settings.
  Canvas is display-only: touching a drawn pixel does not count a rep.
- Tracked skeleton glows green for supported, assessable movement checks; red pulse
  for sustained arm mismatch or a shallow attempt. Unknown tracking is gray.
  Reduced-motion preference makes red steady instead of pulsing.
- Front alignment checks arm synchrony (25-degree fail band,18-degree recovery),
  not hip sag, back shape, chest-to-floor distance or elbow-flare safety.
- Side mode checks a hip-line deviation proxy and visible-side elbow targets.

## Important measurement distinction
Front-facing 2D elbows can look straight while physically bent because of
foreshortening. The default camera measurement is MediaPipe estimated3D world
coordinates. These are inferred estimates, not a calibrated motion-capture system.
2D is an explicit alternative for debugging, and has different projected angles.
No silent fallback from missing camera world coordinates to2D occurs.
The UI shows left/right angles and HOLD TOP / ARMED / DEPTH REACHED states.

The dashed arm shapes use calibrated screen lengths to illustrate the configured
angle. They are SCHEMATIC, not an exact projected3D body outline; do not force the
person to occupy every target pixel. Their angle targets drive the numerical rep
criterion; absolute template position is not scored. A genuinely fitted full-body
3D ghost requires more development and validation than this patch.

Synthetic Mock preview uses projected2D geometry and says SYNTHETIC. It does not
run pose inference. The existing side-view teaching animation remains an exercise
illustration; it is not the reference data used to score the front camera.

## Apply safely on your Mac (Person A's computer only)
1. Tell B/C to stop editing/pushing temporarily. They can help test on this machine.
2. In your existing repository terminal, run git status. If there are local changes,
   review/save them before proceeding; do not discard or force anything.
3. With a clean tree:
   ```sh
   git switch main
   git pull --ff-only origin main
   git switch -c feature/group-front-view
   ```
   If that branch name exists, choose another feature/group- name rather than reset it.
4. Unzip FormCoach_Group_Fix.zip. From the repo terminal, run (adjust download path
   if macOS extracted into a different folder; you can drag the patch into Terminal):
   ```sh
   git apply --check ~/Downloads/FormCoach_Group_Fix/formcoach-group-fix.patch
   git apply ~/Downloads/FormCoach_Group_Fix/formcoach-group-fix.patch
   ```
   The --check must PASS before applying. If it reports a mismatch, stop and share
   the error; do not use force, --reject or overwrite files. The included BASE_COMMIT
   records the exact main snapshot used to build and verify the patch.
5. Install unchanged locked dependencies and assets, then run checks:
   ```sh
   npm ci
   npm run assets
   npm run check
   npm run dev
   ```
6. Open the Vite localhost URL. Select Front / Estimated3D, bottom90 / lockout160.
   Use Mock preview first, then live camera. No commit or push is required to test.

## Automatic tests
npm run check runs unit tests, TypeScript checking, and a production build.
New coverage exercises: repeated reps, top jitter, initial-bottom start, shallow
attempts, bilateral depth/lockout, tracking loss, reset/finish,15/30/60 fps, world
vs projected angles, shared target configuration, bilateral coordinate mapping,
and green/red/unknown overlay behavior. Original reference-prototype tests remain.

## Acceptance test with all three students
Use a standard floor pushup, camera facing your head/upper body so both shoulders,
elbows and wrists stay visible at the top AND bottom. Aim near moving-torso height
and adjust screen/camera tilt for visibility. Do not perform standing arm bends
as the product demo: this app measures elbow targets, not exercise identity.

1. MOCK: Run approximately12 seconds. The repeatable loop has two full target cycles
   and one shallow attempt. Expect2 completed +1 incomplete near that point; if you
   leave it running, it repeats and totals increase. Stop/restart clears the count.
2. TOP: Start camera, get into floor pushup position, hold both arms near your usual
   straight-arm top. Read L/R angles. It must say ARMED before counting can begin.
3. FULL: Perform3 controlled reps reaching both bottom targets and returning to both
   lockout targets. Expect3 completed, one count on EACH final lockout, no doubles.
4. SHALLOW: Do one comfortable partial descent and return. Expect no new completed
   rep and one incomplete attempt/red feedback. Do not induce painful deviations.
5. ASYMMETRY: Confirm when one tracked arm is outside the synchrony band the app
   shows a cue/red after sustained evidence. Missing/occluded data must be gray.
6. LOSS: Briefly move a required arm out of frame. No rep may complete across a long
   tracking loss. Show top again and confirm recovery. Test poor light and sleeves.
7. STOP/RESET: Stop halfway; summary records incomplete. Restart count is zero;
   camera light turns off on Stop. Stop during model startup must also clean up.
8. CROSS-PERSON: Repeat with all three people and the actual presentation laptop.
   Record count errors, left/right angles, and cases that stay unknown.

## If the counter still stays at zero
- See HOLD TOP? Both measured angles need to reach lockout for150 ms. Choose a more
  realistic lockout setting before the next set if the camera estimates your normal
  straight-arm pose below160. Do not hyperextend to satisfy a number.
- ARMED but never DEPTH REACHED? Inspect BOTH angles, not their average. Both need
  to be <=bottom target together for60 ms. Reposition camera and improve visibility.
- DEPTH REACHED but no count? BOTH arms must return to lockout for150 ms.
- Gray/blank? Missing/confidence/world data; reframe/re-light. Never infer a pass
  from invalid points. The3D and2D options intentionally have different measurements.
- Need to tune? UI changes apply to a NEW set. Timing/synchrony constants live in
  src/analysis/pushup-rules.ts. Report actual settings used; do not claim true clinical
  90-degree accuracy simply because an estimator crossed a threshold.

## After the group approves (later, not required now)
Run npm run check and npm run ownership -- GROUP, review git diff. Only then stage
intended files, commit, push your group branch and open a PR. The group ownership
mode is supported in CI for feature/group-* branch names. The earlier A/B/C lanes
remain available, but your team explicitly authorized cross-folder group edits.
Do not push model binaries, recordings, node_modules or dist.
