import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshSkyscanner, searchSkyscanner } from '../lib/skyscanner.mjs';
import {searchProviders} from '../lib/providers.mjs';

const input = { origin: 'YHZ', destination: 'BCN', date: '2099-04-15', adults: 1, cabin: 'economy', market: 'CA', currency: 'CAD', locale: 'en-CA' };
const response = status => ({ status, content: { results: {
  itineraries: { 'it-1': { legIds: ['leg-1'], pricingOptions: [{ price: { amount: '820.50',unit:'PRICE_UNIT_WHOLE' }, items: [{ deepLink: 'https://www.skyscanner.net/transport/flights/yhz/bcn/270415/' }] }] } },
  legs: { 'leg-1': { segmentIds: ['seg-1'], durationInMinutes: 1260 } },
  segments: { 'seg-1': { originPlaceId: 'place-yhz', destinationPlaceId: 'place-bcn', departureDateTime: { year: 2099, month: 4, day: 15, hour: 8, minute:0 }, arrivalDateTime: { year: 2099, month: 4, day: 16, hour: 10, minute:0 }, marketingFlightNumber: '123', marketingCarrierId: 'AC' } },
  places: { 'place-yhz': { iata: 'YHZ' }, 'place-bcn': { iata: 'BCN' } }, carriers: { AC: { iata: 'AC', name: 'Air Canada' } },
} } });

test('Skyscanner API Anything adapter creates, polls, and normalizes live-price results', async () => {
  const calls = [];
  const result = await searchSkyscanner(input, { loadTimezones: async()=>timeEvidence(), apiKey: 'key', sleep: async () => {}, fetcher: async (url, init) => {
    calls.push({ url, init });
    return Response.json(calls.length === 1 ? { sessionToken: 'session-123', status: 'RESULT_STATUS_INCOMPLETE' } : response('RESULT_STATUS_COMPLETE'));
  } });
  assert.equal(calls.length, 2, 'incomplete means poll again, rather than treating the substring complete as done');
  assert.equal(JSON.parse(calls[0].init.body).query.currency, 'CAD');
  assert.match(calls[1].url, /search\/poll\/session-123$/);
  assert.equal(result.complete, true);
  assert.equal(result.offers[0].price, 820.5);
  assert.equal(result.offers[0].currency, 'CAD');
  assert.equal(result.offers[0].airlines[0], 'Air Canada');
  assert.equal(result.offers[0].sourceUrl, 'https://www.skyscanner.net/transport/flights/yhz/bcn/270415/');
});

test('Skyscanner refresh reprices one itinerary within its original session', async () => {
  const calls = [];
  const result = await refreshSkyscanner({ ...input, sessionToken: 'session-123', itineraryId: 'it-1' }, { loadTimezones: async()=>timeEvidence(), apiKey: 'key', sleep: async () => {}, fetcher: async (url, init) => {
    calls.push({ url, init });
    return Response.json(calls.length === 1 ? { ...response('RESULT_STATUS_COMPLETE'), refreshSessionToken: 'refresh-1' } : response('RESULT_STATUS_COMPLETE'));
  } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /itineraryrefresh\/create\/session-123-cells1$/);
  assert.equal(JSON.parse(calls[0].init.body).itineraryId, 'it-1');
  assert.equal(result.status, 'refreshed');
  assert.equal(result.offers[0].price, 820.5);
});

function roundTripResponse(){
 const data=response('RESULT_STATUS_COMPLETE'),results=data.content.results;
 results.itineraries['it-1'].legIds.push('leg-return');results.legs['leg-return']={segmentIds:['seg-return'],durationInMinutes:660};
 results.segments['seg-return']={...results.segments['seg-1'],originPlaceId:'place-bcn',destinationPlaceId:'place-yhz',departureDateTime:{year:2099,month:4,day:22,hour:12,minute:0},arrivalDateTime:{year:2099,month:4,day:22,hour:18,minute:0}};
 return data;
}

test('Skyscanner sends two inverse query legs and retains the single round-trip quote and actual return',async()=>{
 let sent;const result=await searchSkyscanner({...input,tripType:'round-trip',returnDate:'2099-04-22',adults:2,children:1,childrenAges:[8]},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async(_url,init)=>{sent=JSON.parse(init.body);return Response.json({...roundTripResponse(),sessionToken:'offline-session'});}});
 assert.equal(sent.query.queryLegs.length,2);assert.equal(sent.query.queryLegs[1].originPlaceId.iata,'BCN');assert.equal(sent.query.queryLegs[1].destinationPlaceId.iata,'YHZ');assert.equal(sent.query.queryLegs[1].date.day,22);assert.deepEqual(sent.query.childrenAges,[8]);assert.equal(sent.query.adults,2);
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,820.5);assert.equal(result.offers[0].inbound.from,'BCN');assert.equal(result.offers[0].inbound.to,'YHZ');assert.equal(result.offers[0].inbound.departureDate,'2099-04-22');
});

