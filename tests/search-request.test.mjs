import test from 'node:test';
import assert from 'node:assert/strict';
import {executeFlightSearch} from '../lib/search-request.mjs';

test('exact-airport Google round trips dispatch through the configured provider path',async()=>{
 const query={origin:'YHZ',destination:'LAX',originType:'place',destinationType:'place',date:'2099-11-12',returnDate:'2099-11-19',tripType:'round-trip',adults:1,children:0,cabin:'economy',source:'google'};
 let dispatched;
 const result=await executeFlightSearch(query,{searchLocationsImpl:async(input,detections)=>{dispatched={input,detections};return {offers:[],sources:[{provider:'Google Flights',status:'ok'}]};}});
 assert.equal(dispatched.input,query);
 assert.deepEqual(dispatched.detections,{origin:{type:'place',kind:'airport',method:'Three-letter code; source will validate it'},destination:{type:'place',kind:'airport',method:'Three-letter code; source will validate it'}});
 assert.equal(result.sources[0].provider,'Google Flights');
});

test('auto-detected named region policy survives into expanded-search dispatch',async()=>{
 const query={origin:'Scandinavia',destination:'YYZ',originType:'auto',destinationType:'place',date:'2099-11-12',returnDate:'2099-11-19',tripType:'round-trip',adults:1,children:0,cabin:'economy',source:'ignav'};
 let detections;
 const result=await executeFlightSearch(query,{searchLocationsImpl:async(_input,found)=>{detections=found;return {offers:[],sources:[]};}});
 assert.equal(detections.origin.type,'region');
 assert.equal(detections.origin.method,'Versioned local geographic policy');
 assert.match(detections.origin.policyNote,/Nordic Council/);
 assert.equal(result.originDetection.canonicalName,'Scandinavia');
});

test('GCC automatic airport detection and explicit region selection retain distinct policy provenance',async()=>{
 const base={origin:'YHZ',destination:'GCC',originType:'place',date:'2099-11-12',tripType:'one-way',adults:1,children:0,cabin:'economy',source:'ignav'};
 let automatic;
 await executeFlightSearch({...base,destinationType:'auto'},{searchLocationsImpl:async(_input,found)=>{automatic=found.destination;return {offers:[],sources:[]};}});
 assert.deepEqual(automatic,{type:'place',kind:'airport',method:'Three-letter code; source will validate it'});
 let selected;
 const result=await executeFlightSearch({...base,destinationType:'region'},{searchLocationsImpl:async(_input,found)=>{selected=found.destination;return {offers:[],sources:[]};}});
 assert.equal(selected.type,'region');
 assert.equal(selected.method,'Versioned local geographic policy');
 assert.match(selected.policyNote,/six Gulf Cooperation Council members/);
 assert.equal(selected.source,'https://www.gcc-sg.org/en/AboutUs/MemberStates/Pages/default.aspx');
 assert.match(selected.policyVersion,/^UNSD-M49-/);
 assert.equal(result.destinationDetection.method,'Versioned local geographic policy');
});
