import test from 'node:test';import assert from 'node:assert/strict';
import {providerCapabilities,configuredProviders} from '../lib/provider-capabilities.mjs';
import {POST} from '../app/api/search/capabilities/route.js';
test('round-trip families see exactly why each provider is excluded',()=>{
 const rows=providerCapabilities({tripType:'round-trip',start:'2099-04-15',end:'2099-04-15',nights:5,adults:2,children:1,childrenAges:[10]},{calendar:true,configured:{ignav:true,'ita-matrix':true}});
 assert.deepEqual(rows.filter(r=>r.eligible).map(r=>r.id),['ignav','ita-matrix']);assert.equal(rows.find(r=>r.id==='skyscanner').status,'unsupported_party');assert.equal(rows.find(r=>r.id==='ita-matrix').status,'eligible');
 assert.equal(providerCapabilities({tripType:'one-way',adults:1,children:0},{configured:{}}).find(r=>r.id==='ignav').status,'unconfigured');
 assert.equal(configuredProviders({IGNAV_API_KEY:'secret'}).ignav,true);
});
test('Expedia direct round trips admit documented group ages while flexible child calendars stay guarded',()=>{
 const exact={tripType:'round-trip',date:'2099-04-15',returnDate:'2099-04-20',adults:2,children:2,childrenAges:[8,14],cabin:'economy'};
 const row=providerCapabilities(exact,{configured:{expedia:true}}).find(provider=>provider.id==='expedia');assert.equal(row.eligible,true);assert.match(row.reason,/group totals/);
 const calendar=providerCapabilities({...exact,start:exact.date,end:exact.date,nights:5},{calendar:true,configured:{expedia:true}}).find(provider=>provider.id==='expedia');assert.equal(calendar.status,'unsupported_party');assert.match(calendar.reason,/recalculate child ages/);
 const boundary=providerCapabilities({...exact,childrenAges:[11,14]},{configured:{expedia:true}}).find(provider=>provider.id==='expedia');assert.equal(boundary.status,'unsupported_party');
});
test('capability endpoint is local-only and returns decisions without provider calls or secrets',async()=>{
 const query={tripType:'round-trip',adults:2,children:1};
 const request=local=>new Request('http://localhost/api/search/capabilities',{method:'POST',headers:{host:local?'localhost':'example.com',origin:local?'http://localhost':'https://example.com','content-type':'application/json'},body:JSON.stringify(query)});
 assert.equal((await POST(request(false))).status,403);const r=await POST(request(true));assert.equal(r.status,200);const body=await r.json();assert.equal(body.providers.length,7);assert.ok(body.providers.every(p=>!('key' in p)));
});

test('calendar budget uses configured eligible sources without trusting client source lists',async()=>{
 const {validateCalendarQuery}=await import('../lib/calendar-query.mjs');
 const input={source:'all',origin:'YHZ',destination:'LHR',start:'2099-04-01',end:'2099-04-30',tripType:'one-way',adults:1,children:0,cabin:'economy',searchLimit:30,eligibleProviderIds:['ignav']};
 const valid=validateCalendarQuery(input,{configured:{ignav:true}});assert.equal(valid.searchLimit,30);assert.equal(valid.eligibleProviderIds,undefined);
 assert.throws(()=>validateCalendarQuery(input),/210 exact/);
});

test('identified non-infant families can use Skyscanner without claiming infant support',()=>{
 const query={source:'all',start:'2099-04-15',tripType:'round-trip',travelers:[{id:'adult',birthDate:'2060-01-01'},{id:'child',birthDate:'2089-05-01',guardianId:'adult'}]};
 const row=providerCapabilities(query,{calendar:true,configured:{skyscanner:true}}).find(row=>row.id==='skyscanner');assert.equal(row.eligible,true);
 const infant=providerCapabilities({...query,travelers:[query.travelers[0],{id:'infant',birthDate:'2098-05-01',guardianId:'adult',infantSeating:'lap'}]},{calendar:true,configured:{skyscanner:true}}).find(row=>row.id==='skyscanner');assert.equal(infant.status,'unsupported_party');
});
test('native Google return access is separate from one-way access and preserves party restrictions',()=>{
 const query={origin:'Canada',destination:'Europe',tripType:'round-trip',start:'2099-04-15',end:'2099-04-16',nightsMin:5,nightsMax:6,cabin:'economy',adults:2,children:1,childrenAges:[15]};
 const config=configuredProviders({});assert.equal(config.google,true);assert.equal(config.googleRoundTrip,false);
 assert.equal(providerCapabilities(query,{calendar:true,configured:config}).find(row=>row.id==='google').status,'unconfigured');
 const enabled=configuredProviders({TRAVEL_GOOGLE_ROUND_TRIP:'1'});assert.equal(providerCapabilities(query,{calendar:true,configured:enabled}).find(row=>row.id==='google').eligible,true);
 assert.equal(providerCapabilities({...query,childrenAges:[11]},{calendar:true,configured:enabled}).find(row=>row.id==='google').status,'unsupported_party');
 assert.equal(providerCapabilities({...query,cabin:'business'},{calendar:true,configured:enabled}).find(row=>row.id==='google').eligible,false);
});
