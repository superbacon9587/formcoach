# Dependency and model notices

This starter uses MediaPipe Tasks Vision, Vite, TypeScript, tsx and Node type
packages. Exact installed versions live in package-lock.json. Preserve their
upstream license/copyright notices when redistributing their code.

- MediaPipe code: Apache-2.0. https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE
- MediaPipe model: official downloadable Pose Landmarker Lite asset. A must check
  the specific asset's model card/license and record it before distribution.
  https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- Vite: https://github.com/vitejs/vite/blob/main/LICENSE
- TypeScript: https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt
- tsx: https://github.com/privatenumber/tsx/blob/master/LICENSE

Generated WASM/model files are ignored and downloaded with npm run assets.
Downloaded models still need appropriate notices in your deployment.
No third-party stock footage, avatars, voice models or anatomical textures are
included. The team should choose a license for its own original project code
before a public release; no license for the team's future code is imposed here.
