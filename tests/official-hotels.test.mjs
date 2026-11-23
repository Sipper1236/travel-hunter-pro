import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectOfficialHotel,discoverOfficialHotels} from '../lib/official-hotels.mjs';
import {searchReservit,reservitQuote} from '../lib/reservit.mjs';
import {searchOfficialStays} from '../lib/official-hotel-search.mjs';
import {validateStay} from '../lib/booking-browser.mjs';
import {SourceRequestError} from '../lib/source-errors.mjs';
import {compareFlightHotel} from '../lib/flight-hotel.mjs';
import {createJobStore} from '../lib/job-store.mjs';
const destination={city:'Example',cityId:'Q123',countryCode:'CA',countryName:'Canada',airport:'YUL',cityUrl:'https://www.wikidata.org/wiki/Q123',coordinates:{latitude:45,longitude:-73}};
const html=(extra={},booking='<a href="https://secure.reservit.com/engine/booking/58/123/dates">Book direct</a>')=>`<title>Test Hotel · 4-star hotel</title><script type="application/ld+json">${JSON.stringify({'@type':'Hotel',name:'Test Hotel',starRating:{ratingValue:4},address:{addressLocality:'Example',addressCountry:'CA'},...extra})}</script>${booking}`;
const inspect=(body=html(),candidate={})=>inspectOfficialHotel(body,{pageUrl:'https://hotel.example.com/',candidate,destination,minStars:4});
const query={city:'Example',checkin:'2099-04-15',checkout:'2099-04-20',adults:2,adultAges:[35,47],childrenAges:[10],rooms:1,minStars:4,hotelSource:'official',destinationAirport:'YUL',destination};

