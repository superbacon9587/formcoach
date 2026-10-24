import test from 'node:test';import assert from 'node:assert/strict';
import {emptyView} from '../src/shared/defaults';import {mockFrame} from '../src/fixtures/mock';
test('fresh defaults do not share mutable nested state',()=>{const a=emptyView(),b=emptyView();a.checks.alignment='pass';assert.equal(b.checks.alignment,'unknown');});
test('mock frames identify synthetic source and finite coordinates',()=>{for(const t of [0,500,2000,4000,6000]){const f=mockFrame(t);assert.equal(f.source,'mock');assert.ok(f.width>0);for(const p of Object.values(f.joints)){assert.ok(p);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}}});
