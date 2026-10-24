import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('HTML exposes the fixed mount point',()=>{assert.match(readFileSync('index.html','utf8'),/id="app"/);});
