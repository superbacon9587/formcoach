# V3: front demonstration + fixed camera guide + arms-only tracking

Apply AFTER FormCoach_Depth_Tally_Update (V2), the version in your latest recording.
This is another LOCAL testing patch. No remote push, merge or deployment is performed.

## The three requested changes

### 1. A real front-view demonstration
- Front selection now shows a front-view animated mannequin with both arm paths.
- Side selection shows the previous side-view illustration.
- The front rig has fixed upper/forearm lengths and planted hands. Its reference
  angle changes through a down/up cycle. It is original Canvas artwork.
- Demo and overlay use the same shared front reference geometry. Nothing is trained
  on this illustration, and it is not a medical/biomechanical validation.

### 2. A stationary camera-space guide
- Purple UPPER and blue LOWER dashed arms are drawn together on the camera overlay.
- Their locations come from frame dimensions + explicit guide controls only, NEVER
  from the moving user's landmarks. They do not switch places with movement phase.
- Size, left/right and up/down controls position the template BEFORE you lock it.
- Click LOCK GUIDE & START SET. The controls are then disabled for this set.
- Line up your hands/shoulders with the upper template, hold briefly, then follow
  the arm paths down and back up. Shoulder/elbow target circles and hand circles
  show the reference positions. Both targets remain on screen during tracking loss.
- A genuine camera-resolution change rebuilds the guide and requires relocking;
  normal browser resizing keeps the same source-video coordinates/object-fit.
- No automatic refit or hidden calibration makes the guide chase the person.

### 3. Front mode consumes only six IMAGE joints
- Required: LEFT shoulder/elbow/wrist and RIGHT shoulder/elbow/wrist.
- Front tracking output discards hips, knees, ankles and estimated world coordinates.
- Front analysis and front drawing read only those six joints. No spine/torso/hip
  skeleton is drawn, no hip confidence is required, and no3D z estimate gates reps.
- If an actual arm joint is hidden, feedback becomes uncertain; the system does
  not invent an elbow or keep scoring stale points. Partial attempts are retained.
- MediaPipe still predicts a full pose internally: its pretrained network is not
  an arm-specific detector. We cannot turn off its internal body representation
  with a frontend setting. Upstream failures that hide the arms can still occur.

## What a front rep means now
A cycle is detected from both arm triplets progressing along the FIXED upper-to-lower
reference path and returning. Partial paths count as recorded attempts, separately
from lower-target successes and tracking interruptions. Timing and path bands filter
jitter and small fluctuations. Missing hips/legs or corrupt world coordinates have
no effect when the six arm points are visible.

The90-degree setup value defines the illustration's reference rig, NOT an asserted
physical elbow angle measured accurately from front-view pixels. Projected elbow
angles remain visible as diagnostic numbers; the front rep counter no longer waits
for them to cross exactly90. True anatomical-angle assessment would require more
camera calibration or another view. The score is labeled TARGET-PATH feedback.
The previous angular engine is retained for SIDE mode and its regression tests.

## Apply on your current testing computer
1. Stop npm run dev with Ctrl+C. Keep your current group branch and existing V1/V2
   changes. Do not reset/pull main or reinstall the earlier patches.
2. Unzip FormCoach_Fixed_Front_Arms_Update.zip in Downloads (outside the repo).
3. In the existing cloned repo terminal:
   ```sh
   git apply --check ~/Downloads/FormCoach_Fixed_Front_Arms_Update/fixed-front-arms.patch
   ```
   If a mismatch is reported, STOP and share it. Do not force/overwrite. You can
   drag the .patch file into Terminal after git apply --check to insert its path.
4. If the check succeeds:
   ```sh
   git apply ~/Downloads/FormCoach_Fixed_Front_Arms_Update/fixed-front-arms.patch
   npm run check
   npm run dev
   ```
5. Reload the printed local URL. No package/model changes are needed.

## Use it
1. Select FRONT. Confirm the animation caption says FRONT VIEW.
2. Click START LIVE CAMERA. You should see the stationary purple/blue arm targets
   even before lining up. Only the measured arm skeleton should move.
3. Adjust guide Size/Left-right/Up-down. Fit the hand circles and upper shoulder
   positions to your setup. Keep the camera fixed throughout the set.
4. Click LOCK GUIDE & START SET, then hold the upper arm position until ARMED.
5. Perform a few controlled down/up cycles. Front mode shows ARM PATH ONLY.
6. Stop for total attempts, target-path feedback and diagnostic download.

Mock preview automatically locks its default guide so it can run unattended. It
uses clearly labeled synthetic arm paths: approximately12 seconds yields3 attempts,
2 lower-target successes and1 partial. Real-camera mode requires the manual lock.

## Acceptance checklist
- Switch Front -> Side -> Front: demo changes immediately, with matching captions.
- Move while unlocked: targets stay stationary; only sliders can reposition them.
- Lock: sliders disable. Move down/up: BOTH ghost positions stay unchanged.
- Move hips/legs out of frame while keeping arms visible: analysis must continue.
- Reach lower target and return: one count. Partial attempt: still tallied.
- Hide an elbow: gray uncertainty, fixed guide still visible, no fabricated success.
- Stop/restart: counters and lock reset. Reposition camera -> relock for a new set.
- Test all teammates with the actual camera. Export diagnostics if six arm points
  still become unreliable. No claim of real webcam validation is made by unit tests.

## Verification
New tests cover fixed guide invariance at all phases/drift/loss, explicit locking,
arm-only counting without world/hip coordinates, partial cycles, confidence loss,
15/30/60 fps, front rig lengths and planted contacts, and torso-line suppression in
the front renderer. Legacy side/angular tests remain. Browser tests exercise
front/side demo switching, synthetic cycles, summary/reset/restart, diagnostic
export, and manual guide controls using a clearly test-only camera adapter stub.
