# V4: side-view pushups and suggestions

Apply this update AFTER the V3 Fixed Front Arms Update. It removes Front from the
user flow and selects the existing side animation, tracking and elbow analyzer.
Old front modules remain dormant for historical regression tests.

## Apply on Person A's computer
1. Stop Vite with Ctrl+C. Keep your current group branch and earlier changes.
2. Unzip FormCoach_Side_View_Update.zip into Downloads, outside the repository.
3. In the repository terminal:

```sh
git status
git apply --check ~/Downloads/FormCoach_Side_View_Update/side-view-update.patch
```

Only if the check succeeds:

```sh
git apply ~/Downloads/FormCoach_Side_View_Update/side-view-update.patch
npm run check
npm run dev
```

If the check fails, share the error. Do not force it, reset files, or pull an older
main over your local changes. Dependencies and assets are unchanged. No commit
or push is required for local testing.

## Use
- Camera beside you, near torso height; visible shoulder/elbow/wrist/hip/ankle in frame.
- Click **Start Camera**. Setup movements do not count. Take time to get ready.
- Hold a straight-arm top with hips near the shoulder-to-ankle line for 0.5 seconds.
  Then the app displays **3, 2, 1, Go**. Leaving that position or losing tracking
  restarts preparation. The countdown follows fresh camera frames.
- Begin after Go. No bottom pause is required. A median of three elbow samples
  still rejects isolated spikes; two confident bottom samples can satisfy depth.
- Click **End Set** on the laptop when finished. There is no automatic set end.
- Suggestions have their own prominent summary card. Identical suggestions are
  shown once. The per-rep table is removed; counts and aggregate checks remain.

## Thresholds
Default projected side-view elbow target: bottom90 degrees with8-degree tolerance;
lockout160 with8-degree tolerance. Bottom hold60 ->0 ms; return hold150 ->60 ms;
minimum attempt350 ->200 ms. Initial top stability150 ms remains inside the counter.
The preparation gate provides the separate0.5-second positioning +3-second countdown.
These are engineering settings, not proof of anatomical depth or chest clearance.
The default2D setting relies on a camera beside you; estimated3D remains optional.

## Group acceptance test before pushing
1. Mock preview: about12 seconds should produce3 attempts:2 depth+lockout met,
   1 partial. Mock intentionally bypasses camera preparation.
2. Start Camera; move into position slowly. Count must stay0 throughout setup.
3. Verify3/2/1; move away during countdown, then return. It must restart.
4. Do3 full reps at a comfortable brisk pace without pausing at the bottom.
   Confirm one count at each return to top, including the first rep after Go.
5. Do2 shallow reps: both contribute to total; summary gives one copy of each tip.
6. Keep the top position after the final rep. No automatic end or extra count.
7. Click End Set; camera turns off and the suggestions card appears. End during
   preparation must record0 attempts. Repeat Set must prepare and count down again.
8. Test camera loss, poor lighting and all three students. Do not treat unknown as
   good form. Stop mid-rep records partial; long tracking loss records interrupted.

Automated tests cover preparation/countdown reset, first rep after Go, quick bottom
visits at15/30/60fps, isolated spikes, relevant side tips and distinct suggestions.
Browser checks use synthetic input. Actual webcam accuracy requires the group test.
