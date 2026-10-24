# FormCoach · three-person pushup hackathon starter

A Git-ready project with locked interfaces and three independent workstreams.
**This is a runnable scaffold, not a completed vision coach.** Mock preview and
basic UI wiring are present. Camera mode intentionally reports unimplemented
until A builds it. Analysis intentionally returns unknown/zero until B builds it.
C improves the UI and adds the instructional animation. Do not present the
synthetic skeleton as a live tracking result or authoritative correct form.

## Start from zero
1. Assign A, B, C. A bootstraps the repo ONCE before anyone starts coding.
2. A follows [BOOTSTRAP](docs/BOOTSTRAP.md). B/C wait for the initial main commit.
3. Everyone reads [AGENTS](AGENTS.md), [CONTRACT](docs/CONTRACT.md), and
   [TEAM_WORKFLOW](docs/TEAM_WORKFLOW.md).
4. Open your guide: [A](docs/PERSON_A.md), [B](docs/PERSON_B.md), [C](docs/PERSON_C.md).
5. Clone the same GitHub repo; run `npm ci`, `npm run check`, `npm run dev`.
6. Open the localhost URL Vite prints and press Mock preview. Live camera is A's task.

Use Node 24 LTS and a recent desktop Chrome. No Python or Blender is required for
the core app. Vite + TypeScript, Canvas, MediaPipe. No AI service API keys needed.

## Commands
- `npm ci`: install exact locked packages; use this after cloning/pulling.
- `npm run dev`: local UI and mock preview; stop with Ctrl+C.
- `npm run assets`: A downloads pose model and copies matching WASM after npm ci.
- `npm run check`: tests + TypeScript check + production build.
- `npm run ownership -- B`: flag B-branch edits outside B's lane vs origin/main.
- `npm run build`: production files in dist. Run assets first for a live deployment.
- `npm run preview`: smoke-test that production build locally.

## Deadline
Hour 1: independent pieces work. Hour 2: integrated camera set reaches a summary.
Hour 3: live alignment feedback. Hour 5: test all teammates. Final 2 hours: fixes,
rehearsal, submission. If behind, keep only counting, hip alignment, demo and summary.

## Important
No workflow can guarantee zero conflicts. Ownership, frozen interfaces, small
merges, and repeated integration minimize them. Ownership checks flag exceptions;
AGENTS instructions only help if your AI actually reads and follows them.
No remote GitHub repo has been created by this archive. Bootstrap includes those steps.
Third-party code and downloaded models retain their own licenses; see notices.
