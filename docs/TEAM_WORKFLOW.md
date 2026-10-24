# Daily Git workflow for this eight-hour sprint

## Ownership map
| Owner | Writable code | Writable tests | Personal status |
|---|---|---|---|
| A | src/tracking/** + approved build/config files in AGENTS.md | tests/tracking/** | docs/status/A.md |
| B | src/analysis/** | tests/analysis/** | docs/status/B.md |
| C | src/ui/**, public/demos/**, public/audio/** | tests/ui/** | docs/status/C.md |

CI also flags out-of-lane PR changes using feature/a-, feature/b-, feature/c- branch prefixes.
An approved frozen-file integration PR is expected to flag ownership: A must explicitly
review the exception and apply the agreed change. Do not require the ownership job
as an unbypassable protection for this sprint if it blocks approved shared changes.

Frozen common files are listed in AGENTS.md. Every AI must read them, but no AI
may quietly rewrite them. B and C do not touch package.json or package-lock.json.
No shared CHANGELOG that all three update: use the three separate status files.

## Before every coding session
```sh
git status
git branch --show-current
git fetch origin
```
Be on your feature branch. With a clean working tree, sync:
```sh
git merge origin/main
npm ci
```
If uncommitted edits exist, make a small scoped commit FIRST or intentionally
finish/revert your own edits. Do not discard them just to make a pull succeed.

## Small PR loop (every 45-60 minutes)
1. Stay within your folder. Use mock/synthetic fixtures to avoid waiting on others.
2. Run:
   ```sh
   npm run check
   git fetch origin
   npm run ownership -- B
   ```
   Replace B with A or C. The checker includes committed, tracked-uncommitted and
   untracked source changes. Ignored assets/node_modules are not source changes.
   Origin/main must exist. During bootstrap only, A skips the role check.
3. Review `git diff` and `git diff --cached`. Stage explicit owned paths, not `git add .`:
   ```sh
   git add src/analysis tests/analysis docs/status/B.md
   git commit -m "B: add pushup phase machine"
   git push -u origin feature/b-analysis
   ```
   A/C use their own paths, branch names and messages.
4. GitHub > Compare & pull request. Base main; compare your branch. Explain changes,
   checks, remaining TODOs, and any approved exceptions. Do not merge it yourself.
5. A reviews one PR at a time, checks current main + branch, confirms checks, then
   squash-merges. This serializes integration, not coding.
6. After a squash merge, retire that feature branch. For the next unit:
   ```sh
   git switch main
   git pull --ff-only origin main
   npm ci
   git switch -c feature/b-feedback
   ```
   Do not keep piling commits on the squash-merged branch. A/C use their own prefix.

## If another PR merged while your branch was open
With a clean working tree:
```sh
git fetch origin
git merge origin/main
npm run check
npm run ownership -- B
git push
```
Use merge, not rebase/force-push, for this beginner workflow. A then checks again.

## Handling conflicts
- Run `git status` to identify files. Do not click "accept all incoming/current".
- If a shared contract or another person's code conflicts: stop editing that file,
  coordinate with its owner/A, and decide the intended combined behavior.
- If you want to cancel the merge and keep the pre-merge branch: `git merge --abort`.
- After resolving agreed changes: `git add path/to/resolved-file`, `git commit`,
  then run checks and push. Record approved cross-owner changes in the PR.
- Never use force push, reset --hard or clean -fd as a routine fix.
- Semantic conflicts can exist without Git conflicts. Verify the integrated app,
  not only that the PR says mergeable.

## Integration checkpoints
Hour 1: all entry points still typecheck and mock works.
Hour 2: camera -> analyzer -> UI -> Stop summary works, even if primitive.
Hour 3: confidence-gated alignment and counting work on live input.
Hour 5: all teammates tested; errors recorded.
Hour 6: feature freeze. Final two hours: fix/rehearse/submit.

## Handoff message template (send yourselves, not via this project)
Role / branch / PR:
Working now:
Commands run + results:
Known limitation:
Requested cross-owner change (if any):
Next 45-minute task:

## Definition of done
npm run check passes, role ownership check passes or approved exceptions are
explained, UI demo works, and the PR does not change frozen contracts silently.
A package update requires everyone to pull and npm ci. No independently chosen
alternative vision libraries or frameworks on parallel branches.
