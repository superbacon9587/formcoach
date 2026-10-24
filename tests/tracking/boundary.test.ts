import test from 'node:test';import assert from 'node:assert/strict';
import {startCameraSource} from '../../src/tracking';
test('tracking adapter is exported as an async source factory',()=>{assert.equal(typeof startCameraSource,'function');});
