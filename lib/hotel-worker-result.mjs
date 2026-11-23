import {validateStay} from './booking-browser.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const exact=(a,b)=>{
 if(Object.is(a,b))return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>exact(value,b[index]));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=Object.keys(a).sort(),other=Object.keys(b).sort();
  return keys.length===other.length&&keys.every((key,index)=>key===other[index]&&exact(a[key],b[key]));
 }
 return false;
};
const cents=value=>{
 const match=/^CAD\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)$/.exec(String(value??'').trim());
 if(!match)return null;
 const amount=Number(match[1].replaceAll(',','')),result=Math.round(amount*100);
 return Number.isSafeInteger(result)&&result>0&&Math.abs(amount*100-result)<1e-6?result:null;
};
const normalize=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('en-CA');
const roomIdentity=offer=>offer?.locationEvidence?.propertyKey??offer?.officialEvidence?.propertyKey;

function matchingStay(stay,query){
 if(!stay||stay.checkin!==query.checkin||stay.checkout!==query.checkout)return 'stay dates';
 const nights=(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000;
 if(!Number.isInteger(nights)||stay.nights!==nights)return 'stay length';
 if(stay.rooms!==query.rooms||stay.adults!==query.adults)return 'room or adult counts';
 if(!same(stay.childrenAges,query.childrenAges))return 'children ages';
 if(query.adultAges!==undefined&&!same(stay.adultAges,query.adultAges))return 'adult ages';
 if(query.roomAllocations!==undefined){
  if(!Array.isArray(stay.roomAllocations)||stay.roomAllocations.length!==query.roomAllocations.length)return 'room assignments';
  for(let index=0;index<query.roomAllocations.length;index++){
   if(!same(stay.roomAllocations[index]?.adultAges,query.roomAllocations[index].adultAges)||!same(stay.roomAllocations[index]?.childrenAges,query.roomAllocations[index].childrenAges))return 'room assignments';
  }
 }
 return null;
}

function matchingProperty(offer,query){
 const proof=offer.locationEvidence,destination=query.destination;
 if(!proof||proof.status!=='verified'||!roomIdentity(offer))return false;
 if(proof.hotelName&&normalize(proof.hotelName)!==normalize(offer.name))return false;
 if(destination?.city&&normalize(proof.city)!==normalize(destination.city))return false;
 if(destination?.cityId&&proof.cityId!==destination.cityId)return false;
 if(destination?.countryCode&&proof.countryCode!==destination.countryCode)return false;
 if(query.destinationAirport&&proof.airport&&proof.airport!==query.destinationAirport)return false;
 if(offer.officialEvidence&&offer.officialEvidence.status!=='verified')return false;
 return true;
}

function matchingOccupancyEvidence(evidence,query,totalCents){
 if(!evidence)return false;
 if(evidence.status==='provider_product_allocation_match'){
  const requested=query.roomAllocations??[{adultAges:query.adultAges??[],childrenAges:query.childrenAges}];
  const observed=evidence.requestedRoomAllocations;
  const exactAllocations=Array.isArray(observed)&&observed.length===requested.length&&observed.every((room,index)=>same(room?.adultAges,requested[index].adultAges)&&same(room?.childrenAges,requested[index].childrenAges));
  return evidence.roomsRequested===query.rooms&&exactAllocations&&evidence.productsMatchedRequestedAllocations===true&&evidence.productTotalsMatchExpectedTotal===true&&evidence.expectedTotalCents===totalCents&&Array.isArray(evidence.productTotalsCents)&&evidence.productTotalsCents.length===query.rooms&&evidence.productTotalsCents.every(value=>Number.isSafeInteger(value)&&value>0)&&evidence.productTotalsCents.reduce((sum,value)=>sum+value,0)===totalCents&&evidence.expectedTotalIncludesNonConditionalCharges===true;
 }
 if(query.rooms!==1){
  return evidence.status==='separate_room_count_matches'&&evidence.individualAgesEchoed===false&&Array.isArray(evidence.rooms)&&evidence.rooms.length===query.rooms&&evidence.rooms.every((room,index)=>room.room===index+1&&room.status==='provider_count_match'&&room.adultsMatched===true&&room.childrenCountMatched===true&&room.nightsMatched===true&&room.roomsMatched===true&&same(room.requestedAdultAges,query.roomAllocations[index].adultAges)&&same(room.requestedChildrenAges,query.roomAllocations[index].childrenAges));
 }
 const requestedAdults=query.adultAges===undefined?null:query.adultAges;
 return evidence.status==='provider_count_match'&&evidence.adultsMatched===true&&evidence.childrenCountMatched===true&&evidence.nightsMatched===true&&evidence.roomsMatched===true&&evidence.individualAgesEchoed===false&&same(evidence.requestedAdultAges,requestedAdults)&&same(evidence.requestedChildrenAges,query.childrenAges);
}

function sourceMatches(offer,query){
 const browser=offer.source==='Booking.com via api-anything'&&offer.provider==='booking',demand=offer.source==='Booking.com Demand API'&&offer.provider==='booking',official=offer.source==='Official hotel website via API Anything / Reservit'&&offer.provider==='official'&&offer.officialEvidence?.status==='verified';
 switch(query.hotelSource??'booking'){
  case 'booking':return browser;
  case 'booking-demand':return demand;
  case 'official':return official;
  case 'both':return browser||official;
  default:return false;
 }
}

function sourceStatusMatchesOffer(source,offer,query){
 if(!source||source.status!=='observed'||typeof source.provider!=='string')return false;
 const provider=normalize(source.provider);
 if(offer.source==='Booking.com via api-anything'){
  if(!provider.includes('booking.com')||provider.includes('demand api'))return false;
  if(!Number.isSafeInteger(source.observations)||source.observations<1)return false;
  if(query.rooms>1)return Number.isSafeInteger(source.room)&&source.room>=1&&source.room<=query.rooms&&Number.isSafeInteger(source.acceptedForSameProperty)&&source.acceptedForSameProperty>0&&source.acceptedForSameProperty<=source.observations;
  const accepted=source.accepted??source.acceptedForSameProperty;
  return Number.isSafeInteger(accepted)&&accepted>0&&accepted<=source.observations;
 }
 if(offer.source==='Booking.com Demand API')return provider.includes('booking.com demand api')&&Number.isSafeInteger(source.propertiesReceived)&&source.propertiesReceived>0&&Number.isSafeInteger(source.accepted)&&source.accepted>0&&source.accepted<=source.propertiesReceived;
 if(offer.source==='Official hotel website via API Anything / Reservit')return (provider.includes('official')||provider.includes('reservit'))&&Number.isSafeInteger(source.observations)&&source.observations>0;
 return false;
}

function sourceRowsSupportOffer(result,offer,query){
 const matching=result.sourceResults.filter(source=>sourceStatusMatchesOffer(source,offer,query));
 if(offer.source==='Booking.com via api-anything'&&query.rooms>1){
  const rooms=new Set(matching.map(source=>source.room));
  return Array.from({length:query.rooms},(_,index)=>index+1).every(room=>rooms.has(room));
 }
 return matching.length>0;
}

function boundedDiscoveryCoverage(value){
 if(!value||typeof value!=='object'||!Number.isSafeInteger(value.discovered)||value.discovered<0)return false;
 if(value.source==='User-selected property website')return value.discovered===1&&value.checkedLimit===1;
 return value.source==='OpenStreetMap'&&value.discovered<=101&&Number.isSafeInteger(value.checkedLimit)&&value.checkedLimit>=1&&value.checkedLimit<=10&&value.radiusMeters===10000&&typeof value.moreAvailable==='boolean'&&value.attributionUrl==='https://www.openstreetmap.org/copyright';
}

function matchingRooms(offer,query,totalCents,now){
 if(!Array.isArray(offer.roomQuotes)||offer.roomQuotes.length!==query.rooms)return false;
 let sum=0;
 for(let index=0;index<offer.roomQuotes.length;index++){
  const quote=offer.roomQuotes[index],allocation=query.roomAllocations[index],price=cents(quote.priceText);
  if(!price||quoteFreshness(quote,now).status!=='fresh'||quote.room!==index+1||!same(quote.adultAges,allocation.adultAges)||!same(quote.childrenAges,allocation.childrenAges))return false;
  if(quote.propertyKey!==roomIdentity(offer))return false;
  sum+=price;
 }
 return sum===totalCents;
}

/** Fail closed before a hotel result can be persisted under its submitted search. */
export function hotelWorkerResultError(result,input,now=Date.now()){
 let query;
 try{query=validateStay(input);}catch{return 'submitted hotel query is invalid';}
 if(!result||typeof result!=='object'||!Array.isArray(result.offers))return 'result has no offers list';
 const returnedQuery=result.query;
 if(!returnedQuery||typeof returnedQuery!=='object'||Object.entries(query).some(([key,value])=>key!=='city'&&!exact(returnedQuery[key],value)))return 'result query changed the submitted stay constraints';
 const destination=returnedQuery.destination;
 if(destination?.city){
  if(normalize(returnedQuery.city)!==normalize(destination.city))return 'result query city does not match its verified destination';
 }else if(normalize(returnedQuery.city)!==normalize(query.city))return 'result query changed the submitted city';
 if(!result.offers.length){
  const sources=result.sourceResults;
  if(!Array.isArray(sources))return boundedDiscoveryCoverage(result.discoveryCoverage)?null:'empty result lacks source status or bounded discovery coverage';
  if(sources.some(source=>!source||typeof source.provider!=='string'||!source.provider||typeof source.status!=='string'||!source.status))return 'empty result contains an invalid source status';
  if(!sources.length&&!boundedDiscoveryCoverage(result.discoveryCoverage))return 'empty result lacks source status or bounded discovery coverage';
  return null;
 }
 if(!destination||typeof destination.city!=='string'||!destination.city||!/^[A-Z]{2}$/.test(destination.countryCode??''))return 'result has no verified destination';
 if(!Array.isArray(result.sourceResults)||!result.sourceResults.length||result.sourceResults.some(source=>!source||typeof source.provider!=='string'||!source.provider||typeof source.status!=='string'||!source.status))return 'priced result lacks valid provider source status coverage';
 const checkedQuery={...query,destination};
 for(const offer of result.offers){
  if(!offer||typeof offer.name!=='string'||!Number.isInteger(offer.stars)||offer.stars<query.minStars||offer.stars>5)return 'an offer has invalid property or star evidence';
  if(!sourceMatches(offer,query))return 'an offer does not match the selected hotel source';
  if(!sourceRowsSupportOffer(result,offer,query))return 'an offer has no matching observed provider status with accepted source coverage';
  if(offer.currency!=='CAD')return 'an offer is not explicitly priced in CAD';
  const total=cents(offer.priceText);if(total===null)return 'an offer has no valid positive CAD total';
  const stayIssue=matchingStay(offer.stay,query);if(stayIssue)return `an offer does not match requested ${stayIssue}`;
  if(!matchingProperty(offer,checkedQuery))return 'an offer lacks verified property destination evidence';
  if(quoteFreshness(offer,now).status!=='fresh')return 'an offer price observation is stale or invalid';
  if(query.rooms>1&&query.roomAllocations){
   if(offer.occupancyEvidence?.status==='provider_product_allocation_match'){
    if(!matchingOccupancyEvidence(offer.occupancyEvidence,query,total))return 'an offer room product totals or allocations do not match the request';
   }else if(!matchingRooms(offer,query,total,now)||(offer.provider==='booking'&&!matchingOccupancyEvidence(offer.occupancyEvidence,query,total)))return 'an offer separately quoted room totals or assignments do not match';
  }else if(['booking','booking-demand'].includes(query.hotelSource??'booking')&&!matchingOccupancyEvidence(offer.occupancyEvidence,query,total))return offer.occupancyEvidence?.status==='provider_product_allocation_match'?'an offer room product totals or allocations do not match the request':'an offer occupancy evidence does not match the request';
 }
 return null;
}
