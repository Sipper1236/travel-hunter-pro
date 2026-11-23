import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {SourceRequestError} from '../lib/source-errors.mjs';
import {buildMatrixUrl,makeMatrixBody,normalizeMatrix,parseMatrixBatch,parseMatrixMoney,resolveMatrixApiKey,searchMatrix,validateMatrixSearch} from '../lib/ita-matrix.mjs';
import {searchProviders} from '../lib/providers.mjs';
import {validateMatrixOptions,matrixDetailExpansionEligible} from '../lib/matrix-options.mjs';

const query={origin:'JFK',destination:'YYZ',departureDate:'2026-11-15',returnDate:'2026-12-08',currency:'CAD',cabin:'PREMIUM-COACH',passengers:{adults:1,youths:1,children:1}};
const testKey='AIza'+'A'.repeat(35);
const slice=(from,to,departure,arrival,flight)=>({origin:{code:from},destination:{code:to},departure,arrival,flights:[flight],cabins:['PREMIUM-COACH'],duration:120});
const raw={solutionList:{solutions:[{id:'sol-1',displayTotal:'CAD523.19',ext:{totalPrice:'CAD523.19'},passengerCount:3,pricings:[{ext:{pax:{adults:1,youth:1,children:1}}}],itinerary:{carriers:[{code:'EA',shortName:'Example Air'}],slices:[slice('JFK','YYZ','2026-11-15T10:00:00-05:00','2026-11-15T12:00:00-05:00','EA123'),slice('YYZ','JFK','2026-12-08T14:00:00-05:00','2026-12-08T16:00:00-05:00','EA456')]}}]}};

test('validates Matrix search and creates different API and SPA round-trip shapes',()=>{
 const body=makeMatrixBody(query);assert.equal(body.inputs.slices.length,2);assert.equal(body.inputs.pax.youth,1);assert.equal(body.inputs.pax.youths,undefined);assert.equal(body.inputs.pax.children,1);assert.equal(body.inputs.cabin,'PREMIUM-COACH');
 const url=buildMatrixUrl(query),state=JSON.parse(Buffer.from(new URL(url).searchParams.get('search'),'base64').toString());assert.equal(new URL(url).pathname,'/flights');assert.equal(state.slices.length,1);assert.equal(state.slices[0].dates.returnDate,'2026-12-08');assert.equal(state.options.cabin,'PREMIUM_COACH');assert.equal(state.pax.youth,'1');
 const calendar=buildMatrixUrl(query,{calendar:true,duration:23});assert.equal(new URL(calendar).pathname,'/calendar');assert.equal(JSON.parse(Buffer.from(new URL(calendar).searchParams.get('search'),'base64').toString()).slices[0].dates.duration,'23');
 assert.throws(()=>validateMatrixSearch({...query,departureDate:'2026-02-30'}),/departureDate/);assert.throws(()=>buildMatrixUrl(query,{calendar:true,duration:366}),/duration/);
});

test('Matrix API response body is capped before parsing oversized batch data',async()=>{
 let cancelled=false;
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(5_000_001)));},cancel(){cancelled=true;}}));
 await assert.rejects(searchMatrix({origin:'YHZ',destination:'YYZ',departureDate:'2026-11-15',currency:'CAD',cabin:'COACH',passengers:{adults:1}},{apiKey:testKey,fetcher:async()=>response}),error=>error.sourceStatus==='invalid_response');
 assert.equal(cancelled,true,'oversized batch bodies should be cancelled while streaming');
});

test('native Matrix browser response prechecks declared size and rejects oversized buffered bodies',async()=>{
 const {matrixResponseBody}=await import('../lib/matrix-browser.mjs');let bodyReads=0;
 await assert.rejects(matrixResponseBody({headers:()=>({'content-length':'5000001'}),body:async()=>{bodyReads++;return Buffer.from('{}');}}),error=>error.sourceStatus==='invalid_response');
 assert.equal(bodyReads,0,'declared oversized response should be refused before reading its body');
 await assert.rejects(matrixResponseBody({headers:()=>({}),body:async()=>Buffer.alloc(5_000_001)}),error=>error.sourceStatus==='invalid_response');
});

