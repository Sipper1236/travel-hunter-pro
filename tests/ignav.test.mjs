import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBookingItinerary, getIgnavBookingLinks, searchIgnav } from '../lib/ignav.mjs';

const query = { origin: 'YHZ', destination: 'BCN', date: '2099-04-15', adults: 2, children: 1, childrenAges: [10], cabin: 'economy' };
const segment = (from, to, number, dep, arr) => ({ marketing_carrier_code: 'AC', flight_number: number, operating_carrier_name: 'Air Canada', departure_airport: from, departure_time_local: `${dep}:00`, departure_timezone:'Etc/UTC', departure_time_utc: `${dep}:00Z`, arrival_airport: to, arrival_time_local: `${arr}:00`, arrival_timezone:'Etc/UTC', arrival_time_utc: `${arr}:00Z` });
const itinerary = {
  price: { amount: 900, currency: 'CAD', status: 'verified' }, cabin_class: 'economy', ignav_id: 'fare_12345678',
  outbound: { duration_minutes: 500, segments: [segment('YHZ', 'YYZ', '123', '2099-04-15T08:00', '2099-04-15T10:00'), segment('YYZ', 'BCN', '456', '2099-04-15T12:00', '2099-04-16T08:00')] },
};

test('Ignav excludes itineraries whose airport-local timestamps contradict their UTC instants',async()=>{
 const contradictory=structuredClone(itinerary);
 contradictory.outbound.segments[0].departure_time_local='2099-04-15T09:00:00';
 const result=await searchIgnav(query,{apiKey:'test',fetcher:async()=>Response.json({observed_at:new Date().toISOString(),itineraries:[contradictory]})});
 assert.equal(result.offers.length,0);
 assert.equal(result.sources[0].rejectionReasons.unusable,1);
});

test('Ignav adapter sends party and market, returns only verified complete itineraries', async () => {
  let sent;
  const result = await searchIgnav(query, { apiKey: 'secret', fetcher: async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return Response.json({ observed_at: new Date().toISOString(), itineraries: [itinerary, { ...itinerary, price: { amount: 0, currency: 'CAD', status: 'unverified' } }] });
  } });
  assert.equal(sent.url, 'https://ignav.com/api/fares/one-way');
  assert.equal(sent.options.headers['X-Api-Key'], 'secret');
  assert.equal(sent.body.adults, 2);
  assert.equal(sent.body.children, 1);
  assert.equal(sent.body.market, 'CA');
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].currency, 'CAD');
  assert.equal(result.offers[0].via[0], 'YYZ');
  assert.equal(result.offers[0].segments.length, 2);
});

test('Ignav source diagnostics count normalized rejection reasons without returning source payloads',async()=>{
 const stale=new Date(Date.now()-16*60*1000).toISOString(),unusable={...itinerary,price:{amount:0,currency:'CAD',status:'unverified'}};
 const result=await searchIgnav(query,{apiKey:'test',fetcher:async()=>Response.json({observed_at:stale,itineraries:[itinerary,unusable]})});
 assert.equal(result.offers.length,0);
 assert.deepEqual(result.sources[0],{provider:'Ignav',status:'ok',received:2,accepted:0,rejected:2,rejectionReasons:{quote_freshness:1,unusable:1},reason:'2 returned itineraries were excluded: 1 quote_freshness, 1 unusable.'});
});

test('Ignav fails closed without credentials or valid route input', async () => {
  await assert.rejects(searchIgnav(query, { apiKey: '', fetcher: () => { throw Error('must not fetch'); } }), /not configured/);
  await assert.rejects(searchIgnav({ ...query, origin: 'Halifax' }, { apiKey: 'x' }), /three-letter/);
  await assert.rejects(searchIgnav({ ...query, adults: 0 }, { apiKey: 'x' }), /one to nine travelers/);
});

test('age-only child fares are withheld when overnight segment dates could cross twelve',async()=>{
 const options={apiKey:'test',fetcher:async()=>Response.json({observed_at:new Date().toISOString(),itineraries:[itinerary]})};
 assert.equal((await searchIgnav({...query,childrenAges:[11]},options)).offers.length,0);
 assert.equal((await searchIgnav({...query,childrenAges:[10]},options)).offers.length,1);
 const sameDay=structuredClone(itinerary);sameDay.outbound.segments[1].arrival_time_local='2099-04-15T18:00:00';sameDay.outbound.segments[1].arrival_time_utc='2099-04-15T18:00:00Z';
 assert.equal((await searchIgnav({...query,childrenAges:[11]},{apiKey:'test',fetcher:async()=>Response.json({observed_at:new Date().toISOString(),itineraries:[sameDay]})})).offers.length,1);
});

