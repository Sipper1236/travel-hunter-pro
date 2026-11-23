import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProviders } from '../lib/providers.mjs';
import { localRequest } from '../lib/local-request.mjs';
import {fetchSource} from '../lib/source-fetch.mjs';

const query = { origin: 'YHZ', destination: 'BCN', date: '2099-04-15', adults: 1, children: 0 };
const segment=(from,to,carrier='EA',number='EA123',date='2099-04-15',departure='09:00',arrival='18:00')=>({from,to,carrierCode:carrier,flightNumber:number,departureAt:`${date}T${departure}:00Z`,arrivalAt:`${date}T${arrival}:00Z`});
const fare = (price, provider, currency='CAD') => ({price,provider,currency,source:provider,observedAt:new Date().toISOString(),travelers:'1 adult',cabin:'economy',from:'YHZ',to:'BCN',departureDate:query.date,departureTime:'09:00',arrivalDate:query.date,arrivalTime:'18:00',durationMinutes:540,via:[],segments:[segment('YHZ','BCN')],airlines:['Example Air'],bookingStatus:'Unconfirmed observation',fees:'Inclusions unavailable'});
test('aggregates configured provider results without claiming exhaustive coverage', async () => {
  const result = await searchProviders(query, {
    searchGoogle: async () => ({ offers: [fare(200, 'Google Flights')], sources: [{ operation: 'search', status: 'ok' }] }),
    searchIgnav: async () => ({ offers: [fare(150, 'Ignav')], sources: [{ provider: 'Ignav', status: 'ok' }] }),
    searchExpedia: async () => ({ offers: [fare(180, 'Expedia')], sources: [{ provider: 'Expedia', status: 'ok' }] }),
    searchSkyscanner: async () => ({ offers: [fare(170, 'Skyscanner')], sources: [{ provider: 'Skyscanner', status: 'ok' }] }),
    searchAirCanada: async () => ({ offers: [fare(130, 'Air Canada NDC')], sources: [{ provider: 'Air Canada NDC', status: 'ok' }] }),
    searchMatrix: async () => ({offers: [], sources: [{provider:'ITA Matrix',status:'ok'}]}),
  });
  assert.deepEqual(result.offers.map(x => x.price), [130, 150, 170, 180, 200]);
  assert.equal(result.complete, false);
  assert.equal(result.sources.find(x => x.provider === 'Air Canada NDC').status, 'ok');
});

test('all-source search publishes a fast provider result before a slow source and caps concurrent adapters',async()=>{
 let releaseSlow,slowFinished=false,active=0,maxActive=0,resolveFast;
 const fastResult=new Promise(resolve=>{resolveFast=resolve;});
 const delayed=new Promise(resolve=>{releaseSlow=()=>{slowFinished=true;resolve({offers:[],sources:[{provider:'Ignav',status:'ok',received:0,accepted:0}]});};});
 const run=async search=>{active++;maxActive=Math.max(maxActive,active);try{return await search();}finally{active--;}};
 const pending=searchProviders({...query,source:'all'},{maxConcurrentProviders:2,
  searchGoogle:()=>run(async()=>({offers:[],sources:[{provider:'Google Flights',operation:'search',status:'ok',received:0,accepted:0}]})),
  searchIgnav:()=>run(()=>delayed),
  searchExpedia:()=>run(async()=>({offers:[fare(222,'Expedia')],sources:[{provider:'Expedia',status:'ok',received:1,accepted:1}]})),
  searchSkyscanner:()=>run(async()=>({offers:[],sources:[{provider:'Skyscanner',status:'ok',received:0,accepted:0}]})),
  searchAirCanada:()=>run(async()=>({offers:[],sources:[{provider:'Air Canada NDC',status:'ok',received:0,accepted:0}]})),
  searchMatrix:()=>run(async()=>({offers:[],sources:[{provider:'ITA Matrix',status:'ok',received:0,accepted:0}]})),
  searchOmkarExpedia:()=>run(async()=>({offers:[],sources:[{provider:'Expedia via Omkar',status:'ok',received:0,accepted:0}]})),
  onProviderResult:event=>{if(event.sourceId==='expedia')resolveFast(event);},
 });
 try{
  const event=await Promise.race([fastResult,new Promise((_,reject)=>setTimeout(()=>reject(Error('fast provider did not publish')),1500))]);
  assert.equal(event.result.offers[0].price,222);assert.equal(slowFinished,false,'the fast result must publish while Ignav is still pending');
  assert.equal(event.sourceCount,7);assert.ok(maxActive<=2,`observed ${maxActive} concurrent source calls`);
 }finally{releaseSlow();}
 const result=await pending;
 assert.equal(result.offers[0].price,222);assert.equal(result.sources.length,7);
});

