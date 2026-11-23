import test from 'node:test';
import assert from 'node:assert/strict';
import { searchExpedia } from '../lib/expedia.mjs';

const query = { origin: 'YHZ', destination: 'BCN', date: '2099-04-15', adults: 1, children: 0, cabin: 'economy' };
const responseData = { Segments: [{ SegmentId: 'seg-1', Legs: [{
  DepartureAirport: { Code: 'YHZ' }, ArrivalAirport: { Code: 'BCN' },
  DepartureDateTime: '2099-04-15T08:00:00-03:00', ArrivalDateTime: '2099-04-15T18:00:00+02:00',
  FlightDuration: 'PT6H00M', MarketingAirlineCode: 'AC', MarketingAirlineName: 'Air Canada', FlightNumber: '123',CabinClass:'ECONOMY',
}] }], Offers: [{ offerToken: 'offer-1', SegmentIds: ['seg-1'], SplitTicket:false,OfferPrice: { TotalPrice: { Value: '845.50', Currency: 'CAD' },AveragePricePerTicket:{Count:1,Currency:'CAD'},PricePerPassengerCategory:[{Category:'ADULT',Count:1}] }, Links: { WebDetails: { Href: 'https://www.expedia.com/go/flight-details?id=offer-1' } } }] };
const roundTripQuery={...query,tripType:'round-trip',returnDate:'2099-04-20',adults:2,children:2,childrenAges:[8,14],cabin:'business',filters:{maxStops:0}};
const roundTripData={Segments:[
 {SegmentId:'outbound',Legs:structuredClone(responseData.Segments[0].Legs).map(leg=>({...leg,CabinClass:'BUSINESS'}))},
 {SegmentId:'return',Legs:[{...structuredClone(responseData.Segments[0].Legs[0]),DepartureAirport:{Code:'BCN'},ArrivalAirport:{Code:'YHZ'},DepartureDateTime:'2099-04-20T08:00:00+02:00',ArrivalDateTime:'2099-04-20T18:00:00-03:00',CabinClass:'BUSINESS'}]},
],Offers:[{offerToken:'round-trip-offer',SegmentIds:['outbound','return'],SplitTicket:false,OfferPrice:{TotalPrice:{Value:'2345.67',Currency:'CAD'},AveragePricePerTicket:{Count:4,Currency:'CAD'},PricePerPassengerCategory:[{Category:'ADULT',Count:2},{Category:'ADULT_CHILD',Count:1},{Category:'CHILD',Count:1}]},Links:{WebDetails:{Href:'https://www.expedia.com/go/flight-details?id=round-trip-offer'}}}]};

test('Expedia adapter calls the documented listings API and preserves total, itinerary, and redirect', async () => {
  let request;
  const result = await searchExpedia(query, { apiKey: 'partner-key', authorization: 'Basic partner-auth', transactionId: 'test-1', fetcher: async (url, init) => {
    request = { url: new URL(url), init };
    return Response.json(responseData);
  } });
  assert.equal(request.url.origin + request.url.pathname, 'https://apim.expedia.com/flights/listings');
  assert.equal(request.url.searchParams.get('segment1.origin'), 'YHZ');
  assert.equal(request.url.searchParams.get('adult'), '1');
  assert.equal(request.init.headers.Key, 'partner-key');
  assert.equal(request.init.headers.Authorization, 'Basic partner-auth');
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].price, 845.5);
  assert.equal(result.offers[0].currency, 'CAD');
  assert.equal(result.offers[0].sourceUrl, 'https://www.expedia.com/go/flight-details?id=offer-1');
  assert.equal(result.offers[0].durationMinutes, 300);
});

test('Expedia round-trip listings request two inverse legs and normalize one linked group total with child ages',async()=>{
 let request;const result=await searchExpedia(roundTripQuery,{apiKey:'key',authorization:'auth',fetcher:async(url,init)=>{request={url:new URL(url),init};return Response.json(roundTripData);}});
 assert.deepEqual(['origin','destination','departureDate'].map(key=>request.url.searchParams.get(`segment1.${key}`)),['YHZ','BCN','2099-04-15']);
 assert.deepEqual(['origin','destination','departureDate'].map(key=>request.url.searchParams.get(`segment2.${key}`)),['BCN','YHZ','2099-04-20']);
 assert.equal(request.url.searchParams.get('childrenAges'),'8,14');assert.equal(request.url.searchParams.get('cabinClass'),'business');
 assert.equal(request.url.searchParams.get('numberOfStops'),'0');assert.equal(request.url.searchParams.get('filterNonFlightOffers'),'true');assert.equal(request.url.searchParams.get('filterNearByAirport'),'true');
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,2345.67);assert.equal(result.offers[0].inbound.from,'BCN');assert.equal(result.offers[0].inbound.to,'YHZ');
 assert.deepEqual(result.offers[0].airlines,['Air Canada']);assert.match(result.offers[0].travelers,/3 Expedia adult-fare passengers, 1 child-fare passenger \(8\)/);
 assert.deepEqual(result.offers[0].expediaFlightSelection.outbound,[['YHZ','BCN','AC','123','2099-04-15T08:00:00-03:00','2099-04-15T18:00:00+02:00']]);
 assert.deepEqual(result.offers[0].expediaFlightSelection.return,[['BCN','YHZ','AC','123','2099-04-20T08:00:00+02:00','2099-04-20T18:00:00-03:00']]);
});