test('Matrix detail expansion is limited to fixed-date exact-airport economy searches',()=>{
 const base={origin:'YHZ',destination:'LAX',originType:'place',destinationType:'place',dateSearchMode:'dates',cabin:'economy',maxExtraLegsRelativeToMinimum:2};
 assert.equal(matrixDetailExpansionEligible(base),true);
 for(const input of [
  {...base,destination:'Europe',destinationType:'region'},
  {...base,dateSearchMode:'calendar'},
  {...base,cabin:'business'},
  {...base,maxExtraLegsRelativeToMinimum:3},
  {...base,destination:'YHZ'},
  {...base,origin:'Halifax'},
 ])assert.equal(matrixDetailExpansionEligible(input),false);
});

test('validates bounded Matrix route and detail controls and applies them to the source search',async()=>{
 assert.deepEqual(validateMatrixOptions(),{maxExtraLegsRelativeToMinimum:1,allowAirportChanges:true,expandDetailedItineraries:false});
 assert.deepEqual(validateMatrixOptions({maxExtraLegsRelativeToMinimum:5,allowAirportChanges:false,expandDetailedItineraries:true}),{maxExtraLegsRelativeToMinimum:5,allowAirportChanges:false,expandDetailedItineraries:true});
 assert.throws(()=>validateMatrixOptions({maxExtraLegsRelativeToMinimum:6}),/0 and 5/);
 assert.throws(()=>validateMatrixOptions({expandDetailedItineraries:'yes'}),/expand detailed itineraries/);
 const standard={origin:'YHZ',destination:'YYZ',date:'2026-11-15',tripType:'one-way',cabin:'economy',adults:1,children:0,source:'ita-matrix',matrixOptions:{maxExtraLegsRelativeToMinimum:3,allowAirportChanges:false,expandDetailedItineraries:true}};
 let sent;await searchProviders(standard,{searchMatrix:async input=>{sent=input;return {offers:[],sources:[]};}});
 assert.equal(sent.maxExtraLegsRelativeToMinimum,3);assert.equal(sent.allowAirportChanges,false);assert.equal(sent.expandDetailedItineraries,true);assert.equal(sent.currency,'CAD');
});

test('multipart response parser extracts one JSON part and fails closed on schema changes',()=>{
 const body='--b1\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(raw)+'\r\n--b1--\r\n';
 assert.deepEqual(parseMatrixBatch(body,'multipart/mixed; boundary=b1'),raw);assert.throws(()=>parseMatrixBatch('--b1--','multipart/mixed; boundary=b1'),/format changed/);
 assert.throws(()=>parseMatrixBatch(JSON.stringify({error:{code:403,status:'PERMISSION_DENIED',message:'private provider detail'}})),error=>error.sourceStatus==='blocked'&&error.httpStatus===403&&/PERMISSION_DENIED/.test(error.message)&&!error.message.includes('private provider detail'));
});

test('money parsing requires explicit currency and a positive amount',()=>{
 assert.deepEqual(parseMatrixMoney('CAD523.19'),{currency:'CAD',amount:523.19});assert.equal(parseMatrixMoney('$523.19'),null);assert.equal(parseMatrixMoney('CAD0'),null);
});

test('Matrix rejects malformed grouping and does not invent cabin evidence',()=>{
 for(const value of ['CAD1,23','CAD-123','CAD123.456','CAD1,,000'])assert.equal(parseMatrixMoney(value),null);
 assert.deepEqual(parseMatrixMoney('CAD1,234.50'),{currency:'CAD',amount:1234.5});
 const wrong=structuredClone(raw);wrong.solutionList.solutions[0].itinerary.slices[0].cabins=['BUSINESS'];
 const mismatch=normalizeMatrix(wrong,query);assert.equal(mismatch.offers.length,0);assert.equal(mismatch.priceObservations.length,0);
 const missing=structuredClone(raw);delete missing.solutionList.solutions[0].itinerary.slices[0].cabins;
 const unknown=normalizeMatrix(missing,query);assert.equal(unknown.offers.length,0);assert.equal(unknown.priceObservations.length,1);
});

test('normalizer only returns complete matching CAD itineraries',()=>{
 const result=normalizeMatrix(raw,query,new Date().toISOString());assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,523.19);assert.equal(result.offers[0].inbound.from,'YYZ');assert.equal(result.offers[0].segments[0].flight_number,'EA123');assert.equal(result.offers[0].segments[0].departure_time_local,'2026-11-15T10:00:00-05:00');assert.match(result.offers[0].sourceUrl,/matrix\.itasoftware\.com\/flights/);
 assert.equal(result.offers[0].travelers,'1 adult, 1 youth, 1 child');
 const bad=normalizeMatrix({solutionList:{solutions:[{id:'bad',displayTotal:'CAD10'}]}},query);assert.equal(bad.offers.length,0);assert.equal(bad.sources[0].rejected,1);
});

