import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {defaultJobPath} from '../lib/job-store.mjs';
import {getIgnavBookingLinks} from '../lib/ignav.mjs';
import {isExactIgnavSellerQuery,lowestFreshIgnavOffer} from '../lib/ignav-seller-selection.mjs';

if(process.env.TRAVEL_RUN_LIVE_SELLER_CHECK!=='1')throw Error('Set TRAVEL_RUN_LIVE_SELLER_CHECK=1 to make one read-only Ignav seller-handoff request.');
if(!process.env.IGNAV_API_KEY)throw Error('IGNAV_API_KEY is required.');

const tripType=process.env.TRAVEL_SELLER_TRIP_TYPE??'round-trip';
const expected={origin:process.env.TRAVEL_SELLER_ORIGIN??'YHZ',destination:process.env.TRAVEL_SELLER_DESTINATION??'LAX',date:process.env.TRAVEL_SELLER_DATE??'2026-11-12',tripType,adults:1,children:0,childrenAges:[],cabin:'economy'};
if(tripType==='round-trip')expected.returnDate=process.env.TRAVEL_SELLER_RETURN_DATE??'2026-11-19';
if(!isExactIgnavSellerQuery({origin:expected.origin,destination:expected.destination,date:expected.date,tripType,adults:1,children:0,childrenAges:[],cabin:'economy',...(tripType==='round-trip'?{returnDate:expected.returnDate}:{})},expected))throw Error('Seller check target must use valid IATA codes, exact dates, one adult and economy. Set TRAVEL_SELLER_ORIGIN, TRAVEL_SELLER_DESTINATION, TRAVEL_SELLER_DATE, TRAVEL_SELLER_TRIP_TYPE, and TRAVEL_SELLER_RETURN_DATE when needed.');

const db=new DatabaseSync(defaultJobPath(),{readOnly:true});
const selectorNow=Date.now();
assert.equal(lowestFreshIgnavOffer({offers:[{provider:'Google Flights',currency:'CAD',price:900},{provider:'Ignav',currency:'CAD',price:1044,ignavId:'ignav_test_id',observedAt:new Date(selectorNow-60000).toISOString()}]},selectorNow)?.ignavId,'ignav_test_id');
try{
 const rows=db.prepare("SELECT result FROM flight_jobs WHERE kind='flight' AND status='complete' ORDER BY updated DESC LIMIT 100").all();
 let selected=null;
 for(const row of rows){
  if(!row.result)continue;
  let result;try{result=JSON.parse(row.result);}catch{continue;}
  if(isExactIgnavSellerQuery(result?.query,expected)&&Array.isArray(result.offers)&&result.offers.length){
   const offer=lowestFreshIgnavOffer(result);
   if(offer){selected={result,offer};break;}
  }
 }
 assert.ok(selected,`No fresh stored exact ${expected.origin}–${expected.destination} Ignav observation for ${expected.date} is available; no provider request was made.`);
 const refreshed=await getIgnavBookingLinks(selected.offer.ignavId,{expectedOffer:selected.offer});
 console.log(JSON.stringify({
  request:'one read-only seller-handoff refresh',
  query:{origin:expected.origin,destination:expected.destination,date:expected.date,tripType:expected.tripType,...(expected.tripType==='round-trip'?{returnDate:expected.returnDate}:{}),adults:1,cabin:'economy'},
  searchObservedAt:selected.result.observedAt??null,
  searchPrice:{amount:selected.offer.price,currency:selected.offer.currency},
  itineraryMatch:refreshed.itineraryMatch,
  handoffStatus:refreshed.status,
  linkedPriceEvidenceStatus:refreshed.linkedPriceEvidenceStatus,
  itineraryPrice:refreshed.itinerary?.price??null,
  sellerAvailabilityStatus:refreshed.sellerAvailabilityStatus,
  baggage:refreshed.baggage,
  mandatoryChargesStatus:refreshed.mandatoryChargesStatus,
  observedAt:refreshed.observedAt,
  bookingOptions:refreshed.bookingOptions.map(option=>({legs:option.legs,linkCount:option.links.length,sellers:option.links.map(link=>({provider:link.provider,type:link.type,specificity:link.specificity,price:link.price}))})),
  coverageStatus:refreshed.coverageStatus,
  note:'Seller URLs, API credentials, and private data are intentionally omitted. No checkout, reservation, or purchase was attempted.'
 }));
}finally{db.close();}
