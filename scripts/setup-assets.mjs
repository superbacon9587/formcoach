import {mkdir,cp,writeFile} from 'node:fs/promises';
await mkdir('public/wasm',{recursive:true});
await cp('node_modules/@mediapipe/tasks-vision/wasm','public/wasm',{recursive:true});
await mkdir('public/models',{recursive:true});
const url='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const res=await fetch(url);if(!res.ok)throw new Error(`Model download failed: ${res.status}`);
const bytes=new Uint8Array(await res.arrayBuffer());if(bytes.length<100000)throw new Error('Unexpected model size');
await writeFile('public/models/pose_landmarker_lite.task',bytes);
console.log(`Copied matching WASM and downloaded Lite model (${bytes.length} bytes).`);