test('Matrix party labels pluralize each passenger category from the submitted counts',()=>{
 const party={...query,passengers:{adults:2,youths:2,children:2,seniors:1,infantsInSeat:1,infantsInLap:1}};
 const scoped=structuredClone(raw);scoped.solutionList.solutions[0].passengerCount=9;scoped.solutionList.solutions[0].pricings=[{ext:{pax:{adults:2,youth:2,children:2,seniors:1,infantsInSeat:1,infantsInLap:1}}}];
 const result=normalizeMatrix(scoped,party,new Date().toISOString());
 assert.equal(result.offers[0].travelers,'2 adults, 2 youths, 2 children, 1 senior, 1 infant in seat, 1 lap infant');
});

test('shows a scoped CAD price when Matrix returns connecting flights without fully verifiable legs',()=>{
 const connected=structuredClone(raw),solution=connected.solutionList.solutions[0];solution.itinerary.carriers.push({code:'ZZ',shortName:'Other Air'});solution.itinerary.slices[0].flights=['EA123','ZZ456'];
 const result=normalizeMatrix(connected,query,new Date().toISOString());assert.equal(result.offers.length,0);assert.equal(result.priceObservations.length,1);assert.equal(result.priceObservations[0].price,523.19);assert.equal(result.priceObservations[0].currency,'CAD');assert.equal(result.priceObservations[0].itineraryVerified,false);assert.equal(result.priceObservations[0].travelers,'1 adult, 1 youth, 1 child');assert.match(result.priceObservations[0].details,/could not be validated/);
 const mismatched=structuredClone(connected);mismatched.solutionList.solutions[0].itinerary.slices[0].origin.code='LAX';assert.equal(normalizeMatrix(mismatched,query).priceObservations.length,0);
 const unknownCurrency=structuredClone(connected);unknownCurrency.solutionList.solutions[0].displayTotal='$523.19';assert.equal(normalizeMatrix(unknownCurrency,query).priceObservations.length,0);
});

test('search uses the resolved backend key and does not retry its POST',async()=>{
 let calls=0,requestUrl;const responseBody='--b1\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(raw)+'\r\n--b1--\r\n';
 const result=await searchMatrix(query,{apiKey:testKey,fetcher:async(url,init)=>{calls++;requestUrl=String(url);assert.equal(init.method,'POST');assert.ok(init.body.includes(`POST /v1/search?key=${testKey}`));return new Response(responseBody,{headers:{'content-type':'multipart/mixed; boundary=b1'}});}});
 assert.equal(calls,1);assert.equal(new URL(requestUrl).hostname,'content-alkalimatrix-pa.googleapis.com');assert.equal(result.offers.length,1);
});

test('discovers and privately caches the key from the official Matrix page',async()=>{
 const old=process.env.ITA_MATRIX_API_KEY,path=join('/tmp/opencode',`ita-matrix-${randomUUID()}`,'api-key.json');delete process.env.ITA_MATRIX_API_KEY;let calls=0;
 try{const fetcher=async()=>{calls++;return new Response(`<html>E7.matrix="${testKey}"</html>`,{headers:{'content-type':'text/html'}});};assert.equal(await resolveMatrixApiKey({fetcher,cachePath:path}),testKey);assert.equal(await resolveMatrixApiKey({fetcher:async()=>{throw Error('cached key should avoid a request');},cachePath:path}),testKey);assert.equal(calls,1);}finally{if(old===undefined)delete process.env.ITA_MATRIX_API_KEY;else process.env.ITA_MATRIX_API_KEY=old;await rm(dirname(path),{recursive:true,force:true});}
});

