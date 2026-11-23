import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoutePairCandidates,MAX_ROUTE_PAIR_CANDIDATES} from '../lib/comparison-query.mjs';

const code=index=>`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`;

test('route-pair candidate generation stays inside the request payload cap and reports omitted pairs',()=>{
 const origins=Array.from({length:100},(_,index)=>code(index));
 const destinations=Array.from({length:100},(_,index)=>code(index+100));
 const result=buildRoutePairCandidates(origins,destinations,{origin:origins[0],destination:destinations[0]});
 assert.equal(result.pairs.length,MAX_ROUTE_PAIR_CANDIDATES);
 assert.equal(result.candidatePairs,9_999);
 assert.equal(result.omittedCandidatePairs,9_599);
 assert.equal(new Set(result.pairs.map(pair=>`${pair.origin}:${pair.destination}`)).size,result.pairs.length);
 assert.equal(result.pairs.some(pair=>pair.origin===origins[0]&&pair.destination===destinations[0]),false);
 assert.ok(new Set(result.pairs.map(pair=>pair.origin)).size>1,'bounded list should not spend its entire cap on the first origin');
});

test('route-pair candidates ignore invalid and duplicate codes and preserve zero-limit behavior',()=>{
 const result=buildRoutePairCandidates(['YHZ','YHZ','bad'],['LHR','LHR','YHZ'],{origin:'YHZ',destination:'LHR'},{limit:0});
 assert.deepEqual(result,{pairs:[],candidatePairs:0,omittedCandidatePairs:0});
});
