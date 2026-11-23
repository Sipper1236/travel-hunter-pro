import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupAirportCountries} from '../lib/airport-countries.mjs';
const bindings=rows=>Response.json({results:{bindings:rows.map(([code,countryCode])=>({code:{value:code},countryCode:{value:countryCode}}))}});
test('fresh original airport countries avoid Wikidata and unresolved codes use the independent fallback',async()=>{
 let calls=0;
 const countries=await lookupAirportCountries(['AAA','BBB'],{loadDirectory:async()=>({airports:[{code:'AAA',iso:'CA'}],cache:{status:'fresh'}}),fetcher:async url=>{calls++;const query=new URL(url).searchParams.get('query');assert.ok(query.includes('"BBB"'));assert.ok(!query.includes('"AAA"'));return bindings([['BBB','GB'],['AAA','US']]);}});
 assert.equal(calls,1);assert.equal(countries.get('AAA'),'CA');assert.equal(countries.get('BBB'),'GB');
 let fetched=false;const reused=await lookupAirportCountries(['AAA','BBB'],{loadDirectory:async()=>{fetched=true;throw Error();},fetcher:async()=>{fetched=true;throw Error();}});
 assert.equal(reused.size,2);assert.equal(fetched,false);
});
test('stale or conflicting directory countries do not become accepted geographic evidence',async()=>{
 for(const [code,directory] of [['CCC',{airports:[{code:'CCC',iso:'CA'}],cache:{status:'stale'}}],['DDD',{airports:[{code:'DDD',iso:'CA'},{code:'DDD',iso:'US'}],cache:{status:'fresh'}}]]){
  const countries=await lookupAirportCountries([code],{loadDirectory:async()=>directory,fetcher:async()=>bindings([])});assert.equal(countries.has(code),false);
 }
});
test('directory outage still allows an unambiguous independent country claim',async()=>{
 const countries=await lookupAirportCountries(['EEE'],{loadDirectory:async()=>{throw Error('offline');},fetcher:async()=>bindings([['EEE','FR']])});assert.equal(countries.get('EEE'),'FR');
});