test('Expedia exact-flight refresh keeps only the same outbound and return and accepts a changed current total',async()=>{
 const first=await searchExpedia(roundTripQuery,{apiKey:'x',authorization:'y',fetcher:async()=>Response.json(roundTripData)}),selection=first.offers[0].expediaFlightSelection;
 const updated=structuredClone(roundTripData);updated.Offers[0].OfferPrice.TotalPrice.Value='2450.00';
 const refreshed=await searchExpedia(roundTripQuery,{apiKey:'x',authorization:'y',selection,fetcher:async()=>Response.json(updated)});
 assert.equal(refreshed.offers.length,1);assert.equal(refreshed.offers[0].price,2450);assert.deepEqual(refreshed.offers[0].expediaFlightSelection,selection);
 const changed=structuredClone(updated);changed.Segments[1].Legs[0].FlightNumber='999';
 assert.equal((await searchExpedia(roundTripQuery,{apiKey:'x',authorization:'y',selection,fetcher:async()=>Response.json(changed)})).offers.length,0);
 let called=false;await assert.rejects(searchExpedia(roundTripQuery,{apiKey:'x',authorization:'y',selection:{outbound:[]},fetcher:()=>{called=true;}}),/exact previously observed/);assert.equal(called,false);
});

test('Expedia journey duration includes layovers and rejects invalid chronology or missing offsets', async () => {
  const data = structuredClone(responseData);
  data.Segments[0].Legs = [
    { ...data.Segments[0].Legs[0], ArrivalAirport: { Code: 'YUL' }, ArrivalDateTime: '2099-04-15T09:00:00-04:00' },
    { ...data.Segments[0].Legs[0], DepartureAirport: { Code: 'YUL' }, DepartureDateTime: '2099-04-15T11:00:00-04:00' },
  ];
  const run = () => searchExpedia(query, { apiKey: 'x', authorization: 'y', fetcher: async () => Response.json(data) });
  assert.equal((await run()).offers[0].durationMinutes, 300);
  data.Segments[0].Legs[1].DepartureDateTime = '2099-04-15T08:00:00-04:00';
  assert.equal((await run()).offers.length, 0);
  data.Segments[0].Legs[1].DepartureDateTime = '2099-04-15T11:00:00';
  assert.equal((await run()).offers.length, 0);
  data.Segments[0].Legs[1].DepartureDateTime = '2099-04-15T11:00:00-04:00';
  data.Segments[0].Legs[0].DepartureDateTime = '2099-04-15T08:00:00-00:00';
  assert.equal((await run()).offers.length, 0);
});

test('Expedia adapter does not send a child-count search without actual ages', async () => {
  await assert.rejects(searchExpedia({ ...query, children: 1 }, { apiKey: 'x', authorization: 'y', fetcher: () => { throw Error('must not fetch'); } }), /actual age/);
});

test('Expedia never attaches a multi-segment offer total to only its first journey', async () => {
  const data = structuredClone(responseData);
  data.Segments.push({ ...structuredClone(data.Segments[0]), SegmentId: 'seg-2' });
  data.Offers[0].SegmentIds = ['seg-1', 'seg-2'];
  const result = await searchExpedia(query, { apiKey: 'x', authorization: 'y', fetcher: async () => Response.json(data) });
  assert.equal(result.offers.length, 0);
  assert.equal(result.sources[0].received, 1);
  assert.equal(result.sources[0].accepted, 0);
});

test('Expedia never emits a round-trip quote when either linked requested leg is missing or mismatched',async()=>{
 const missing=structuredClone(roundTripData);missing.Offers[0].SegmentIds=['outbound'];
 const wrongDate=structuredClone(roundTripData);wrongDate.Segments[1].Legs[0].DepartureDateTime='2099-04-21T08:00:00+02:00';
 const wrongRoute=structuredClone(roundTripData);wrongRoute.Segments[1].Legs[0].ArrivalAirport.Code='LHR';
 const wrongParty=structuredClone(roundTripData);wrongParty.Offers[0].OfferPrice.PricePerPassengerCategory[0].Count=1;
 const wrongCabin=structuredClone(roundTripData);wrongCabin.Segments[1].Legs[0].CabinClass='ECONOMY';
 for(const data of [missing,wrongDate,wrongRoute,wrongParty,wrongCabin])assert.equal((await searchExpedia(roundTripQuery,{apiKey:'x',authorization:'y',fetcher:async()=>Response.json(data)})).offers.length,0);
});

test('Expedia requires documented child ages and refuses a return that may cross its age-12 fare boundary',async()=>{
 let calls=0;const options={apiKey:'x',authorization:'y',fetcher:async()=>{calls++;return Response.json(roundTripData);}};
 await assert.rejects(searchExpedia({...roundTripQuery,childrenAges:[]},options),/actual age/);
 await assert.rejects(searchExpedia({...roundTripQuery,childrenAges:[11,14],returnDate:'2099-04-16'},options),/cross its adult-fare boundary/);
 assert.equal(calls,0);
});
