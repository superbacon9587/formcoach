# Starter verification

Checked October 24, 2026 in the preparation environment:
- npm install produced an exact package-lock.json; npm run check passed.
- Five API/default/fixture smoke tests passed, TypeScript checked, Vite built dist.
- npm run assets successfully copied matching WASM and downloaded the Lite .task
  model (5,777,746 bytes). Generated assets are excluded from the archive; rerun
  assets on each machine that needs live inference and before deployment.
- Ownership checker independently tested in a temporary Git repo: B changes
  allowed; C-owned edits and untracked shared files on a B branch rejected.
- No authenticated remote push was performed. The starter has no GitHub remote.

Limits:
- Browser automation was unavailable in this environment: the browser download
  failed. The actual browser flow must be checked by the team at kickoff.
- Camera adapter and analyzer deliberately remain honest TODO boundaries. This is
  a coordination scaffold, not a finished computer-vision application.
- Smoke tests do not prove real-person tracking, rep counting, or form validity.
- GitHub Actions workflow is supplied, not observed on your GitHub account.
- No passwords, tokens, personal footage, uploaded stock clips, node_modules,
  build output or model binaries are included in the source archive.