test('matching envelope cannot authorize a wrong route or missing quote evidence',async()=>{
 const badRoute=structuredClone(itinerary);badRoute.outbound.segments[0].departure_airport='YUL';
 const missingCabin={...itinerary,cabin_class:undefined};
 const missingDuration={...itinerary,outbound:{...itinerary.outbound,duration_minutes:undefined}};
 const options={apiKey:'x',fetcher:async()=>Response.json({origin:query.origin,destination:query.destination,departure_date:query.date,observed_at:new Date().toISOString(),itineraries:[itinerary,badRoute,missingCabin,missingDuration]})};
 assert.equal((await searchIgnav(query,options)).offers.length,1);
 options.fetcher=async()=>Response.json({itineraries:[itinerary]});
 assert.equal((await searchIgnav(query,options)).offers.length,0);
});

test('Ignav fares require explicit UTC offsets on every flight segment timestamp',async()=>{
 const malformed=structuredClone(itinerary);
 for(const part of malformed.outbound.segments)for(const key of ['departure_time_utc','arrival_time_utc'])part[key]=part[key].replace(/Z$/,'');
 const result=await searchIgnav(query,{apiKey:'x',fetcher:async()=>Response.json({observed_at:new Date().toISOString(),itineraries:[malformed]})});
 assert.equal(result.offers.length,0);
 const unknownOffset=structuredClone(itinerary);unknownOffset.outbound.segments[0].departure_time_utc='2099-04-15T08:00:00-00:00';
 const unknown=await searchIgnav(query,{apiKey:'x',fetcher:async()=>Response.json({observed_at:new Date().toISOString(),itineraries:[unknownOffset]})});
 assert.equal(unknown.offers.length,0);
});

test('booking lookup retains only safe HTTPS links and marks handoff as non-booking', async () => {
  let body;
  const result = await getIgnavBookingLinks('fare_12345678', { apiKey: 'secret', fetcher: async (_url, options) => {
    body = JSON.parse(options.body);
    return Response.json({ booking_options: [{ legs: ['outbound'], links: [
      { provider_name: 'Air Canada', url: 'aircanada.com/book', price: { amount: 900, currency: 'CAD', status: 'verified' } },
      { provider_name: 'Bad link', url: 'javascript:alert(1)' },
    ] }] });
  } });
  assert.deepEqual(body, { ignav_id: 'fare_12345678' });
  assert.equal(result.status, 'priced_handoff');
  assert.equal(result.bookingOptions[0].links.length, 1);
  assert.equal(result.bookingOptions[0].links[0].url, 'https://aircanada.com/book');
  assert.equal(result.bookingOptions[0].links[0].host, 'aircanada.com');
  assert.deepEqual(result.bookingOptions[0].legs,['outbound']);
  assert.equal(result.bookingOptions[0].links[0].specificity,'unknown');
  assert.equal(result.linkedPriceEvidenceStatus,'provider_reported_verified');
  assert.equal(result.sellerAvailabilityStatus,'not_checked');
  assert.equal(result.bookingStatus,'not_booked');
  assert.match(result.limitation, /not a reservation/);
});

test('seller options retain only valid coverage and known link specificity',async()=>{
 const result=await getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json({booking_options:[
  {legs:['outbound','inbound'],links:[{url:'https://aircanada.com/book',specificity:'exact_flight'}]},
  {legs:['inbound'],links:[{url:'https://aircanada.com/book',specificity:'search_results'}]},
  {legs:['outbound','unexpected'],leg_indexes:[-1],links:[{url:'https://aircanada.com/book',specificity:'unexpected'}]}
 ]})});
 assert.deepEqual(result.bookingOptions.map(option=>option.legs),[['outbound','inbound'],['inbound'],[]]);
 assert.deepEqual(result.bookingOptions.map(option=>option.links[0].specificity),['exact_flight','search_results','unknown']);
 assert.deepEqual(result.bookingOptions[2].legIndexes,[]);
 assert.match(result.limitation,/only to the legs/);
});

