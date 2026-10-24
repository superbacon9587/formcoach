# Start here: one shared repo, initialized once by A

This is common setup. A performs steps 1-6; B and C join at step 7. Budget 20 minutes.
Commands beginning with a word such as git/npm are terminal commands, not browser input.
Do not paste a whole guide into the terminal. Run command blocks in order and inspect errors.

## 1. Accounts and local tools (everyone)
- Create/sign in to your own GitHub account. Share usernames with A privately.
- Install VS Code or your preferred editor. Open its Terminal > New Terminal.
- Install Node **24 LTS** from https://nodejs.org/en/download. Restart the terminal.
  On managed computers use the installer allowed by your school. Do not fight system permissions.
- Install Git from https://git-scm.com/downloads. On macOS, `git --version` may offer
  Apple's Command Line Tools; accept and finish. Windows: Git for Windows / Git Bash.
- Verify:
  ```sh
  node --version
  npm --version
  git --version
  ```
  Node should begin v24. Older Node can break Vite.
- Configure your OWN commit identity once. Replace the examples; you may use your
  GitHub-provided noreply email from GitHub Settings > Emails.
  ```sh
  git config --global user.name "YOUR NAME"
  git config --global user.email "YOUR EMAIL"
  ```
- Use GitHub Desktop for authentication if Git HTTPS sign-in is confusing.
  A GitHub account password is not a Git HTTPS token. Never put credentials in
  source files, prompts, remote URLs, or the terminal commands you share.

## 2. A creates an empty GitHub repository
- GitHub > New repository. Name suggestion: `formcoach`.
- Choose private/public according to hackathon rules and team preference.
- Leave README, .gitignore and license initialization OFF: this archive has files.
- Create repository; copy its HTTPS clone URL.
- Settings > Collaborators (or Collaborators and teams): invite B and C by their
  verified GitHub usernames. They accept invitations. Do not share passwords.
- If the repo already exists and has work: CLONE IT FIRST. Copy this starter's files
  onto a new bootstrap branch after checking for overlaps. Do not replace existing
  work or use the empty-repo commands blindly. Review and merge a bootstrap PR.

## 3. A prepares the starter folder
- Download/unzip `FormCoach_GitHub_Starter.zip`. Open the inner `formcoach` folder
  in your editor. It must contain package.json, src/, docs/, and package-lock.json.
- Do NOT run npm create vite again. The scaffold already exists.
- In that folder:
  ```sh
  npm ci
  npm run check
  npm run dev
  ```
- Open the printed localhost address; click Mock preview. You should see moving
  synthetic landmarks and unknown checks. Camera/analysis are intentionally TODOs.
- Ctrl+C stops the dev server. Ignore node_modules and dist: they are not source.

## 4. A makes the initial main commit (empty repo only)
Replace the URL with the actual repo URL; do not keep OWNER/REPO literally.
```sh
git init -b main
git add .
git status
git commit -m "Bootstrap FormCoach contracts and three-person workstreams"
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```
Check that node_modules, dist, credentials and personal recordings are not staged.
If `remote origin already exists`, inspect `git remote -v`; do not add it again.
If Git says `.git` already exists, inspect `git status` and the current branch first.
Never force push to solve an initial-history mismatch.

## 5. A configures collaboration
- Settings > General > Pull Requests: allow squash merging. Optional: disable auto
  branch deletion until teammates understand how to create a fresh branch.
- Actions: confirm the `checks` workflow runs on the initial push. If Actions is
  disabled by school/org policy, run `npm run check` locally for every handoff.
- If available on your repo/plan, create a main branch rule requiring a pull request
  and the `check` job. Avoid spending the deadline on unavailable branch protections;
  the team can still honor the same process manually. Do not require approvals if
  it creates a deadlock for this three-person sprint; A reviews integration.
- Optional CODEOWNERS is deliberately NOT active: actual GitHub handles are unknown.
  Ownership is documented and checked by script; no automatic review routing is claimed.
- Tell B/C: exact repo URL, role assignment, initial commit SHA (`git rev-parse --short HEAD`),
  and that main is ready. Everyone starts from this SAME snapshot.

## 6. A creates the first branch
```sh
git switch -c feature/a-camera
```
A now follows PERSON_A.md. No one edits main directly after bootstrap.

## 7. B and C clone separately
Use each person's own computer/checkout; do not share a single working directory.
```sh
git clone https://github.com/OWNER/REPO.git
cd REPO
npm ci
npm run check
npm run dev
```
Replace REPO with the cloned folder name. Open that folder in the editor.
Then create ONE role branch (stop the dev server with Ctrl+C if needed):
```sh
# B only
git switch -c feature/b-analysis
# C only, in C's checkout instead
git switch -c feature/c-ui
```
Give your individual AI the role-specific prompt from your guide. Require it to
read AGENTS.md and the contract, even if its editor does not load those automatically.

## 8. Confirm the kickoff together (5 minutes)
- Each computer can run Mock preview and npm run check.
- Each person states their allowed folders and exported entry point.
- No package installation on B/C; requests go to A.
- Agree a communication channel; after each merge announce PR, changed entry points
  (normally none), status, and blockers. A merges one PR at a time.
- Schedule integration at elapsed hours 1 and 2; freeze features by elapsed hour 6.

## If setup fails
- `npm ci` lock mismatch: pull main; do not regenerate package-lock as B/C.
- Wrong folder: run `pwd` and list files; package.json must be present.
- Port in use: open the NEW URL Vite prints, not a bookmarked port.
- Push denied: confirm invitation accepted, identity/authentication, and repo URL.
- Network fails: share errors with A. Do not swap model/library versions independently.

Official reference: https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
