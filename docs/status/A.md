# Person A status

- Branch: feature/a-camera (uncommitted for human review).
- Working: webcam acquisition; local MediaPipe VIDEO inference with GPU/CPU fallback; sequential fresh-frame processing; stable side selection; intrinsic pixel joints and monotonic millisecond timestamps; explicit loss and 1.5-second freshness watchdog; bounded startup waits and idempotent resource cleanup.
- Tested: npm run check passed (8 tests, TypeScript, production build); npm run ownership -- A passed. Automated tests cover side stability, coordinates, confidence gating, partial/lost frames and reacquisition. Local model/WASM files are present.
- Missing: actual browser/camera validation, GPU/CPU behavior on target laptop, permission denial and Stop during loading/restart checks, observed FPS and deployed subpath smoke test. Automated checks do not establish live-camera accuracy.
- Cross-owner requests: none; shared contracts and integration shell unchanged; no dependency changes.
- Next milestone: human live-camera review and device testing before any commit, push or merge.
