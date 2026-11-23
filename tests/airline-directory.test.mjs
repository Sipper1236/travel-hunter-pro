import test from 'node:test';
import assert from 'node:assert/strict';
import {searchAirlineDirectory} from '../lib/airline-directory.mjs';

test('live airline lookup preserves IATA codes, merges duplicate designators, and cites its source',async()=>{
 let requested;
 const result=await searchAirlineDirectory('Example Carrier',{now:Date.parse('2026-11-06T12:00:00Z'),fetcher:async url=>{
  requested=new URL(url);
  return Response.json({results:{bindings:[
   {code:{value:'EX'},name:{value:'Example Carrier'}},
   {code:{value:'EX'},name:{value:'Example Regional'}},
   {code:{value:'12'},name:{value:'Example Numeric'}},
   {code:{value:'LONG'},name:{value:'Invalid Designator'}},
   {code:{value:'NO'},name:{value:''}},
  ]}});
 }});
 assert.match(requested.origin,/wikidata\.org$/);
 assert.match(requested.searchParams.get('query'),/wdt:P229/);
 assert.deepEqual(result.items,[
  {code:'12',name:'Example Numeric',otherNames:[]},
  {code:'EX',name:'Example Carrier',otherNames:['Example Regional']},
 ]);
 assert.equal(result.source,'Wikidata');assert.match(result.sourceUrl,/Property:P229/);assert.ok(result.observedAt);assert.match(result.limitation,/incomplete, ambiguous, historical/);
});

test('airline lookup rejects short and query-language input before any network call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({results:{bindings:[]}});};
 await assert.rejects(searchAirlineDirectory('A',{fetcher}),/at least two/);
 await assert.rejects(searchAirlineDirectory('AC" } SERVICE',{fetcher}),/Use letters/);
 assert.equal(calls,0);
});

test('cancelled airline lookup stops before dispatching a provider request',async()=>{
 const controller=new AbortController();controller.abort(new Error('query changed'));
 let calls=0;
 await assert.rejects(searchAirlineDirectory('Cancelled Directory Query',{fetcher:async()=>{calls++;return Response.json({results:{bindings:[]}});},signal:controller.signal}),/query changed/);
 assert.equal(calls,0);
});
