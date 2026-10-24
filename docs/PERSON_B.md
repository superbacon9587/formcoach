# Person B — pushup measurements, reps, assessment and testing

> Current implementation: the user requested a follow-up audit and completion of
> the original B spec, including rep counting. The active v1 app now implements
> the side-view analyzer below. The separate front-view reference engine remains
> available but is not wired to v1. Side-view rules are not applied to that engine.

**Your goal:** pure TypeScript logic that turns PoseFrames into an honest
SessionView. You can complete most of this before the camera exists. Work only in
analysis/tests; do not fix tracking/UI by editing teammates' folders.

## 0. Square zero: join the same project
1. Read docs/BOOTSTRAP.md. Install Node 24, Git, editor; accept A's repo invitation.
2. Wait for A's initial main commit. Clone the repo URL A sends (do not create a
   second Vite app or a second GitHub repo).
3. Open the cloned folder with package.json; terminal:
   ```sh
   npm ci
   npm run check
   git switch -c feature/b-analysis
   npm run dev
   ```
4. Mock preview shows synthetic landmarks. Analysis is a deliberate unknown/zero
   stub; your task is to replace it. No Python, model download or camera required
   for your first logic tests. A owns real pose acquisition.
5. Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md and shared types.

## 1. Your files and public API
Writable: src/analysis/**, tests/analysis/**, docs/PERSON_B.md, docs/status/B.md.
Export `createAnalyzer(): Analyzer` from src/analysis/index.ts. Keep that signature.
Suggested internal modules: metrics.ts, rules.ts, rep-machine.ts, session.ts.
Import shared types/defaults; do not duplicate or change them.
No new packages, DOM, camera, model imports, fetch or LLM in analysis.

## 2. Give your AI this prompt FIRST
```text
You are Person B for FormCoach, an eight-hour side-view pushup hackathon.
Read AGENTS.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md, docs/PERSON_B.md and
src/shared/contracts.ts. Only edit src/analysis/**, tests/analysis/** and my B
status/guide. Preserve createAnalyzer(): Analyzer exactly. No dependencies,
UI, tracking, main, fixtures, shared types or package-lock changes.
Build pure functions for elbow angle, normalized hip-line distance and per-check
validity. Then an explicit timed rep machine and confidence-aware alignment check.
Use synthetic test sequences in tests/analysis; they need not use the visual mock.
Unknown/disabled is never pass. finish must be idempotent, reset complete.
First show a small staged plan, then implement and run npm run check.
Ask the team for a shared API change instead of privately editing contracts.
```

## 3. Measurements first (first 30 minutes)
Input points are intrinsic pixels. y increases downward. Timestamps are milliseconds.
Use only the chosen side in the supplied frame; do not switch sides yourself.

### Elbow angle
u = shoulder - elbow; v = wrist - elbow.
angle = acos(clamp(dot(u,v)/(length(u)*length(v)), -1, 1)) * 180/PI.
Return null if points are missing, insufficient visibility, nonfinite, or zero-length.
A starting visibility gate of 0.6 is a tunable heuristic. Never turn null into zero.

### Hip deviation
Let S shoulder, H hip, A ankle; dx=A.x-S.x; dy=A.y-S.y.
`abs(dx*(H.y-S.y) - dy*(H.x-S.x)) / (dx*dx + dy*dy)`.
This is perpendicular hip distance divided by body-line length. Return null for
invalid geometry, tracking, or visibility. It is scale-invariant but perspective
still matters. It does NOT measure spinal rounding or injury risk.

### Sag/pike (optional)
In the supported near-horizontal side view, interpolate shoulder-to-ankle line y
at hip x. Positive hip vertical residual suggests sag; negative suggests pike.
Skip directional labels for near-vertical/unstable geometry; use a generic alignment
cue instead. Do not assume a raw cross-product sign means sag in both directions.

### Metrics tests
Put synthetic points in tests/analysis, not shared fixtures. Check known 90/180
angles, uniform scaling/translation invariance of deviation, missing joints,
low visibility, zero length, and NaN. These tests catch geometry mistakes, not
prove real-person validity.

## 4. Explicit rep machine (first 60-90 minutes)
Keep a RULES object in your own folder, so you alone tune values.
Experimental starting values (validate with actual recordings):
- top elbow angle >=160 degrees, stable 200 ms;
- descent begins below145 degrees after an established top;
- meaningful excursion at least15 degrees;
- sustained reversal window about100-150 ms;
- arm tracking loss grace about250 ms, then unassessed + reset to waiting for top.
Use elapsed time, not "five frames". Small tracking jitter must not become a rep.

Implement:
1. READY: wait for a stable tracked top, then arm the counter. Do not arm from a
   random first bent-arm frame. Keep initial setup movement out of completed reps.
2. DOWN: meaningful flexion starts ONE attempt; initialize its times/extrema/faults.
3. BOTTOM: sustained reversal from decreasing to increasing elbow angle, with minimum
   excursion. Allow a hold at the bottom; do not time out a legitimate slow rep.
4. UP: track finishing extension in this phase only. Stable return to top completes
   one cycle. Final top samples do not reset the ending stats before they're logged.
5. A down reversal before finishing top can close an incomplete attempt, then begin
   a new descent after sufficient evidence. Count it once, not every frame.
6. Stop during an active attempt logs incomplete. Tracking-obscured active attempts
   are unassessed. Do not count a cycle across missing frames or a side switch.
7. Brief loss pauses state and invalidates current affected checks. Long loss closes
   the attempt unassessed and requires new top calibration. Huge timestamp gaps
   must not accumulate seconds of fault/pass evidence.

Smooth only valid measurements, modestly and time-aware. Clear smoothing history
on lost tracking, side/dimension changes, and reset. Derivative/reversal decisions
must require sustained evidence rather than a one-frame sign flip.

## 5. Primary form check: alignment (hour 2)
- Fail above normalized deviation0.05 for200 ms; recover below0.035 for300 ms as
  provisional bands. Tune against tests. No claim that these are clinical standards.
- Do not mark pass before enough valid evidence exists. Stay unknown initially.
- Any missing required body joint makes current alignment unknown immediately.
- Reset pending evidence timers on invalid data. Never accumulate disconnected
  invalid/valid fragments as a continuous failure.
- Track a sustained deviation at most once per attempt. Store rep-level result:
  fail if supported failure occurred; unknown if required evidence was insufficient;
  pass only if there was sufficient assessable evidence and no failure.
- Current live status and final rep status are different. Recovery can turn the
  live line green while the rep still records a deviation that happened earlier.
- Put only alignment:true in enabledChecks at first. depth/extension stay false
  and their results unknown until their implementations/tests really exist.

## 6. Public analyzer lifecycle
- update(frame) -> a fresh complete SessionView. Do not mutate frame.
- finish(timestamp) closes a current attempt ONCE; repeated finish must not append
  duplicates or change counts. It may be called during Stop and reset orchestration.
- reset() clears EVERY session variable. finish(0) right after reset returns zeros.
- Fresh reps array/snapshots prevent later updates from mutating old UI states.
- Counts come from recorded outcomes. A no-reps summary never divides by zero.
- elapsedMs is active duration; assessableMs cannot exceed it. Track time only while
  required metrics for enabled checks are valid. Do not count the first timestamp
  as elapsed since zero if camera starts with performance.now().
- phase:'paused' when counting cannot continue; cue should explain repositioning.

## 7. Optional range targets (only when core works)
Bottom min elbow <=90 degrees is a candidate range proxy, NOT chest-to-floor distance.
Assess at reversal/end; during descent lack of target depth is not yet a failed rep.
Final extension near160 degrees is a candidate target. The initial extended pose
must never satisfy a final-extension check. Store finishElbowDeg from UP/top only.
If you cannot robustly implement these by elapsed hour5, keep them disabled and
ensure summary explicitly says they were not assessed.

## 8. Meaningful automated tests
Use node:test and assert; tsx already installed. Add *.test.ts under tests/analysis.
- Known full cycle counted once at stable top.
- Standing/no motion/top jitter counted zero.
- Partial range returning to top is a movement cycle; optional depth target fails.
- Insufficient final return -> incomplete or still active until Stop, not completed.
- Initial 180-degree top does not hide a poor finishing extension.
- Low-confidence arm -> no count; body invalid -> alignment unknown.
- Loss in middle -> no completed cycle across blind interval.
- Sustained alignment deviation counted once; one bad frame filtered.
- Different frame intervals produce similar timing outcomes.
- Slow rep and paused bottom accepted without duplicate counts.
- finish twice gives same reps/counts; reset removes old faults and timings.
- Side switch or dimensions change resets/recalibrates rather than bridging poses.
- Input frame remains unchanged; previous returned snapshots stay unchanged.
The starter tests are only API smoke checks. Keep them and add behavior coverage.

## 9. Integration and handoff
Run npm run check, git fetch origin, npm run ownership -- B.
Update docs/status/B.md with implemented checks, provisional threshold values,
examples tested, remaining limitations. Stage only your paths:
```sh
git add src/analysis tests/analysis docs/status/B.md
git commit -m "B: add pushup counting and alignment assessment"
git push -u origin feature/b-analysis
```
Open PR -> main. Tell A/C which checks are enabled and what your cues mean. Do not
ask C to reverse-engineer thresholds or add hidden counting logic in the UI.
After squash merge, create the next branch from updated main; see TEAM_WORKFLOW.

## 10. Human evaluation (elapsed hours4-6)
With consent, test all three people. Tune on two, check the third separately.
Hand-label completed cycles, partial/incomplete attempts, alignment deviations and
unassessable segments. Compare counts and false alarms. Mild deviations only;
no need to strain or deliberately perform risky movements.
Record small honest results: count error per set; alignment TP/FP/FN if labeled;
tracking coverage and supported camera view. Do not invent "95% accuracy".
Replay can be added only if time allows; manual live tests are acceptable today.
Final two hours: stabilize, communicate limits, help A verify integrated behavior.

## Front-view handoff: measurement and comparison engine

### Built on B's branch
`src/analysis/front-view.ts` exports `createFrontViewAnalyzer(reference?)` and
`fitReference(reference, frame)`. This is a separately testable B module, not a
private replacement of the frozen v1 contract. The existing `createAnalyzer()`
and its one-arm measurement display keep working unchanged.

The new engine measures both projected elbow angles and arm segment lengths,
fits a supplied bottom target to the user's planted hands, estimates movement
stage and compares each arm with the reference at that stage. It returns
reference-match decisions and short cues, not a claim of correct overall form.
Cycle counting and hip alignment are not included in this separate front-view
engine; the active v1 side-view analyzer implements them independently. Neither
engine supplies clinical or true 3D depth judgments.

### Input and reference needed for integration
- A's future agreed adapter must supply `FrontFrame`: timestampMs, intrinsic
  width/height, source and `arms.left` / `arms.right`, each with shoulder, elbow
  and wrist Points. It reuses shared Point/Side types. Missing joints are absent;
  confidence below 0.6 is unmeasurable. Source coordinates must stay unmirrored;
  left/right identify the person's anatomical sides.
- On lost tracking, supply empty arms with fresh timestamps. Reset on a new
  source session, a camera/view change or a left/right identity swap. The engine
  detects dimension/source changes and gaps over 250 ms itself, but it cannot
  detect all same-size camera movements or silent identity swaps.
- Supply `FrontReference = { id, top, bottom }`, containing complete both-arm
  joint samples from a reviewed real pushup at the supported fixed front angle.
  This commit supplies no real reference. Test coordinates are synthetic geometry
  fixtures only; neither those nor the illustrated animation are training truth.
- Hand contacts in top/bottom must remain within 2% of reference wrist spacing;
  each shoulder must move at least 5% of that spacing. These are geometry gates,
  not validations of good technique.

### Lifecycle
```ts
import { createFrontViewAnalyzer } from '../analysis/front-view';
const front = createFrontViewAnalyzer(reviewedReference);
const setup = front.calibrate(currentTopFrame);
// Do not start live comparison unless setup.calibrated is true.
const live = front.update(nextFrame);
const stopped = front.finish(); // repeatable; later updates freeze until reset
front.reset(); // clears calibration, decisions, timers and displayed targets
```

Call calibration deliberately while the user holds the reference top position.
Both arms must be visible and within the outer reference tolerance after fitting.
Calibration resets the session. Retrying calibration after failure is allowed.
New references require a new engine instance. Without a reference/calibration,
raw angle/length measurements are available but comparisons stay unknown.

### What C can render after the shared integration update
| Output | Meaning / display |
|---|---|
| `arms.left/right.elbowDeg` | Projected angle or null; optional measurement panel |
| `upperArmPx`, `forearmPx` | Projected shoulder-elbow and elbow-wrist lengths, not physical body dimensions |
| `phase` | ready/down/bottom/up/paused; ready denotes top, not a counted rep |
| `progress` | 0..1 projection along the reference shoulder movement, not a quality percentage |
| `bottomTarget` | Stable fitted destination for dashed blue lines; null without calibration |
| `expectedPose` | Intermediate reference at current progress, not the final destination |
| `tolerancePx` | Outer comparison tolerance for the target visualization |
| `arms.*.bottomDistance` | Maximum joint-to-bottom-target distance divided by calibration wrist spacing |
| `arms.*.referenceError` | Maximum joint-to-current-stage-reference distance divided by wrist spacing |
| `arms.*.referenceMatch` | Unknown/pass/fail for that arm's reference comparison |
| `referenceMatch` | Aggregate: any confirmed fail wins; pass requires both arms passing |
| `corrections` | Anatomical side, affected upperArm/forearm segment, and cue; color those segments red |
| `bottomReached` | Sustained arrival near the supplied bottom reference; usable for a confirmation tone |
| `cue` | One current instruction; display directly |
| `elapsedMs`, `assessableMs` | Active sampled time and intervals with assessable complete comparisons |

Render current joints from the input frame. Keep unknown neutral; only show green
for a supported reference pass. Red corrections are selected by B, not inferred
again by C. Do not show a whole-body good-form score. Video, current joints and
targets must share exactly the same fit/mirror transformation.
Play a target-confirmation tone only when bottomReached changes from false to
true, not on every frame during a bottom hold.

### Provisional behavior and limits
`front-view-rules.ts` holds the engineering tolerances. Joint error is normalized
by fixed calibration wrist spacing: below 0.05 supports pass after 200 ms; above
0.08 supports fail after 200 ms. Recovery from fail needs 300 ms below 0.05.
The middle band keeps the previous supported status. Invalid data clears evidence
and makes all live comparisons unknown immediately. Loss lasting 250 ms, source
changes, dimension changes or frame gaps over 250 ms remove calibration/targets.
Duplicate/backward/nonfinite timestamps pause comparisons without adding time.

Direction requires 120 ms of movement and at least 0.03 progress excursion.
Top/bottom endpoint holds require 200 ms. Bottom also needs progress >=0.9 and all
joints within the inner band; top is progress <=0.1. Slow holds do not time out.
Only adjacent fully valid comparisons contribute assessable time; large gaps are
excluded entirely. Measurement and evidence are time-based, not frame-count based.

Reference fitting handles uniform 2D scale, rotation and translation via the hand
baseline. It does not solve camera perspective, individual limb proportions or
occlusion. Intermediate poses linearly interpolate two reviewed endpoints; this
is a provisional movement template that needs recordings to validate or replace
with more sampled phases. Shoulder-derived progress can be distorted by shoulder
tracking errors. Passing means matching that template, not proven safe technique.

### Merge boundary
Merging B alone does not activate the new engine in the app. A must apply the
agreed both-arm/shared-output changes and connect the source, engine and C's
renderer in a separate integration change. Preserve this module's unknown states
and stable targets. The active v1 analyzer now counts side-view cycles; that does
not activate front-view coaching or supply a front-view reference.
No camera, UI, packages, shared types or integration files were changed in this
front-view groundwork milestone.

## Follow-up audit: active side-view analyzer completed

### Implemented in the existing app pipeline
`createAnalyzer(): Analyzer` now supplies live phase, raw elbow angle, normalized
hip deviation, live alignment status/cues, completed/incomplete/unassessed counts,
per-attempt range/alignment results, elapsed time and assessable time. C's existing
live and summary screens render those fields without an API change. All three
checks are enabled because the alignment and optional range checks now have
implementations and behavior tests. The front-view engine is unchanged.

### State and range rules
`src/analysis/rules.ts` owns provisional settings. Initial top requires a visible,
near-horizontal shoulder-to-ankle body line (slope <=1) with the wrist below the
shoulder, and raw elbow >=160 degrees for 200 ms. This is an approximate setup
gate to reject standing arm motion, not a guarantee of camera orientation.
Missing hip alone does not prevent counting once the setup is established, but
it makes alignment unknown. Missing shoulder/ankle prevents initial setup.

Valid angle samples use a time-aware exponential filter with a 40 ms time constant
for movement decisions and rep extrema; live elbowDeg remains the raw angle.
Descent requires raw angle below145, at least15 degrees excursion and 80 ms of
evidence to reject a one-frame outlier. Rising requires a3-degree reversal held
for120 ms. No arbitrary slow-rep or bottom-hold timeout exists. A stable top ends
one cycle; a15-degree renewed descent below145 for120 ms can close one incomplete
attempt before starting another. Setup motion and top jitter are not reps.

Depth is assessed only after a confirmed reversal or at attempt end, never while
still descending. Its provisional target is minimum filtered elbow <=90 degrees,
with a1-degree settling tolerance. Ending extension is assessed only at attempt
end using filtered samples from the confirmed UP phase, with target >=160 minus
the same1-degree tolerance. The initial top cannot satisfy ending extension.
Depth is a side-view angle proxy, not chest-to-floor distance; these candidate
targets still need real-person tuning.

### Alignment and uncertainty
Deviation >0.05 for200 ms establishes fail; below0.035 establishes initial pass
after200 ms or recovers from fail after300 ms. Invalid required joints reset live
evidence immediately. A sustained failure actually observed during an attempt is
sticky in that attempt's result even after live recovery. A fault confined to
setup is not copied into an otherwise corrected rep.

A rep alignment pass needs at least200 ms of valid alignment intervals, at least
80% coverage of its duration, observed pass evidence and no supported failure.
Otherwise alignment is unknown. Sag/pike cues use vertical residual from the
shoulder-to-ankle line, retaining meaning for either facing direction.

Any blind arm interval marks the active attempt unassessed, even if tracking
quickly resumes. Loss lasting250 ms closes it once and requires a fresh top.
Side/dimension/source changes and frame gaps >250 ms also close as unassessed
and reset movement/filter/check history. Invalid or duplicate/backward timestamps
pause without adding time or fault evidence. Unknown is never silently a pass.

### Session lifecycle and verification
Stop logs an active tracked attempt as incomplete; a tracking-obscured attempt is
unassessed. Stop after a long blind gap is also unassessed. Repeated finish calls
are identical and later updates stay frozen until reset. Exception: the existing
main shell calls finish(0) immediately after reset to render empty state; this
pre-input read returns zeros without disabling the next run. Reset clears all
records, smoothing, evidence, state and times. Returned snapshots are independent.

Elapsed time starts at the first real timestamp, not zero. Only adjacent valid
geometry samples contribute assessable time; huge gaps are excluded entirely.
Completed counts and all summaries derive from recorded outcomes.

Automated geometry/state tests and browser mock integration are available. Human
evaluation (two teammates for tuning, a third held out), real-camera count error,
false alarms and tracking coverage remain to be recorded by the team. No real
accuracy percentage or completed human evaluation is claimed.