test('source accepted counts reflect the final shared-filtered results',async()=>{
 const withCarrier=(provider,carrier)=>({...fare(250,provider),segments:[segment('YHZ','BCN',carrier)]});
 const result=await searchProviders({...query,source:'ignav',filters:{airlinesInclude:['AC']}},{searchIgnav:async()=>({offers:[withCarrier('Ignav','AC'),withCarrier('Ignav','DL')],sources:[{provider:'Ignav',status:'ok',received:2,accepted:2}]})});
 const source=result.sources.find(row=>row.provider==='Ignav');
 assert.equal(result.offers.length,1);
 assert.equal(source.received,2);
 assert.equal(source.accepted,1);
 assert.equal(source.filterRejected,1);
 assert.equal(result.filterCoverage.airline,1);
});

test('native Google search metrics include shared-filter results without rewriting diagnostics',async()=>{
 const input={...query,source:'google',tripType:'round-trip',returnDate:'2099-04-20',filters:{airlinesInclude:['AC']}};
 const withCarrier=(price,carrier)=>{
  const outbound={...fare(price,'Google Flights'),segments:[segment('YHZ','BCN',carrier)]};
  return {...outbound,inbound:{from:'BCN',to:'YHZ',departureDate:input.returnDate,departureTime:'09:00',arrivalDate:input.returnDate,arrivalTime:'18:00',durationMinutes:540,via:[],airlines:[carrier],segments:[segment('BCN','YHZ',carrier,'EA456',input.returnDate)]}};
 };
 const result=await searchProviders(input,{searchGoogleRoundTrip:async()=>({offers:[withCarrier(200,'AC'),withCarrier(180,'DL')],sources:[
  {provider:'Google Flights',status:'ok',received:2},
  {provider:'Google Flights',operation:'validation',status:'partial',rejected:1},
 ]})});
 const search=result.sources.find(source=>source.provider==='Google Flights'&&source.operation===undefined);
 const diagnostic=result.sources.find(source=>source.operation==='validation');
 assert.equal(result.offers.length,1);
 assert.equal(search.received,2);
 assert.equal(search.accepted,1);
 assert.equal(search.filterRejected,1);
 assert.equal(diagnostic.rejected,1);
 assert.equal(Object.hasOwn(diagnostic,'accepted'),false);
});

test('one-way Google search and top metrics remain scoped to their own operations',async()=>{
 const input={...query,source:'google',filters:{airlinesInclude:['AC']}};
 const withCarrier=(section,carrier)=>({...fare(250,'Google Flights'),section,segments:[segment('YHZ','BCN',carrier)]});
 const result=await searchProviders(input,{searchGoogle:async()=>({offers:[withCarrier('search','AC'),withCarrier('search','DL'),withCarrier('top','DL')],sources:[
  {operation:'search',status:'ok',received:2,accepted:2},
  {operation:'top',status:'ok',received:1,accepted:1},
 ]})});
 const search=result.sources.find(source=>source.operation==='search');
 const top=result.sources.find(source=>source.operation==='top');
 assert.equal(search.received,2);assert.equal(search.accepted,1);assert.equal(search.filterRejected,1);
 assert.equal(top.received,1);assert.equal(top.accepted,0);assert.equal(top.filterRejected,1);
});

