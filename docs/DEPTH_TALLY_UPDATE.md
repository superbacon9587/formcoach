# Depth and tally update — apply AFTER the first front-view group patch

## What the recording shows
- The final summary already contains2 incomplete attempts and1 tracking-interrupted
  attempt, but the large completed-rep label remains0. Effort was recorded and then
  hidden by a headline that counted only target-passing reps.
- A bottom-position frame shows approximately94 degrees on one arm and112 on the
  other. Both had to be <=90 degrees together for60 ms in V1; that condition fails.
- The estimated angles also jump around the bottom. The image landmarks are not
  ground-truth depth: front-view foreshortening and head/torso occlusion are likely
  contributors. A screen recording alone does not identify the exact failing3D
  coordinate or its visibility. Numeric diagnostic export is added for the next test.
- V1 lacked angle smoothing, imposed an exact bilateral depth cutoff, allowed a
  false straight-arm estimate to act as a return-to-top, and ended attempts after
  only250 ms of missing data. These application choices amplified model noise.

## Fixes
1. The main number now says REP ATTEMPTS RECORDED. It includes full-target, partial,
   stopped-midway and tracking-interrupted attempts. Categories remain separate;
   a tracking interruption is not labeled a completed full rep. Tally closes an
   attempt at its return or interruption/Stop, not on every video frame.
2. Depth is graded after the attempt, not used to erase it. A small8-degree endpoint
   tolerance reduces threshold brittleness. Near-target range gets constructive
   next-set advice. Red feedback is reserved for sustained alignment issues rather
   than punishing every partial attempt.
3. A three-sample median filters elbow estimates. Small image-point smoothing reduces
   overlay jitter. Neither invents points for a hidden joint.
4. Calibrated shoulder height relative to the hand baseline corroborates lowering
   and return. A transient straight-elbow estimate while shoulders stay down cannot
   close a rep. This perspective-dependent proxy DOES NOT certify90-degree depth.
5. Brief tracking loss up to about700 ms can preserve an active attempt, but makes
   its depth grade uncertain. Longer loss closes it as tracking-interrupted and
   requires a new top. No completed full rep is fabricated across a blind interval.
6. A large3D angle jump while shoulder height barely changes marks the depth estimate
   inconsistent. That attempt can still be tallied; unreliable depth is not scored0.
7. The summary gives a heuristic movement score for gradeable attempts and practical
   suggestions. Uncertain attempts are excluded from the score denominator. The
   rubric weights depth60%, return extension25%, synchrony15% when each is known;
   it is an engineering coaching heuristic, not a validated safety/biomechanics grade.
8. Download diagnostic measurements exports local numeric angles, confidence, motion
   proxy and phases. It does not record/upload the webcam video. Export before Reset.

## Apply on the SAME testing computer
This is an incremental patch for the version shown in your screen recording.
Keep your current group-test branch and existing V1 changes. Do NOT pull/reset main
or reapply the first ZIP just to install this follow-up.

1. Stop the Vite dev server with Ctrl+C in its terminal.
2. Leave FormCoach_Depth_Tally_Update.zip in Downloads; double-click to unzip.
3. In your cloned repo's terminal, check the patch WITHOUT changing files:
   ```sh
   git apply --check ~/Downloads/FormCoach_Depth_Tally_Update/depth-tally-update.patch
   ```
   If extracted elsewhere, type git apply --check followed by a space and drag the
   .patch into Terminal. If a mismatch appears, STOP and share it. Do not force it.
4. If the check succeeds:
   ```sh
   git apply ~/Downloads/FormCoach_Depth_Tally_Update/depth-tally-update.patch
   npm run check
   npm run dev
   ```
   No new dependencies or model downloads are needed. No commit/push required.
5. Open the actual URL Vite prints. Reload the page to replace the old running code.
   Make sure the counter label reads 'rep attempts recorded'.

## Test together
- Mock: after about12 seconds expect3 attempts =2 target-met +1 partial. If it keeps
  running, the loop repeats and totals increase. Stop/restart returns to zero.
- Live: begin with your usual straight-arm top; perform several controlled pushups.
  The tally should include partial-range attempts when you return, even if the
  estimated angle never reaches90 degrees. Check the separate depth category.
- Bottom noise: a sudden angle increase while shoulders remain low must not add a
  spurious rep. Continue to your top position normally; do not chase noisy numbers.
- Camera framing: raise/reposition it slightly so your head does not hide shoulders
  or elbows at the bottom. Keep both wrists visible. Check the counter without
  looking at the screen continuously during the movement.
- Brief occlusion: gray feedback, preserved attempt, depth marked uncertain rather
  than bad. Longer loss is listed as interrupted tracking. It must not become two
  full reps just because tracking recovered.
- Stop midway: one partial attempt is retained. Restart clears counts/grade/timers.
- After the live set: click DOWNLOAD DIAGNOSTIC MEASUREMENTS. Share that JSON with
  the developer if depth remains unstable; it is more diagnostic than screen pixels.

## Verification and limits
Automated tests simulate near-target elbows, bottom3D angle flips, brief occlusion,
full/partial cycles, uncertain grades, smoothing, and lifecycle behavior. These are
synthetic fault injections inspired by the recording, NOT extracted motion-capture
measurements from the recording. Actual counting/grade quality must be retested on
this computer and multiple people. This update does not retrain or fix the pretrained
model's3D reconstruction, and does not assess trunk alignment from the front.

## Reversal
Before any further edits, git apply --reverse --check PATH_TO_PATCH verifies that
this update can be reversed. Only reverse if that succeeds and you intentionally
want to return to V1. Never git reset --hard to discard your existing work.
