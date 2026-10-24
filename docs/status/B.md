# Person B status

- Branch: feature/b-analysis
- Working: pure source-pixel point validation, point distance and projected elbow angle in src/analysis/metrics.ts. Analyzer publishes elbowDeg for the supplied arm. Visibility gate is provisionally 0.6; missing/nonfinite/low-confidence or degenerate data returns null. Lost tracking pauses measurement. No dependencies added.
- Tested: npm run check passes (12 tests, TypeScript check, production build). Synthetic tests cover known angles, translation/scaling/reflection, distance, invalid geometry, confidence, lost tracking, reset, input preservation and independent snapshots. No real-camera accuracy claim.
- Missing: rep counting, elapsed/assessable time accumulation, front-view reference calibration, both-arm comparison, target generation and form assessment. All checks remain disabled/unknown; hipDeviation stays null. Image-plane elbow angle is not true 3D depth. Current UI does not display this numeric measurement.
- Cross-owner requests: A must coordinate an agreed front-view contract update to supply separately identified left/right shoulders, elbows and wrists with confidence, timestamps and intrinsic dimensions. The current single-side PoseFrame cannot support both-arm comparison. Future calibrated target positions and comparison results need agreed output fields for the guide renderer. No frozen files changed here.
- Next milestone: agree the front-view data contract, then validate both-arm measurement on real footage before choosing comparison rules.

## Measurement display
- User explicitly requested a live Person B measurement panel, authorizing the small exception in src/ui/measurements.ts, src/ui/index.ts and src/ui/styles.css. Analysis and shared interfaces remain unchanged.
- Panel renders the supplied elbow angle, supplied arm, input source and measurable/uncertain status. It calculates no form rules or confidence percentages. Source labels distinguish synthetic input from camera input; reset clears the value.
- Verified npm run check (12 tests and build), browser mock updates, Stop preserving the last reading, and Reset returning to waiting. Real camera tracking is still A's pending work.
- Ownership checker will flag the explicitly requested UI exception and existing unrelated local editor files; those editor files are excluded from this change.