test('searches Matrix and its linked Alkali bundle, but skips unrelated script hosts',async()=>{
 const old=process.env.ITA_MATRIX_API_KEY,path=join('/tmp/opencode',`ita-matrix-${randomUUID()}`,'api-key.json');delete process.env.ITA_MATRIX_API_KEY;const requested=[];
 try{const key=await resolveMatrixApiKey({cachePath:path,fetcher:async url=>{requested.push(String(url));return new URL(String(url)).pathname==='/'?new Response('<script src="https://www.gstatic.com/alkali/test.js"></script><script src="https://evil.example/x.js"></script>'):new Response(`const config={peopleApi:"${'AIza'+'B'.repeat(35)}"}; E7.matrix="${testKey}";`);}});assert.equal(key,testKey);assert.deepEqual(requested,['https://matrix.itasoftware.com','https://www.gstatic.com/alkali/test.js']);}finally{if(old===undefined)delete process.env.ITA_MATRIX_API_KEY;else process.env.ITA_MATRIX_API_KEY=old;await rm(dirname(path),{recursive:true,force:true});}
});

test('key discovery ignores unrelated API keys and refuses a page without Matrix configuration',async()=>{
 const old=process.env.ITA_MATRIX_API_KEY,path=join('/tmp/opencode',`ita-matrix-${randomUUID()}`,'api-key.json');delete process.env.ITA_MATRIX_API_KEY;
 try{await assert.rejects(resolveMatrixApiKey({fetcher:async()=>new Response(`<html>unrelated=${'AIza'+'B'.repeat(35)}</html>`),cachePath:path}),error=>error instanceof SourceRequestError&&error.sourceStatus==='temporarily_unavailable');}finally{if(old===undefined)delete process.env.ITA_MATRIX_API_KEY;else process.env.ITA_MATRIX_API_KEY=old;await rm(dirname(path),{recursive:true,force:true});}
});

test('Matrix access errors fail closed without another request',async()=>{
 let calls=0;for(const [status,sourceStatus] of [[403,'blocked'],[429,'rate_limited'],[500,'temporarily_unavailable']])await assert.rejects(searchMatrix(query,{apiKey:testKey,fetcher:async()=>{calls++;return new Response('denied',{status});}}),error=>error instanceof SourceRequestError&&error.sourceStatus===sourceStatus);assert.equal(calls,3);
});

