# Mandatory working agreement for every AI assistant

This is a three-student, eight-hour, side-view pushup project. Read this file,
README.md, docs/CONTRACT.md, docs/TEAM_WORKFLOW.md, and your PERSON guide BEFORE edits.
Ask the human which role you have if it is not supplied. Do not act as every role.

## File ownership
- A: src/tracking/**, tests/tracking/**, scripts/setup-assets.mjs, package.json,
  package-lock.json, vite.config.ts, tsconfig.json, .github/workflows/ci.yml,
  THIRD_PARTY_NOTICES.md, docs/PERSON_A.md, docs/status/A.md.
- B: src/analysis/**, tests/analysis/**, docs/PERSON_B.md, docs/status/B.md.
- C: src/ui/**, tests/ui/**, public/demos/**, public/audio/**,
  docs/PERSON_C.md, docs/status/C.md.
- FROZEN: src/shared/**, src/main.ts, src/fixtures/**, tests/contracts.test.ts,
  index.html, AGENTS.md, scripts/check-ownership.mjs and shared documentation.
  A applies an explicitly agreed shared change in a separate integration PR.

Do not edit another owner's code to fix a compile error. Document the required
change and coordinate with that owner. Read any file; write only in your lane.
No new dependencies except A, after team agreement. Do not regenerate the lockfile
on B/C branches. Do not rename exported entry points or change the contracts.

## Git and handoffs
Use feature/a-..., feature/b-..., feature/c-... branches. No direct commits to
main after bootstrap. Use small PRs. A merges them one at a time after checks.
Fetch and merge origin/main before a PR; do not rewrite published history.
No force push, reset --hard, git clean -fd, or automatic conflict resolution.
Do not stash or commit another person's edits. Update only your status file.
Run npm run check and npm run ownership -- ROLE before handoff.

## Technical boundaries
Source joints: unmirrored intrinsic video pixels; timestamps: milliseconds.
A owns acquisition/quality. B owns metrics/rules/reps. C owns DOM/drawing.
Analysis is DOM-free. UI must not compute form metrics or reps.
Never fabricate camera output. Mock must always be labeled synthetic.
Unknown/disabled checks are not passes. Track confidence per check.
No LLM, training, ghost matching, mobile framework, database, or second exercise.

## Completion report
List exact changed files, checks run, features still missing, and any blocked
cross-owner request. Do not claim a live-camera capability from a mock-only test.