test('Skyscanner refuses incomplete or mismatched returns, missing segment references and missing local times',async()=>{
 for(const alter of [data=>{delete data.content.results.segments['seg-return'];},data=>{data.content.results.segments['seg-return'].departureDateTime.day=21;},data=>{data.content.results.segments['seg-return'].destinationPlaceId='place-bcn';},data=>{delete data.content.results.segments['seg-1'].departureDateTime.hour;}]){
  const data=roundTripResponse();alter(data);
  const result=await searchSkyscanner({...input,tripType:'round-trip',returnDate:'2099-04-22'},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...data,sessionToken:'offline-session'})});assert.equal(result.offers.length,0);
 }
 let calls=0;await assert.rejects(searchSkyscanner({...input,tripType:'round-trip',returnDate:'2099-02-30'},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:()=>{calls++;}}),/return date/);assert.equal(calls,0);
});

test('Skyscanner polling merges additions and replaces results only on an explicit replacement',async()=>{
 for(const replace of [false,true]){
  const initial={...response('RESULT_STATUS_INCOMPLETE'),sessionToken:'offline-session'},next=response('RESULT_STATUS_COMPLETE');
  next.content.results.itineraries={'it-2':{...next.content.results.itineraries['it-1'],pricingOptions:[{price:{amount:'900.50',unit:'PRICE_UNIT_WHOLE'},items:[]}]}};
  if(replace)next.action='RESULT_ACTION_REPLACED';else for(const table of ['legs','segments','places','carriers'])delete next.content.results[table];
  let calls=0;const result=await searchSkyscanner(input,{loadTimezones:async()=>timeEvidence(),apiKey:'offline',sleep:async()=>{},fetcher:async()=>Response.json(++calls===1?initial:next)});
  assert.deepEqual(result.offers.map(offer=>offer.price),replace?[900.5]:[820.5,900.5]);assert.equal(calls,2);
 }
});

test('Skyscanner round-trip refresh retains both directions without a new search or booking',async()=>{
 const result=await refreshSkyscanner({...input,tripType:'round-trip',returnDate:'2099-04-22',sessionToken:'offline-session',itineraryId:'it-1'},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...roundTripResponse(),refreshSessionToken:'offline-refresh'})});
 assert.equal(result.status,'refreshed');assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound.departureDate,'2099-04-22');
});

test('shared flight router passes supported round trips to Skyscanner and preserves return filters',async()=>{
 const query={...input,tripType:'round-trip',returnDate:'2099-04-22',source:'skyscanner'};let requested,forwarded;
 const result=await searchProviders(query,{searchSkyscanner:async(q,options)=>{requested=q;forwarded=options;return searchSkyscanner(q,{...options,loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...roundTripResponse(),sessionToken:'offline-session'})});}});
 assert.equal(forwarded.requireTimeEvidence,true);
 assert.equal(requested.returnDate,query.returnDate);assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound.from,'BCN');assert.equal(result.query.tripType,'round-trip');assert.equal(result.sources[0].status,'ok');
});

test('Skyscanner converts documented price units and refuses unknown units or fractional cents',async()=>{
 for(const [unit,amount,expected] of [['PRICE_UNIT_WHOLE','820.50',820.5],['PRICE_UNIT_CENTI','82050',820.5],['PRICE_UNIT_MILLI','820500',820.5],['PRICE_UNIT_MICRO','820500000',820.5],['PRICE_UNIT_UNSPECIFIED','820500',null],['NEW_UNIT','82050',null],['PRICE_UNIT_MILLI','820501',null],[undefined,'820.50',null]]){
  const data={...response('RESULT_STATUS_COMPLETE'),sessionToken:'offline-session'};data.content.results.itineraries['it-1'].pricingOptions[0].price={amount,unit};
  const result=await searchSkyscanner(input,{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json(data)});
  assert.equal(result.offers[0]?.price??null,expected,`${unit} ${amount}`);
 }
});

test('Skyscanner failed searches never publish earlier quotes and cancellation prevents provider work',async()=>{
 let calls=0;await assert.rejects(searchSkyscanner(input,{loadTimezones:async()=>timeEvidence(),apiKey:'offline',sleep:async()=>{},fetcher:async()=>Response.json(++calls===1?{...response('RESULT_STATUS_INCOMPLETE'),sessionToken:'offline-session'}:response('RESULT_STATUS_FAILED'))}),error=>error.sourceStatus==='temporarily_unavailable');assert.equal(calls,2);
 const controller=new AbortController();controller.abort(Error('cancelled'));calls=0;
 await assert.rejects(searchSkyscanner(input,{loadTimezones:async()=>timeEvidence(),apiKey:'offline',signal:controller.signal,fetcher:async()=>{calls++;return Response.json({});}}),/cancelled/);assert.equal(calls,0);
});