test('fresh Matrix API responses are reused across worker processes without another provider request',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-matrix-cache-')),database=join(directory,'jobs.sqlite');
 const input={...query,passengers:{adults:1}},response=structuredClone(raw);
 response.solutionList.solutions[0].passengerCount=1;
 response.solutionList.solutions[0].pricings[0].ext.pax={adults:1};
 const script=`import {searchMatrix} from './lib/ita-matrix.mjs';let calls=0;globalThis.fetch=async()=>{calls++;return new Response(process.env.MATRIX_RESPONSE,{headers:{'content-type':'application/json'}})};const result=await searchMatrix(JSON.parse(process.env.MATRIX_QUERY),{apiKey:process.env.MATRIX_TEST_KEY,now:()=>Number(process.env.MATRIX_CACHE_NOW)||Date.now()});console.log(JSON.stringify({calls,cached:result.sources[0]?.cached===true,cacheClock:Date.now()}));`;
 const run=({search=input,key=testKey,cacheNow}={})=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),encoding:'utf8',timeout:10000,env:{...process.env,TRAVEL_JOB_DB:database,MATRIX_TEST_KEY:key,MATRIX_QUERY:JSON.stringify(search),MATRIX_RESPONSE:JSON.stringify(response),MATRIX_CACHE_NOW:cacheNow?String(cacheNow):''}}));
 try{
  const first=run();assert.deepEqual({calls:first.calls,cached:first.cached},{calls:1,cached:false});
  const second=run();assert.equal(second.calls,0);assert.equal(second.cached,true);assert.ok(Number.isFinite(second.cacheClock));
  const expired=run({cacheNow:first.cacheClock+300_001});assert.deepEqual({calls:expired.calls,cached:expired.cached},{calls:1,cached:false});
  const differentQuery=run({search:{...input,pageSize:49}});assert.deepEqual({calls:differentQuery.calls,cached:differentQuery.cached},{calls:1,cached:false});
  const differentKey=run({key:'AIza'+'B'.repeat(35)});assert.deepEqual({calls:differentKey.calls,cached:differentKey.cached},{calls:1,cached:false});
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('Matrix default fetch uses shared pacing and records multipart refusals',async()=>{
 const previousFetch=globalThis.fetch,previousStore=globalThis.__travelFlightJobStore;let reservations=0,deferred;
 globalThis.__travelFlightJobStore={reserveSource:()=>{reservations++;return {waitMs:0};},deferSource:(...args)=>{deferred=args;}};
 globalThis.fetch=async()=>Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED'}});
 try{await assert.rejects(searchMatrix({...query,passengers:{adults:1},pageSize:7},{apiKey:testKey}),error=>error.sourceStatus==='rate_limited');assert.equal(reservations,1);assert.equal(deferred[0],'ITA Matrix');assert.equal(deferred[2],'rate_limited');}finally{globalThis.fetch=previousFetch;if(previousStore===undefined)delete globalThis.__travelFlightJobStore;else globalThis.__travelFlightJobStore=previousStore;}
});

test('Matrix is an optional source and maps actual child ages to source categories',async()=>{
 const q={origin:'YHZ',destination:'BCN',date:'2099-04-15',adults:1,children:0,source:'ita-matrix'};
 const observation={provider:'ITA Matrix',price:100,currency:'CAD',observedAt:new Date().toISOString()};const result=await searchProviders(q,{searchMatrix:async()=>({offers:[],priceObservations:[observation],sources:[{provider:'ITA Matrix',status:'ok',received:0,accepted:0}]})});assert.equal(result.sources[0].provider,'ITA Matrix');assert.deepEqual(result.priceObservations,[observation]);
 let sent;await searchProviders({...q,children:2,childrenAges:[8,14]},{searchMatrix:async input=>{sent=input;return {offers:[],sources:[]};}});assert.deepEqual(sent.passengers,{adults:1,children:1,youths:1});
 const infant={origin:'YHZ',destination:'BCN',date:'2099-04-15',tripType:'one-way',source:'ita-matrix',travelers:[{id:'adult',birthDate:'2070-01-01'},{id:'baby',birthDate:'2098-01-01',guardianId:'adult',infantSeating:'lap'}]};
 await searchProviders(infant,{searchMatrix:async input=>{sent=input;return {offers:[],sources:[]};}});assert.deepEqual(sent.passengers,{adults:1,infantsInLap:1});
});

test('Matrix observations pass through the existing shared flight result validator',async()=>{
 const q={origin:'JFK',destination:'YYZ',date:'2026-11-15',returnDate:'2026-12-08',tripType:'round-trip',cabin:'premium_economy',adults:1,children:0,source:'ita-matrix'};
 const observation=normalizeMatrix(raw,{...query,departureDate:q.date,returnDate:q.returnDate},new Date().toISOString());
 const result=await searchProviders(q,{searchMatrix:async()=>observation});assert.equal(result.offers.length,1);assert.equal(result.offers[0].provider,'ITA Matrix');assert.equal(result.offers[0].inbound.departureDate,q.returnDate);
});

test('Matrix refuses wrong party echoes and never substitutes a per-person amount',()=>{
 for(const mutate of [s=>s.passengerCount=1,s=>s.pricings[0].ext.pax.children=2,s=>s.ext.totalPrice='CAD100.00']){const x=structuredClone(raw);mutate(x.solutionList.solutions[0]);assert.equal(normalizeMatrix(x,query).offers.length,0);assert.equal(normalizeMatrix(x,query).priceObservations.length,0);}
});

test('Matrix maps identified families and rejects category changes across observed flight dates',async()=>{
 const {matrixParty}=await import('../lib/travelers.mjs');
 const q={date:'2099-04-15',returnDate:'2099-04-20',tripType:'round-trip',travelers:[{id:'p',birthDate:'2070-01-01'},{id:'teen',birthDate:'2085-01-01',guardianId:'p'},{id:'child',birthDate:'2091-01-01',guardianId:'p'}]};
 assert.deepEqual(matrixParty(q),{adults:1,youths:1,children:1});
 assert.throws(()=>matrixParty({...q,travelers:[q.travelers[0],{id:'child',birthDate:'2087-04-21',guardianId:'p'}]},['2099-04-15','2099-04-21']),/changes Matrix/);
 const lapParty=matrixParty({...q,travelers:[q.travelers[0],{id:'baby',birthDate:'2098-01-01',guardianId:'p',infantSeating:'lap'}]});
 assert.deepEqual(lapParty,{adults:1,infantsInLap:1});
 const seatedParty=matrixParty({...q,travelers:[q.travelers[0],{id:'baby',birthDate:'2098-01-01',guardianId:'p',infantSeating:'seat'}]});
 assert.deepEqual(seatedParty,{adults:1,infantsInSeat:1});
 assert.throws(()=>matrixParty({...q,travelers:[q.travelers[0],{id:'baby',birthDate:'2097-04-18',guardianId:'p',infantSeating:'lap'}]}),/changes Matrix/);
 assert.throws(()=>matrixParty({...q,travelers:[q.travelers[0],{id:'baby',birthDate:'2098-01-01',guardianId:'p',infantSeating:'lap'},{id:'baby-2',birthDate:'2098-02-01',guardianId:'p',infantSeating:'lap'}]}),/more than one lap infant/);
 assert.throws(()=>matrixParty({date:q.date,returnDate:q.returnDate,tripType:'round-trip',adults:1,children:1,childrenAges:[11]}),/birth dates/);
});
test('Matrix uses its documented 62+ senior boundary and refuses a birthday crossing it',async()=>{
 const {matrixParty}=await import('../lib/travelers.mjs');
 const base={date:'2099-04-15',tripType:'one-way'};
 assert.deepEqual(matrixParty({...base,travelers:[{id:'traveler',birthDate:'2038-04-15'}]}),{adults:1});
 assert.deepEqual(matrixParty({...base,travelers:[{id:'traveler',birthDate:'2037-04-15'}]}),{seniors:1});
 assert.throws(()=>matrixParty({date:'2099-04-15',returnDate:'2099-04-16',tripType:'round-trip',travelers:[{id:'traveler',birthDate:'2037-04-16'}]}),/changes Matrix fare category/);
});

test('Matrix family capability admits exact identified infant seating while fare eligibility stays unverified',async()=>{
 const {providerCapabilities}=await import('../lib/provider-capabilities.mjs');
 const query={origin:'YHZ',destination:'YYZ',date:'2099-04-15',returnDate:'2099-04-20',tripType:'round-trip',cabin:'economy',travelers:[{id:'adult',birthDate:'2070-01-01'},{id:'infant',birthDate:'2098-01-01',guardianId:'adult',infantSeating:'lap'}]};
 const row=providerCapabilities(query,{configured:{'ita-matrix':true}}).find(item=>item.id==='ita-matrix');
 assert.equal(row.status,'eligible');
 assert.match(row.reason,/infant/i);
 assert.match(row.reason,/unverified/i);
});

test('Matrix browser timeouts are route-local while caller cancellation preserves its reason',async()=>{
 const {matrixBrowserSearch}=await import('../lib/matrix-browser.mjs');
 const options={policy:null,browserFactory:async()=>{const error=Error('browser details');error.name='TimeoutError';throw error;}};
 await assert.rejects(matrixBrowserSearch({...query,cabin:'COACH'},options),error=>error.sourceStatus==='temporarily_unavailable'&&error.providerCode==='native_query_timeout'&&!error.message.includes('browser details'));
 await assert.rejects(matrixBrowserSearch({...query,cabin:'COACH',passengers:{adults:1,infantsInLap:1}},options),error=>error.sourceStatus==='temporarily_unavailable'&&error.providerCode==='native_query_timeout');
 const controller=new AbortController(),reason=Error('cancelled by caller');controller.abort(reason);
 await assert.rejects(matrixBrowserSearch({...query,cabin:'COACH'},{...options,signal:controller.signal}),error=>error===reason);
});

test('explicit Matrix detail expansion returns the matched connecting itinerary with its observed group price',async()=>{
 const {readFile}=await import('node:fs/promises'),fixture=JSON.parse(await readFile(new URL('./fixtures/matrix-connection.json',import.meta.url),'utf8'));
 const summary=structuredClone(fixture.summary),details=structuredClone(fixture.details);
 for(const item of [summary,details]){item.passengerCount=1;item.pricings=[{ext:{pax:{adults:1}}}];}
 for(const slice of details.itinerary.slices)for(const segment of slice.segments)segment.bookingInfos=[segment.bookingInfos[0]];
 let observed;
 const result=await searchMatrix({origin:'YVR',destination:'IST',departureDate:'2099-11-10',returnDate:'2099-11-15',passengers:{adults:1},cabin:'COACH',currency:'CAD',maxExtraLegsRelativeToMinimum:2,allowAirportChanges:false,expandDetailedItineraries:true},{browserSearch:async(input)=>{observed=input;return {session:'s1',solutionSet:'ss1',solutionList:{solutions:[{...summary,matrixDetails:details}]},matrixDetailCoverage:{needed:1,requested:1,received:1,limit:3,failed:0}};}});
 assert.equal(observed.maxExtraLegsRelativeToMinimum,2);assert.equal(observed.allowAirportChanges,false);
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,10579.11);assert.equal(result.offers[0].inbound.via[0],'SEA');
 assert.equal(result.offers[0].inbound.segments.length,2);assert.equal(result.offers[0].inbound.segments[1].flight_number,'8811');
 assert.deepEqual(result.sources[0].detailCoverage,{needed:1,requested:1,received:1,limit:3,failed:0});
});

