import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySearchOutcome} from '../lib/search-outcome.mjs';

test('empty results distinguish availability failures from absent prices',()=>{
 const outcome = sources => emptySearchOutcome({offers:[],sources}).code;
 assert.equal(outcome([{status:'unconfigured'}]),'unconfigured');
 assert.equal(outcome([{status:'unconfigured'},{status:'unsupported_party'}]),'unsupported');
 assert.equal(outcome([{status:'ok'},{status:'blocked'}]),'access_denied');
 assert.equal(outcome([{status:'rate_limited'}]),'rate_limited');
 assert.equal(outcome([{status:'ok',received:0,accepted:0}]),'no_matching_offers');
 assert.equal(outcome([{status:'ok',received:5,accepted:0}]),'rejected');
 assert.equal(outcome([{status:'error'}]),'unavailable');
});

test('regional source failures and zero airport coverage are preserved',()=>{
 assert.equal(emptySearchOutcome({offers:[],sources:[],coverage:{checked:[{sources:[{status:'auth'}]}]}}).code,'access_denied');
 assert.equal(emptySearchOutcome({offers:[],sources:[],coverage:{checked:[]}}).code,'no_airports');
 assert.equal(emptySearchOutcome({offers:[{price:100}],sources:[]}),null);
});