test('seller purchase-plan coverage distinguishes complete, partial, and unmappable legs',async()=>{
 const outbound={segments:[segment('YHZ','YYZ','123','2099-04-15T08:00','2099-04-15T10:00')]};
 const inbound={segments:[segment('YYZ','YHZ','456','2099-04-22T08:00','2099-04-22T10:00')]};
 const lookup=async response=>getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json(response)});
 const oneWay=await lookup({itinerary:{outbound},booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book'}]}]});
 assert.equal(oneWay.coverageStatus,'complete');
 assert.deepEqual(oneWay.expectedCoverage,['outbound']);
 const roundTrip=await lookup({itinerary:{outbound,inbound},booking_options:[
  {legs:['outbound'],links:[{url:'https://aircanada.com/outbound'}]},
  {legs:['inbound'],links:[{url:'https://aircanada.com/inbound'}]},
 ]});
 assert.equal(roundTrip.coverageStatus,'complete');
 assert.deepEqual(roundTrip.coveredCoverage,['outbound','inbound']);
 const partial=await lookup({itinerary:{outbound,inbound},booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/outbound'}]}]});
 assert.equal(partial.coverageStatus,'partial');
 const missingLink=await lookup({itinerary:{outbound,inbound},booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/outbound'}]},{legs:['inbound'],links:[{url:'javascript:invalid'}]}]});
 assert.equal(missingLink.coverageStatus,'partial');
 const unmappable=await lookup({itinerary:{outbound,inbound},booking_options:[{legs:['outbound','unexpected'],links:[{url:'https://aircanada.com/book'}]}]});
 assert.equal(unmappable.coverageStatus,'unknown');
 const duplicate=await lookup({itinerary:{outbound,inbound},booking_options:[{legs:['outbound','inbound'],links:[{url:'https://aircanada.com/combined'}]},{legs:['inbound'],links:[{url:'https://aircanada.com/return'}]}]});
 assert.equal(duplicate.coverageStatus,'unknown');
});

test('flexible seller coverage maps zero-based indexes against the returned itinerary legs',async()=>{
 const result=await getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json({
  itinerary:{legs:[{segments:[segment('YHZ','YYZ','123','2099-04-15T08:00','2099-04-15T10:00')]},{segments:[segment('YYZ','BCN','456','2099-04-15T12:00','2099-04-16T08:00')]}]},
  booking_options:[{leg_indexes:[0],links:[{url:'https://aircanada.com/first'}]},{leg_indexes:[1],links:[{url:'https://aircanada.com/second'}]}],
 })});
 assert.equal(result.coverageStatus,'complete');
 assert.deepEqual(result.expectedCoverage,['leg 1','leg 2']);
 assert.deepEqual(result.coveredCoverage,['leg 1','leg 2']);
});

test('booking itinerary is matched to the original offer by every exact segment',()=>{
 const original={segments:itinerary.outbound.segments};
 assert.equal(compareBookingItinerary(original,{outbound:itinerary.outbound}),'matched');
 const contradictory={outbound:{segments:[{...itinerary.outbound.segments[0],departure_time_local:'2099-04-15T09:00:00'},itinerary.outbound.segments[1]]}};
 assert.equal(compareBookingItinerary(original,contradictory),'mismatch');
 const changed={outbound:{segments:[{...itinerary.outbound.segments[0],flight_number:'999'},itinerary.outbound.segments[1]]}};
 assert.equal(compareBookingItinerary(original,changed),'mismatch');
 assert.equal(compareBookingItinerary(original,{}),'unknown');
 const roundTripOriginal={...original,inbound:{segments:[segment('BCN','YHZ','789','2099-04-25T08:00','2099-04-25T14:00')]}};
 assert.equal(compareBookingItinerary(roundTripOriginal,{outbound:itinerary.outbound,inbound:roundTripOriginal.inbound}),'matched');
 assert.equal(compareBookingItinerary(roundTripOriginal,{outbound:itinerary.outbound}),'mismatch');
});

test('booking itinerary must return the same cabin as the stored offer',()=>{
 const original={segments:itinerary.outbound.segments,cabin:'economy'};
 assert.equal(compareBookingItinerary(original,{outbound:itinerary.outbound,cabin_class:'economy'}),'matched');
 assert.equal(compareBookingItinerary(original,{outbound:itinerary.outbound,cabin_class:'business'}),'mismatch');
 assert.equal(compareBookingItinerary(original,{outbound:itinerary.outbound}),'unknown');
});

test('seller links are withheld when the booking response changes the stored itinerary',async()=>{
 const expectedOffer={segments:itinerary.outbound.segments};
 const result=await getIgnavBookingLinks('fare_12345678',{apiKey:'x',expectedOffer,fetcher:async()=>Response.json({
  itinerary:{...itinerary,outbound:{...itinerary.outbound,segments:[{...itinerary.outbound.segments[0],flight_number:'999'},itinerary.outbound.segments[1]]}},
  booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book',price:{amount:900,currency:'CAD',status:'verified'}}]}],
 })});
 assert.equal(result.itineraryMatch,'mismatch');
 assert.equal(result.status,'itinerary_mismatch');
 assert.deepEqual(result.bookingOptions,[]);
 assert.match(result.limitation,/links were suppressed/);
});

test('seller links are withheld unless the returned itinerary is positively matched',async()=>{
 const expectedOffer={segments:itinerary.outbound.segments};
 for(const returned of [null,{outbound:{segments:[{...itinerary.outbound.segments[0],departure_time_utc:'2099-04-15T08:00:00'},itinerary.outbound.segments[1]]}}]){
  const result=await getIgnavBookingLinks('fare_12345678',{apiKey:'x',expectedOffer,fetcher:async()=>Response.json({itinerary:returned,booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book',price:{amount:900,currency:'CAD',status:'verified'}}]}]})});
  assert.equal(result.itineraryMatch,'unknown');
  assert.equal(result.status,'itinerary_unverified');
  assert.deepEqual(result.bookingOptions,[]);
  assert.equal(result.sellerAvailabilityStatus,'not_checked');
  assert.match(result.limitation,/not return enough validated itinerary detail/i);
 }
});

test('booking lookup retains an offset-aware provider observation time without inventing one',async()=>{
 const lookup=observed_at=>getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json({observed_at,booking_options:[]})});
 assert.equal((await lookup('2026-10-30T12:34:56Z')).observedAt,'2026-10-30T12:34:56Z');
 assert.equal((await lookup('2026-10-30T12:34:56')).observedAt,null);
 assert.equal((await lookup('2026-02-30T12:34:56Z')).observedAt,null);
 assert.equal((await lookup('2026-11-14T02:00:00-00:00')).observedAt,null);
 assert.equal((await lookup(null)).observedAt,null);
});

test('seller link price freshness stays unknown when only the overall provider response is timestamped',async()=>{
 const now=Date.parse('2026-11-14T02:00:00Z'),lookup=observed_at=>getIgnavBookingLinks('fare_12345678',{apiKey:'x',now,fetcher:async()=>Response.json({observed_at,booking_options:[{legs:['outbound'],links:[{url:'https://aircanada.com/book',price:{amount:900,currency:'CAD',status:'verified'}}]}]})});
 const fresh=await lookup('2026-11-14T01:59:00Z'),stale=await lookup('2026-11-14T01:00:00Z'),missing=await lookup(null);
 assert.equal(fresh.providerResponseFreshnessStatus,'fresh');
 assert.equal(stale.providerResponseFreshnessStatus,'stale');
 assert.equal(missing.providerResponseFreshnessStatus,'unknown');
 assert.equal(fresh.linkedPriceFreshnessStatus,'unknown');
 assert.equal(stale.linkedPriceFreshnessStatus,'unknown');
 assert.equal(fresh.linkedPriceEvidenceStatus,'provider_reported_verified');
});

test('booking handoff preserves only explicit provider-reported baggage counts',async()=>{
 const lookup=bags=>getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json({itinerary:{bags},booking_options:[]})});
 assert.deepEqual((await lookup({carry_on:1,checked:2})).baggage,{carryOn:1,checked:2});
 assert.deepEqual((await lookup({carry_on:0})).baggage,{carryOn:0,checked:null});
 assert.deepEqual((await lookup({carry_on:'1',checked:-1})).baggage,null);
 assert.deepEqual((await lookup(undefined)).baggage,null);
});

test('non-CAD source fares and seller prices are never displayed as CAD', async () => {
  const fares = await searchIgnav(query, {apiKey:'secret',fetcher:async()=>Response.json({itineraries:[{...itinerary,price:{amount:123,currency:'USD',status:'verified'}}]})});
  assert.equal(fares.offers.length,0);
  const result = await getIgnavBookingLinks('fare_12345678', {apiKey:'secret',fetcher:async()=>Response.json({itinerary:{price:{amount:123,currency:'USD'}},booking_options:[{links:[{url:'aircanada.com/book',price:{amount:123,currency:'USD',status:'verified'}}]}]})});
  assert.equal(result.itinerary.price,null);
  assert.equal(result.bookingOptions[0].links[0].price,null);
  assert.equal(result.linkedPriceEvidenceStatus,'not_provided');
  assert.equal(result.sellerAvailabilityStatus,'not_checked');
  assert.equal(result.bookingStatus,'not_booked');
  assert.equal(result.status,'handoff_unpriced');
});

test('invalid seller amounts or verification states remain unpriced handoffs',async()=>{
 const result=await getIgnavBookingLinks('fare_12345678',{apiKey:'x',fetcher:async()=>Response.json({itinerary:{price:{amount:-900,currency:'CAD',status:'verified'}},booking_options:[{links:[0,-10,100].map(amount=>({url:'https://aircanada.com/book',price:{amount,currency:'CAD',status:amount===100?'invented':'verified'}}))}]})});
 assert.equal(result.itinerary.price,null);
 assert.ok(result.bookingOptions[0].links.every(link=>link.price===null));
 assert.equal(result.status,'handoff_unpriced');
});

test('round trip requires an observed matching inbound and maps youth to provider adult category',async()=>{
 let sent;
 const back=segment('BCN','YHZ','789','2099-04-25T08:00','2099-04-25T14:00');
 const round={...itinerary,inbound:{duration_minutes:400,segments:[back]}};
 const result=await searchIgnav({...query,children:2,childrenAges:[10,15],tripType:'round-trip',returnDate:'2099-04-25'},{apiKey:'secret',fetcher:async (url,options)=>{sent={url,body:JSON.parse(options.body)};return Response.json({observed_at:new Date().toISOString(),return_date:'2099-04-25',itineraries:[round,{...round,inbound:null},{...round,inbound:{segments:[{...back,departure_airport:'MAD'}]}}]});}});
 assert.equal(sent.url,'https://ignav.com/api/fares/round-trip');assert.equal(sent.body.adults,3);assert.equal(sent.body.children,1);assert.equal(sent.body.return_date,'2099-04-25');assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound.departureDate,'2099-04-25');
});

test('count-only age-11 round trips require a birth date before pricing both directions',async()=>{
 let calls=0;
 const base={...query,adults:1,children:1,childrenAges:[11],tripType:'round-trip',returnDate:'2099-04-25'};
 await assert.rejects(searchIgnav(base,{apiKey:'x',fetcher:async()=>{calls++;return Response.json({itineraries:[]});}}),/date of birth.*both travel dates/i);
 assert.equal(calls,0);
 const tenYearOld=await searchIgnav({...base,childrenAges:[10]},{apiKey:'x',fetcher:async()=>{calls++;return Response.json({itineraries:[]});}});
 assert.equal(calls,1);
 assert.equal(tenYearOld.offers.length,0);
});

test('calendar keeps only actual provider dates and explicitly unverified CAD prices',async()=>{
 const {getIgnavCalendar}=await import('../lib/ignav.mjs');let sent;
 const result=await getIgnavCalendar({...query,start:'2099-04-15',end:'2099-04-16',nights:5,maxStops:1},{apiKey:'x',fetcher:async(url,options)=>{sent={url,body:JSON.parse(options.body)};return Response.json({origin:'YHZ',destination:'BCN',observed_at:new Date().toISOString(),dates:[{departure_date:'2099-04-15',return_date:'2099-04-20',price:{amount:500,currency:'CAD',status:'unverified'}},{departure_date:'2099-04-16',return_date:'2099-04-21',price:null},{departure_date:'2099-04-17',return_date:'2099-04-22',price:{amount:1,currency:'CAD',status:'unverified'}}]});}});
 assert.equal(sent.url,'https://ignav.com/api/fares/cheapest-dates');assert.equal(sent.body.stay_days,5);assert.equal(result.dates.length,2);assert.equal(result.dates[0].status,'unverified');assert.equal(result.dates[1].price,null);
});

test('airport lookup proxies and validates real provider results',async()=>{
 const {searchIgnavAirports}=await import('../lib/ignav.mjs');let request;
 const items=await searchIgnavAirports('Bar',{apiKey:'secret',fetcher:async(url,options)=>{request={url,headers:options.headers};return Response.json([{code:'BCN',name:'Barcelona Airport',city:'Barcelona',country:'ES',region:'Catalonia'},{code:'BAD!',name:'bad'}]);}});
 assert.equal(new URL(request.url).searchParams.get('q'),'Bar');assert.equal(request.headers['X-Api-Key'],'secret');assert.equal(items.length,1);assert.equal(items[0].code,'BCN');assert.equal(items[0].region,'Catalonia');
});
