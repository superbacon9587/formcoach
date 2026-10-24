# Person B — pushup measurements, reps, assessment and testing

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
