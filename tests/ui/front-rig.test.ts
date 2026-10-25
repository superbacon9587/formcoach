import test from 'node:test';import assert from 'node:assert/strict';
import {frontArmRig,FRONT_RIG,createFrontGuide} from '../../src/shared/front-guide';
import {DEFAULT_SETTINGS} from '../../src/shared/coaching';
const dist=(a:{x:number;y:number;z:number},b:typeof a)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('front-view demo rig has fixed hand contacts and fixed upper/forearm lengths across the cycle',()=>{
  for(const side of ['left','right'] as const){const hand=frontArmRig(160,side).wrist;
    for(let angle=65;angle<=180;angle+=2.5){const p=frontArmRig(angle,side);assert.deepEqual(p.wrist,hand);assert.ok(Math.abs(dist(p.shoulder,p.elbow)-FRONT_RIG.upper)<1e-8);assert.ok(Math.abs(dist(p.elbow,p.wrist)-FRONT_RIG.fore)<1e-8);}
  }
});
test('fixed front reference is generated without any user landmarks and fits in the default camera frame',()=>{
  const g=createFrontGuide(640,480,DEFAULT_SETTINGS);
  for(const pose of [g.top,g.bottom])for(const arm of Object.values(pose))for(const p of Object.values(arm)){assert.ok(p!.x>=0&&p!.x<=640&&p!.y>=0&&p!.y<=480);}
  assert.deepEqual(g.top.left.wrist,g.bottom.left.wrist);
});
