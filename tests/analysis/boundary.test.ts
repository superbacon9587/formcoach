import test from 'node:test';import assert from 'node:assert/strict';
import {createAnalyzer} from '../../src/analysis';import {mockFrame} from '../../src/fixtures/mock';
test('analysis API returns finite counts, resets, and never passes lost tracking',()=>{const a=createAnalyzer();a.update(mockFrame(0));const out=a.update({...mockFrame(100),tracking:'lost',joints:{}});assert.equal(out.checks.alignment,'unknown');assert.ok(Number.isFinite(out.completed));a.finish(100);a.reset();assert.equal(a.finish(0).completed,0);});