test('Matrix detail expansion refuses cabin or stop settings the live form cannot represent',async()=>{
 let calls=0;const browserSearch=async()=>{calls++;return {solutionList:{solutions:[]}};};
 await assert.rejects(searchMatrix({origin:'YVR',destination:'IST',departureDate:'2099-11-10',passengers:{adults:1},cabin:'BUSINESS',expandDetailedItineraries:true},{browserSearch}),/only for economy/);
 await assert.rejects(searchMatrix({origin:'YVR',destination:'IST',departureDate:'2099-11-10',passengers:{adults:1},cabin:'COACH',maxExtraLegsRelativeToMinimum:3,expandDetailedItineraries:true},{browserSearch}),/only through two extra stops/);
 assert.equal(calls,0);
});

test('Matrix validates captured connecting-flight details and retains exact layover evidence',async()=>{
 const {readFile}=await import('node:fs/promises');const fixture=JSON.parse(await readFile(new URL('./fixtures/matrix-connection.json',import.meta.url),'utf8'));
 const q={origin:'YVR',destination:'IST',departureDate:'2099-11-10',returnDate:'2099-11-15',passengers:{adults:1,youths:1,children:1},cabin:'COACH',currency:'CAD'};
 const source={solutionList:{solutions:[{...fixture.summary,matrixDetails:fixture.details}]}};const r=normalizeMatrix(source,q);
 assert.equal(r.offers.length,1);assert.equal(r.offers[0].price,10579.11);assert.deepEqual(r.offers[0].inbound.via,['SEA']);
 const segments=r.offers[0].inbound.segments;assert.equal(segments.length,2);assert.equal((Date.parse(segments[1].departure_time_utc)-Date.parse(segments[0].arrival_time_utc))/60000,115);
 const {filterOffers,validateFilters}=await import('../lib/flight-filters.mjs');
 assert.equal(filterOffers(r.offers,validateFilters({minLayover:115,maxLayover:115})).offers.length,1);
 for(const filters of [{maxLayover:114},{minLayover:116},{maxStops:0},{airlinesExclude:['AC']}])assert.equal(filterOffers(r.offers,validateFilters(filters)).offers.length,0);
 assert.equal(filterOffers(r.offers,validateFilters({countriesExclude:['US']}),new Map([['SEA','US']])).offers.length,0);
});