test('provider dispatcher allows documented Expedia round-trip child-age requests without reducing the party',async()=>{
 const input={...query,tripType:'round-trip',returnDate:'2099-04-20',adults:2,children:1,childrenAges:[14],source:'expedia'};let seen;
 const outbound={...fare(1200,'Expedia'),travelers:'2 adults, 1 child (14)',durationMinutes:540};
 const inbound={...outbound,from:'BCN',to:'YHZ',departureDate:input.returnDate,departureTime:'09:00',arrivalDate:input.returnDate,arrivalTime:'18:00',segments:[segment('BCN','YHZ','EA','EA456',input.returnDate)]};
 const result=await searchProviders(input,{searchExpedia:async value=>{seen=value;return {offers:[{...outbound,inbound}],sources:[{provider:'Expedia',status:'ok'}]};}});
 assert.equal(seen.tripType,'round-trip');assert.equal(seen.returnDate,input.returnDate);assert.deepEqual(seen.childrenAges,[14]);
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound.departureDate,input.returnDate);
});

test('reports Ignav missing as unconfigured without attempting a network call', async () => {
  const previous = process.env.IGNAV_API_KEY;
  delete process.env.IGNAV_API_KEY;
  try {
    const result = await searchProviders(query, { searchGoogle: async () => ({ offers: [], sources: [{ operation: 'search', status: 'ok' }] }), searchMatrix: async () => ({offers: [], sources: []}) });
    assert.equal(result.sources[0].provider, 'Google Flights');
    assert.equal(result.sources.find(x => x.provider === 'Ignav').status, 'unconfigured');
  } finally { if (previous !== undefined) process.env.IGNAV_API_KEY = previous; }
});

test('single-source results carry sanitized HTTP latency metrics into the provider event',async()=>{
 let event;
 const result=await searchProviders({...query,source:'ignav'},{searchIgnav:async()=>{
  const response=await fetchSource('Ignav','https://ignav.example/api/fares/one-way',{},{fetcher:async()=>Response.json({ok:true}),policy:null});
  await response.json();return {offers:[],sources:[{provider:'Ignav',status:'ok',received:0,accepted:0}]};
 },onProviderResult:value=>{event=value;}});
 const metrics=result.transportCoverage.providers.Ignav;
 assert.equal(metrics.attempts,1);assert.equal(metrics.responses,1);assert.equal(metrics.requestLatency.samples,1);assert.ok(metrics.requestLatency.p95UpperBoundMs!==null);
 assert.deepEqual(event.result.transportCoverage,result.transportCoverage);assert.doesNotMatch(JSON.stringify(result),/ignav\.example|\/api\/fares|authorization/i);
});

test('paid API routes accept only same-origin loopback browser requests', () => {
  const req = (host, origin) => new Request(`http://${host}/api/search`, { headers: { host, origin } });
  assert.equal(localRequest(req('localhost:3000', 'http://localhost:3000')), true);
  assert.equal(localRequest(req('localhost:3000', 'https://evil.example')), false);
  assert.equal(localRequest(req('example.com', 'https://example.com')), false);
});

test('excludes non-CAD prices without conversion', async () => {
  const result = await searchProviders(query, {
    searchGoogle: async () => ({ offers: [fare(400, 'Google Flights')], sources: [] }),
    searchIgnav: async () => ({ offers: [fare(100, 'Ignav', 'USD'), fare(300, 'Ignav')], sources: [] }),
    searchMatrix: async () => ({offers: [], sources: []}),
  });
  assert.deepEqual(result.offers.map(x => [x.currency,x.price]), [['CAD',300],['CAD',400]]);
  assert.match(result.limitations.join(' '), /other currencies are excluded/);
});

test('rejects mismatched and incomplete observations before display and records why', async () => {
  const valid=fare(300,'Ignav');
  const result=await searchProviders({...query,source:'ignav'}, {searchIgnav:async()=>({offers:[valid,{...valid,from:'YYZ'},{...valid,observedAt:null},{...valid,cabin:'business'},{...valid,sourceUrl:'javascript:alert(1)'}],sources:[]})});
  assert.deepEqual(result.offers,[valid]);
  assert.deepEqual(result.schemaCoverage.Ignav,{route:1,quote_time:1,cabin:1,source_url:1});
  assert.equal(result.sources.find(s=>s.operation==='validation').rejected,4);
});