test('official queries require actual adult ages and inspect star/address/booking evidence',()=>{
 assert.throws(()=>validateStay({...query,adultAges:undefined}),/actual age/);assert.throws(()=>validateStay({...query,adultAges:[35]}),/every adult/);
 const property=inspect();assert.equal(property.identity.key,'reservit:58:123');assert.equal(property.stars,4);assert.equal(property.addressVerified,true);
 for(const body of [html({address:{addressLocality:'Other',addressCountry:'CA'}}),html({name:'Other Hotel'}),html({starRating:{ratingValue:3}}),html({},'<a href="https://other.example.com">Book</a>'),html({},'<a href="https://secure.reservit.com/engine/booking/58/123/dates">Book</a><a href="https://secure.reservit.com/engine/booking/58/456/dates">Book</a>')]){
  assert.throws(()=>inspect(body,{name:'Test Hotel'}));
 }
});
test('live directory candidates retain bounded website coverage and attribution without prefilled properties',async()=>{
 let called='';const data={elements:[{type:'way',id:1,tags:{name:'Test Hotel',tourism:'hotel',stars:'4',website:'https://hotel.example.com/', 'addr:city':'Example','addr:country':'CA'}},{type:'node',id:2,tags:{name:'Duplicate',stars:'4',website:'https://hotel.example.com/'}},{type:'way',id:3,tags:{name:'Low class',stars:'3',website:'https://low.example.com/'}},{type:'node',id:4,tags:{name:'Second Hotel',stars:'5',website:'https://second.example.com/'}}]};
 const r=await discoverOfficialHotels(destination,{limit:1,fetcher:async url=>{called=String(url);return Response.json(data);}});assert.match(called,/overpass-api/);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].sourceUrl,'https://www.openstreetmap.org/way/1');assert.equal(r.coverage.moreAvailable,true);assert.equal(r.coverage.attributionUrl,'https://www.openstreetmap.org/copyright');
});
test('only matching explicit CAD totals can be displayed, never default currency or unavailable flags',()=>{
 for(const [text,amount]of [['C$ 1,250.50',1250.5],['CAD 100.00',100],['100.00 CA$',100]])assert.equal(reservitQuote({bestPrice:text,bestPrice_unFormatted:amount}).amount,amount);
 for(const [text,amount]of [['$ 100.00',100],['100,00 &euro;',100],['CAD 1,2',12],['CAD 100.00',90],['CAD 100.001',100.001],['CAD 0.00',0]])assert.throws(()=>reservitQuote({bestPrice:text,bestPrice_unFormatted:amount}));
 assert.equal(reservitQuote({bestPrice_unFormatted:-1}),null);
});
test('API Anything sends explicit dates and all occupant ages, and preserves observed totals/provenance',async()=>{
 const home=await mkdtemp(join(tmpdir(),'direct-api-'));let sent;
 try{
  const result=await searchReservit(query,inspect(),{stateHome:home,fetcher:async url=>{sent=new URL(url);return Response.json({bestPrice:'C$ 800.00',bestPrice_unFormatted:800});}});
  assert.equal(sent.searchParams.get('roomAge1'),'35,47,10');assert.equal(sent.searchParams.get('fromdate'),query.checkin);assert.equal(sent.searchParams.get('todate'),query.checkout);assert.equal(sent.searchParams.get('currency'),'CAD');assert.equal(sent.searchParams.has('partid'),false);
  const hotel=result.offers[0];assert.equal(hotel.priceText,'CAD 800.00');assert.equal(hotel.stay.nights,5);assert.equal(hotel.cancellationText,null);assert.equal(hotel.officialEvidence.propertyKey,'reservit:58:123');assert.equal(hotel.locationEvidence.cityId,'Q123');assert.deepEqual(hotel.stay.adultAges,[35,47]);
  const bookingUrl=new URL(hotel.url);assert.equal(bookingUrl.searchParams.get('nbpax'),'3');assert.equal(bookingUrl.searchParams.has('roomAge1'),false,'The current Reservit booking-link format cannot carry the individual ages, so the result must disclose re-entry.');assert.match(hotel.bookingStatus,/booking link carries dates and total guest count only.*re-enter the exact ages displayed/i);assert.match(hotel.taxText,/before taxes in North America and include taxes in Europe/i);
  const flight={query:{adults:2,children:0},offer:{to:'YUL',price:1000,currency:'CAD',observedAt:new Date().toISOString(),arrivalDate:query.checkin,inbound:{departureDate:query.checkout}}};
  const compatible={...query,childrenAges:[]};assert.equal(compareFlightHotel(flight,hotel,compatible),null);
  const adultOnly=await searchReservit(compatible,inspect(),{stateHome:home,fetcher:async()=>Response.json({bestPrice:'C$ 800.00',bestPrice_unFormatted:800})});const comparable=adultOnly.offers[0];assert.equal(compareFlightHotel(flight,comparable,compatible).subtotal,1800);
  assert.equal(compareFlightHotel(flight,{...comparable,url:comparable.url.replace('/123/','/999/')},compatible),null);
  const stale={...comparable,officialEvidence:{...comparable.officialEvidence,observedAt:new Date(Date.now()-16*60000).toISOString()}};assert.equal(compareFlightHotel(flight,stale,compatible),null);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('transport rate refusals survive API Anything wrapping and do not trigger browser fallback',async()=>{
 const home=await mkdtemp(join(tmpdir(),'direct-failure-'));let calls=0;
 try{await assert.rejects(searchReservit(query,inspect(),{stateHome:home,fetcher:async()=>{calls++;return new Response(null,{status:429,headers:{'retry-after':'60'}});}}),error=>error.sourceStatus==='rate_limited'&&Boolean(error.retryAt));assert.equal(calls,1);}finally{await rm(home,{recursive:true,force:true});}
});
test('a source returning EUR after requesting CAD is rejected and unsupported rooms spend no rate requests',async()=>{
 const home=await mkdtemp(join(tmpdir(),'direct-currency-'));let calls=0;
 try{await assert.rejects(searchReservit(query,inspect(),{stateHome:home,fetcher:async()=>{calls++;return Response.json({bestPrice:'500,00 &euro;',bestPrice_unFormatted:500});}}),/explicit CAD/);assert.equal(calls,1);
  await assert.rejects(searchReservit({...query,rooms:2},inspect(),{stateHome:home,fetcher:async()=>{calls++;}}),/allocation/);assert.equal(calls,1);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('multi-room direct observations preserve exact allocations and do not claim simultaneous availability',async()=>{
 const home=await mkdtemp(join(tmpdir(),'direct-rooms-'));const requests=[];
 const q={...query,rooms:2,roomAllocations:[{adultAges:[35],childrenAges:[10]},{adultAges:[47],childrenAges:[]}]};
 try{
  assert.deepEqual(validateStay(q).roomAllocations,q.roomAllocations);
  assert.throws(()=>validateStay({...q,roomAllocations:[{adultAges:[35],childrenAges:[]},{adultAges:[47],childrenAges:[]}]}),/exactly once/);
  const result=await searchReservit(q,inspect(),{stateHome:home,fetcher:async url=>{const age=new URL(url).searchParams.get('roomAge1');requests.push(age);const amount=age==='35,10'?400:300;return Response.json({bestPrice:`C$ ${amount}.00`,bestPrice_unFormatted:amount});}});
  assert.deepEqual(requests,['35,10','47']);assert.equal(result.requests,2);assert.equal(result.offers[0].priceText,'CAD 700.00');
  assert.deepEqual(result.offers[0].stay.roomAllocations,q.roomAllocations);assert.equal(result.offers[0].roomQuotes.length,2);assert.ok(result.offers[0].roomQuotes.every(room=>room.propertyKey==='reservit:58:123'));assert.match(result.offers[0].bookingStatus,/simultaneous inventory.*unverified/);
  assert.ok(result.offers[0].roomQuotes.every(room=>typeof room.taxText==='string'));assert.equal(result.offers[0].roomQuotes[0].cancellationText,null);assert.match(result.offers[0].taxText,/room 1: .*before taxes in North America.*room 2: .*before taxes in North America/s);assert.doesNotMatch(result.offers[0].taxText,/undefined/);
  const flight={query:{travelers:[{id:'adult-a',birthDate:'2064-01-01'},{id:'adult-b',birthDate:'2052-02-01'},{id:'child',birthDate:'2088-04-16',guardianId:'adult-a'}]},offer:{to:'YUL',price:1000,currency:'CAD',observedAt:new Date().toISOString(),arrivalDate:q.checkin,inbound:{departureDate:q.checkout}}};
  const comparison=compareFlightHotel(flight,result.offers[0],q);assert.equal(comparison.hotelAmount,700);assert.equal(comparison.subtotal,1700);assert.equal(comparison.rooms,2);assert.equal(comparison.simultaneousRoomsVerified,false);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('official hotel results reuse only exact fresh Reservit observations from the durable provider cache',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'official-hotel-cache-')),db=join(directory,'jobs.sqlite'),store=createJobStore(db);let discoveries=0,reads=0,quotes=0;
 const discover=async()=>{discoveries++;return {candidates:[{website:'https://hotel.example.com/'}],coverage:{discovered:1,checkedLimit:1}};};
 const read=async()=>{reads++;return new Response(html(),{headers:{'content-type':'text/html'}});};
 const quote=async(q,property)=>{quotes++;return searchReservit(q,property,{stateHome:join(directory,'api-anything'),fetcher:async()=>Response.json({bestPrice:'C$ 800.00',bestPrice_unFormatted:800})});};
 try{
  const run=q=>searchOfficialStays(q,{destination,discover,read,quote,providerCache:store});
  const first=await run(query);assert.equal(first.offers.length,1);assert.equal(first.sourceResults[0].cacheStatus,undefined);
  const again=await run(query);assert.equal(again.offers[0].observedAt,first.offers[0].observedAt);assert.equal(again.sourceResults[0].cacheStatus,'hit');assert.equal(discoveries,1);assert.equal(reads,1);assert.equal(quotes,1);
  const anotherParty=await run({...query,adultAges:[36,47]});assert.equal(anotherParty.offers.length,1);assert.equal(discoveries,2);assert.equal(quotes,2);
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('source stops on refusal, retains prior observations and publishes partial results',async()=>{
 let reads=0;const updates=[];const r=await searchOfficialStays(query,{destination,discover:async()=>({candidates:[{website:'https://one.example.com'},{website:'https://two.example.com'},{website:'https://three.example.com'}],coverage:{discovered:3}}),read:async()=>{if(++reads===2)throw new SourceRequestError('Blocked',{status:'blocked'});return new Response(html());},quote:async()=>({offers:[{name:'Test Hotel'}],status:'observed'}),onProgress:p=>updates.push(p)});
 assert.equal(reads,2);assert.equal(r.offers.length,1);assert.equal(r.sourceResults.at(-1).status,'blocked');assert.equal(updates.some(p=>p.partialResult?.offers.length===1),true);
});
test('cancellation cannot publish a late quote and multi-room discovery is skipped',async()=>{
 let reads=0;const controller=new AbortController();await assert.rejects(searchOfficialStays(query,{destination,signal:controller.signal,discover:async()=>({candidates:[{website:'https://hotel.example.com'}],coverage:{}}),read:async()=>new Response(html()),quote:async()=>{controller.abort(Error('Cancelled'));return {offers:[{price:1}]};}}),/Cancelled/);
 const r=await searchOfficialStays({...query,rooms:2},{destination,discover:async()=>{reads++;}});assert.equal(reads,0);assert.deepEqual(r.offers,[]);assert.equal(r.sourceResults[0].status,'unsupported');
});
