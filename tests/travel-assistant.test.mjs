import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretTravelRequest} from '../lib/travel-assistant.mjs';
import {itineraryNotes} from '../lib/itinerary-notes.mjs';
test('suggests only supported high-confidence positive preferences',async()=>{
 const result=await interpretTravelRequest('A nonstop flight',{infer:async()=>({direct:{noul:0.96},business:{noul:0.15},hotel:{noul:0.6},return_trip:{noul:2}})});
 assert.deepEqual(result.suggestions.map(x=>x.key),['direct']);assert.match(result.limitation,/not applied/);
});
test('reports cold or unavailable model without inventing suggestions',async()=>{
 const result=await interpretTravelRequest('I need a hotel',{infer:async()=>null,status:()=> 'starting'});assert.equal(result.status,'starting');assert.deepEqual(result.suggestions,[]);
 await assert.rejects(interpretTravelRequest('x'));
});
test('itinerary notes require provider evidence',()=>{
 assert.deepEqual(itineraryNotes({via:[],departureDate:'2027-04-15',arrivalDate:'2027-04-15'}),[]);
 const notes=itineraryNotes({requiresSelfTransfer:true,via:['YUL'],departureDate:'2027-04-15',arrivalDate:'2027-04-16'});assert.equal(notes.length,3);
});

test('does not turn negated or unmentioned phrases into preferences',async()=>{
 const answers={direct:{noul:0.9},hotel:{noul:0.95},return_trip:{noul:0.9}};
 const r=await interpretTravelRequest('No direct flights and no hotel',{infer:async()=>answers});assert.deepEqual(r.suggestions,[]);
});
