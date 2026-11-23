import test from 'node:test';
import assert from 'node:assert/strict';
import {searchGoogleOneWay,searchGoogleRoundTrip} from '../lib/google-native.mjs';
import {googleFixtureBrowserFactory,googleTestTimezones} from './fixtures/google-native-site.mjs';
const query={origin:'YHZ',destination:'LHR',date:'2099-04-15',returnDate:'2099-04-20',tripType:'round-trip',cabin:'economy',adults:2,children:1,childrenAges:[15],filters:{}};
const options=(fixture={})=>({policy:null,browserFactory:googleFixtureBrowserFactory(fixture),loadTimezones:googleTestTimezones,timeoutMs:10000});
const oneWay={origin:'YHZ',destination:'LHR',date:'2099-04-15',tripType:'one-way',cabin:'economy',adults:1,children:0,filters:{}};
test('native one-way browser returns exact segment evidence and labels the price as unrefreshed',async()=>{
 const {tripType,...defaultedOneWay}=oneWay;
 const result=await searchGoogleOneWay(defaultedOneWay,{...options({mode:'one-way',directState:{adults:1,children:0,origin:oneWay.origin,destination:oneWay.destination,date:oneWay.date}})});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,1200);assert.equal(result.offers[0].currency,'CAD');
 assert.equal(result.offers[0].segments[0].flight_number,'860');assert.equal(result.offers[0].segments[0].departure_time_utc,'2099-04-15T11:00:00Z');
 assert.match(result.offers[0].bookingStatus,/not been rechecked/);assert.match(result.offers[0].fees,/not independently verified/);
 assert.equal(result.sources[0].nativeCoverage.nativeRpcRequests,1);assert.equal(result.sources[0].nativeCoverage.nativeRpcResponses,1);
 assert.equal(result.sources[0].nativeCoverage.validatedCandidates,1);assert.equal(result.sources[0].nativeCoverage.nativeRpcLatency.samples,1);
});
test('native one-way refuses source access checks and unsupported party sizes',async()=>{
 await assert.rejects(searchGoogleOneWay(oneWay,{...options({mode:'challenge'}),policy:{reserveSource:()=>({waitMs:0}),deferSource(){}}}),error=>error.sourceStatus==='blocked');
 await assert.rejects(searchGoogleOneWay({...oneWay,adults:2},options()),error=>error.sourceStatus==='unsupported_party');
 await assert.rejects(searchGoogleOneWay(oneWay,{...options({mode:'rate'}),policy:{reserveSource:()=>({waitMs:0}),deferSource(){}}}),error=>error.sourceStatus==='rate_limited');
});
test('native browser sends the full source party and returns only a completely selected group return',async()=>{
 const requests=[];const result=await searchGoogleRoundTrip(query,options({onRequest:request=>requests.push(request)}));
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,1200);assert.equal(result.offers[0].googleBookingMode,'phone');
 assert.equal(result.offers[0].inbound.departureDate,query.returnDate);assert.deepEqual(result.offers[0].googleParty,{adults:3,children:0,total:3});
 assert.deepEqual(requests.map(row=>row.stage),['outbound','return','booking']);assert.ok(requests.every(row=>row.state.adults===3&&row.state.children===0));
 assert.equal(result.sources[0].nativeCoverage.nativeRpcResponses,3);assert.equal(result.sources[0].nativeCoverage.outboundSelected,1);
 const latency=result.sources[0].nativeCoverage.nativeRpcLatency;
 assert.equal(latency.samples,3);assert.ok(latency.totalMs>=0);assert.equal(Object.values(latency.buckets).reduce((sum,count)=>sum+count,0),3);
 assert.ok(latency.p95UpperBoundMs===null||latency.p95UpperBoundMs>=0);
});
test('native identified child party exports categories rather than DOB or guardian identifiers',async()=>{
 const {adults,children,childrenAges,...base}=query;const requests=[];
 const result=await searchGoogleRoundTrip({...base,travelers:[{id:'adult',birthDate:'2070-01-01'},{id:'child',birthDate:'2090-05-01',guardianId:'adult'}]},options({onRequest:row=>requests.push(row)}));
 assert.equal(result.offers.length,1);assert.deepEqual(result.offers[0].googleParty,{adults:1,children:1,total:2});
 assert.ok(requests.every(row=>row.state.adults===1&&row.state.children===1));assert.ok(!JSON.stringify(requests).includes('birthDate'));
});
test('native quote labels singular traveler and fare categories correctly',async()=>{
 const result=await searchGoogleRoundTrip({...query,adults:1,children:0,childrenAges:[]},options());
 assert.equal(result.offers[0].travelers,'1 traveler; source fare categories: 1 adult, 0 children');
});
test('native response capture survives a full document navigation after selecting the outbound',async()=>{
 const result=await searchGoogleRoundTrip(query,options({mode:'navigate-return'}));
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound.departureDate,query.returnDate);
});
test('native access refusals and human checks stop without repeated supplier operations',async()=>{
 for(const [mode,status] of [['rate','rate_limited'],['challenge','blocked']]){
  let calls=0,deferred;await assert.rejects(searchGoogleRoundTrip(query,{...options({mode,onRequest:()=>calls++}),policy:{reserveSource:()=>({waitMs:0}),deferSource:(...args)=>deferred=args}}),error=>error.sourceStatus===status&&error.retryAt>Date.now());
  assert.equal(calls,0);assert.equal(deferred[0],'Google Flights');
 }
});
test('native mismatched return evidence is sanitized instead of becoming an offer',async()=>{
 await assert.rejects(searchGoogleRoundTrip(query,options({mode:'wrong-return'})),error=>error.sourceStatus==='invalid_response'&&!error.message.includes('tfs=')&&!error.message.includes('2099'));
});
test('empty native frames require an explicit source no-results statement',async()=>{
 await assert.rejects(searchGoogleRoundTrip(query,options({mode:'empty-frame'})),error=>error.providerCode==='native_direction_incomplete');
 const empty=await searchGoogleRoundTrip(query,options({mode:'no-flights'}));assert.equal(empty.offers.length,0);assert.equal(empty.sources[0].status,'ok');
});
test('native cancellation closes the browser and preserves the caller abort',async()=>{
 const controller=new AbortController(),reason=new Error('Controlled cancellation');
 await assert.rejects(searchGoogleRoundTrip(query,{...options(),signal:controller.signal,onStage:stage=>{if(stage==='party')controller.abort(reason);}}),error=>error===reason);
});
test('native fare request bound aborts excess browser traffic before it reaches the source',async()=>{
 let delivered=0;
 await assert.rejects(searchGoogleRoundTrip(query,options({mode:'request-bound',onRequest:()=>delivered++})),error=>error.providerCode==='native_request_bound'&&error.nativeCoverage.nativeRpcRequests===12);
 assert.ok(delivered<=12);
});
test('native overall deadline closes the browser and retains bounded attempt evidence',async()=>{
 await assert.rejects(searchGoogleRoundTrip(query,{...options(),timeoutMs:100}),error=>error.providerCode==='native_query_timeout'&&error.nativeCoverage.nativeRpcRequests===0);
});
test('native refresh keeps the exact originally selected flights and never substitutes another itinerary',async()=>{
 const first=await searchGoogleRoundTrip(query,options());
 const selected=first.offers[0].googleFlightSelection;
 const directState={adults:3,children:0,origin:query.origin,destination:query.destination,date:query.date,returnDate:query.returnDate};
 const refreshed=await searchGoogleRoundTrip(query,{...options({mode:'direct-refresh',directState}),selection:selected,bookingUrl:first.offers[0].sourceUrl});assert.equal(refreshed.offers[0].itineraryKey,first.offers[0].itineraryKey);
 assert.match(refreshed.sources[0].reason,/rechecked the original booking page/);
 const missing=structuredClone(selected);missing.outbound[0][3]='999';
 const unavailable=await searchGoogleRoundTrip(query,{...options(),selection:missing});assert.equal(unavailable.offers.length,0);assert.equal(unavailable.sources[0].nativeCoverage.outboundSelected,0);
 let opened=false;await assert.rejects(searchGoogleRoundTrip(query,{...options(),browserFactory:async()=>{opened=true;},selection:{outbound:[]}}),/exact observed/);assert.equal(opened,false);
 await assert.rejects(searchGoogleRoundTrip(query,{...options(),browserFactory:async()=>{opened=true;},bookingUrl:first.offers[0].sourceUrl}),/Exact originally observed/);assert.equal(opened,false);
 await assert.rejects(searchGoogleRoundTrip(query,{...options(),browserFactory:async()=>{opened=true;},selection:selected,bookingUrl:'https://example.test/travel/flights/booking?tfs=x&tfu=y&curr=CAD'}),/original Google booking page/);assert.equal(opened,false);
});