const timeEvidence=()=>({byCode:new Map([['YHZ',{timeZone:'America/Halifax'}],['BCN',{timeZone:'Europe/Madrid'}],['NRT',{timeZone:'Asia/Tokyo'}],['LAX',{timeZone:'America/Los_Angeles'}]]),sourceUrl:'https://example.com/timezone-test-fixture',retrievedAt:'2026-11-05T00:00:00Z'});
test('Skyscanner search and refresh attach validated UTC time evidence to both directions',async()=>{
 const query={...input,tripType:'round-trip',returnDate:'2099-04-22'};
 const options={requireTimeEvidence:false,loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...roundTripResponse(),sessionToken:'offline-session',refreshSessionToken:'refresh-offline'})};
 const searched=await searchSkyscanner(query,options);assert.equal(searched.offers.length,1);assert.equal(searched.offers[0].segments[0].departure_time_utc,'2099-04-15T11:00:00Z');assert.ok(searched.offers[0].inbound.segments[0].arrival_time_utc.endsWith('Z'));assert.equal(searched.offers[0].timeEvidence.status,'directory_validated');assert.equal(searched.offers[0].durationMinutes,1260);
 const refreshed=await refreshSkyscanner({...query,sessionToken:'offline-session',itineraryId:'it-1'},options);assert.equal(refreshed.offers[0].timeEvidence.status,'directory_validated');
 let providerCalls=0;await assert.rejects(searchSkyscanner(query,{...options,loadTimezones:async()=>({...timeEvidence(),byCode:new Map()}),fetcher:async()=>{providerCalls++;return Response.json({});}}),/timezone evidence/);assert.equal(providerCalls,0,'missing route timezone evidence must fail before paid provider search');
});
test('Skyscanner refuses a journey when its reported duration conflicts with timezone-validated segments',async()=>{
 const data=roundTripResponse();data.content.results.legs['leg-1'].durationInMinutes++;
 const result=await searchSkyscanner({...input,tripType:'round-trip',returnDate:'2099-04-22'},{requireTimeEvidence:false,loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...data,sessionToken:'offline-session'})});
 assert.equal(result.offers.length,0);assert.equal(result.sources[0].received,1);assert.equal(result.sources[0].accepted,0);assert.equal(result.sources[0].rejected,1);
});
test('Skyscanner time-evidenced search accepts an earlier local arrival across the date line',async()=>{
 const data=response('RESULT_STATUS_COMPLETE'),r=data.content.results,s=r.segments['seg-1'];r.places['place-yhz'].iata='NRT';r.places['place-bcn'].iata='LAX';
 s.departureDateTime={year:2099,month:4,day:16,hour:1,minute:0};s.arrivalDateTime={year:2099,month:4,day:15,hour:18,minute:0};data.content.results.legs['leg-1'].durationInMinutes=540;
 const result=await searchSkyscanner({...input,origin:'NRT',destination:'LAX',date:'2099-04-16'},{requireTimeEvidence:false,loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async()=>Response.json({...data,sessionToken:'offline-session'})});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].arrivalDate,'2099-04-15');assert.ok(Date.parse(result.offers[0].segments[0].arrival_time_utc)>Date.parse(result.offers[0].segments[0].departure_time_utc));
});

test('native Skyscanner identified families use actual ages without sending identities or birthdays',async()=>{
 let sent;
 const travelers=[{id:'guardian',birthDate:'2060-01-01'},{id:'child',birthDate:'2089-05-01',guardianId:'guardian'}];
 const result=await searchSkyscanner({origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'round-trip',returnDate:'2099-04-22',travelers},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:async(_url,init)=>{sent=JSON.parse(init.body);return Response.json({...roundTripResponse(),sessionToken:'offline-session'});}});
 assert.equal(result.offers.length,1);assert.equal(sent.query.adults,1);assert.deepEqual(sent.query.childrenAges,[9]);assert.ok(!JSON.stringify(sent).includes('2089-05-01'));assert.ok(!JSON.stringify(sent).includes('guardian'));
 await assert.rejects(searchSkyscanner({origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'round-trip',returnDate:'2099-05-02',travelers},{loadTimezones:async()=>timeEvidence(),apiKey:'offline',fetcher:()=>{throw Error('must not request');}}),/changes age/);
 await assert.rejects(searchSkyscanner({origin:'YHZ',destination:'BCN',date:'2099-04-15',travelers:[travelers[0],{id:'infant',birthDate:'2098-05-01',guardianId:'guardian',infantSeating:'lap'}]},{apiKey:'offline'}),/infant seating/);
});