test('Matrix never promotes details with substituted flights, party, cabin, or invalid connection evidence',async()=>{
 const {readFile}=await import('node:fs/promises');const fixture=JSON.parse(await readFile(new URL('./fixtures/matrix-connection.json',import.meta.url),'utf8'));
 const q={origin:'YVR',destination:'IST',departureDate:'2099-11-10',returnDate:'2099-11-15',passengers:{adults:1,youths:1,children:1},cabin:'COACH',currency:'CAD'};
 const mutations=[d=>d.id='other',d=>d.displayTotal='CAD1.00',d=>d.passengerCount=1,d=>d.pricings[0].ext.pax.youth=2,d=>d.itinerary.slices[1].segments[1].flight.number=999,d=>d.itinerary.slices[1].segments[1].bookingInfos[0].cabin='BUSINESS',d=>d.itinerary.slices[1].segments[0].connection.duration=30,d=>d.itinerary.slices[1].segments[1].legs[0].departure='2099-11-15T19:05',d=>d.itinerary.slices[1].segments[1].legs[0].origin.code='LAX',d=>d.itinerary.slices[1].segments[1].legs[0].duration=1];
 for(const mutate of mutations){const details=structuredClone(fixture.details);mutate(details);const r=normalizeMatrix({solutionList:{solutions:[{...fixture.summary,matrixDetails:details}]}},q);assert.equal(r.offers.length,0);}
});
