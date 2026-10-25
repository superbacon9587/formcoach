import test from 'node:test';import assert from 'node:assert/strict';
import {repFeedback,sessionSuggestions,faultSuggestions} from '../../src/analysis/rep-feedback';
import type {CheckResults,RepResult} from '../../src/shared/contracts';
const rep=(feedback:RepResult['feedback'])=>({feedback} as RepResult);
const pass:CheckResults={alignment:'pass',depth:'pass',extension:'pass'};
test('each failed check produces only its own fault-first correction',()=>{
 for(const [key,label] of [['alignment','Body alignment'],['depth','Elbow depth'],['extension','Lockout']] as const){
  const tips=faultSuggestions({...pass,[key]:'fail'});assert.equal(tips.length,1);assert.ok(tips[0].startsWith(label+' - '));
 }
 assert.deepEqual(faultSuggestions(pass),[]);
 assert.deepEqual(faultSuggestions({alignment:'unknown',depth:'unknown',extension:'unknown'}),[]);
});
test('all three faults produce three distinct cues; depth follows configured angle',()=>{
 const tips=faultSuggestions({alignment:'fail',depth:'fail',extension:'fail'},100);
 assert.equal(tips.length,3);assert.match(tips[1],/100 degrees/);
});
test('repeated near and shallow faults merge; successful reps add no generic suggestions',()=>{
 const near=repFeedback(103,165,90,160,'pass',false,'side');
 const shallow=repFeedback(130,165,90,160,'pass',false,'side');
 const good=repFeedback(85,165,90,160,'pass',false,'side');
 const tips=sessionSuggestions([rep(near),rep(shallow),rep(good)]);
 assert.equal(tips.length,1);assert.match(tips[0],/^Elbow depth -/);assert.deepEqual(good.suggestions,[]);
});
test('unknown depth does not invent a fault or hide a known alignment fault',()=>{
 assert.deepEqual(repFeedback(150,165,90,160,'unknown',true,'side').suggestions,[]);
 const feedback=repFeedback(150,null,90,160,'fail',true,'side',{alignment:'fail',depth:'unknown',extension:'unknown'});
 assert.equal(feedback.score,null);assert.equal(feedback.suggestions.length,1);assert.match(feedback.suggestions[0],/^Body alignment -/);
});
