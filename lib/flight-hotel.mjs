// Independent observations only: never infer taxes, package protection or discounts.
import {quoteFreshness} from './quote-freshness.mjs';
import {hotelPropertyKey,bookingPropertyKey,reservitPropertyKey,normalizeLocation} from './hotel-identity.mjs';
import {validateTravelerIdentities} from './travelers.mjs';
export function suggestedStay(flight) {
  const checkin=flight?.offer?.arrivalDate;
  const checkout=flight?.offer?.inbound?.departureDate;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(checkin||'')||!/^\d{4}-\d{2}-\d{2}$/.test(checkout||'')||checkout<=checkin)return null;
  if(Array.isArray(flight?.query?.travelers)){
    try {
      const ages=validateTravelerIdentities(flight.query.travelers,[checkin]).map(person=>person.ages[0]);
      const adultAges=ages.filter(age=>age>=18),childrenAges=ages.filter(age=>age<18);
      if(!adultAges.length)return null;
      return {checkin,checkout,adults:adultAges.length,adultAges,childrenAges};
    } catch {return null;}
  }
  return {checkin,checkout,adults:Number(flight.query.adults)};
}
const sameAges=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort((x,y)=>x-y).every((age,i)=>age===[...b].sort((x,y)=>x-y)[i]);
const roomAllocationsMatch=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((room,index)=>sameAges(room?.adultAges,b[index]?.adultAges)&&sameAges(room?.childrenAges,b[index]?.childrenAges));
function hotelAmount(value){
 const match=/^CAD\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)$/.exec(value?.trim()||'');
 if(!match)return null;
 const amount=Number(match[1].replaceAll(',','')),amountCents=Math.round(amount*100);
 return Number.isSafeInteger(amountCents)&&amountCents>0&&Math.abs(amount*100-amountCents)<1e-6?amountCents:null;
}
function validatedRoomQuotes(hotel,query){
 const rooms=query.rooms??1;
 if(rooms===1)return null;
 const allocations=query.roomAllocations,stay=hotel.stay,quotes=hotel.roomQuotes;
 if(!['official','booking'].includes(hotel.provider)||!hotelPropertyKey(hotel)||!Array.isArray(allocations)||allocations.length!==rooms||!Array.isArray(stay?.roomAllocations)||!roomAllocationsMatch(allocations,stay.roomAllocations)||!Array.isArray(quotes)||quotes.length!==rooms)return null;
 if(!roomAllocationsMatch(allocations,quotes.map(quote=>({adultAges:quote.adultAges,childrenAges:quote.childrenAges}))))return null;
 const seen=new Set(),amounts=[];
 for(const quote of quotes){
  if(!Number.isInteger(quote.room)||quote.room<1||quote.room>rooms||seen.has(quote.room)||quoteFreshness(quote).status!=='fresh')return null;
  seen.add(quote.room);
  try{const url=new URL(quote.url),propertyUrl=new URL(hotel.url),quoteKey=bookingPropertyKey(url.toString())??reservitPropertyKey(url.toString());if(url.protocol!=='https:'||url.username||url.password||url.hostname!==propertyUrl.hostname||quoteKey!==hotelPropertyKey(hotel))return null;}catch{return null;}
  const cents=hotelAmount(quote.priceText);if(cents===null)return null;amounts.push(cents);
 }
 const total=amounts.reduce((sum,cents)=>sum+cents,0);
 return Number.isSafeInteger(total)&&hotelAmount(hotel.priceText)===total?total:null;
}
function demandRoomSetMatches(hotel,query,totalCents){
 const evidence=hotel.occupancyEvidence,requested=query.roomAllocations,observed=evidence?.observedRoomProducts,expectedTotal=hotelAmount(hotel.priceText);
 if(hotel.source!=='Booking.com Demand API'||hotel.provider!=='booking'||evidence?.status!=='provider_product_allocation_match'||!Array.isArray(requested)||!Array.isArray(observed)||requested.length!==query.rooms||observed.length!==query.rooms||evidence.roomsRequested!==query.rooms)return false;
 if(!roomAllocationsMatch(requested,evidence.requestedRoomAllocations)||evidence.productsMatchedRequestedAllocations!==true||evidence.adultCountsEchoed!==true||evidence.adultAgesEchoed!==false||evidence.childAgesEchoed!==true)return false;
 const signatures=rooms=>rooms.map(room=>`${room.adultAges.length}:${[...room.childrenAges].sort((a,b)=>a-b).join(',')}`).sort();
 const observedSignatures=observed.map(room=>Number.isInteger(room.adults)&&Array.isArray(room.childrenAges)?`${room.adults}:${[...room.childrenAges].sort((a,b)=>a-b).join(',')}`:null).sort();
 if(observedSignatures.includes(null)||JSON.stringify(signatures(requested))!==JSON.stringify(observedSignatures))return false;
 const products=evidence.productTotalsCents;
 return expectedTotal===totalCents&&evidence.expectedTotalCents===totalCents&&evidence.expectedTotalIncludesNonConditionalCharges===true&&evidence.productTotalsMatchExpectedTotal===true&&Array.isArray(products)&&products.length===query.rooms&&products.every(value=>Number.isSafeInteger(value)&&value>0)&&products.reduce((sum,value)=>sum+value,0)===totalCents;
}
export function compareFlightHotel(flight,hotel,resultQuery){
  if(quoteFreshness(flight?.offer).status!=='fresh'||quoteFreshness(hotel).status!=='fresh')return null;
  const evidence=hotel.locationEvidence,destination=resultQuery?.destination;
  if(!evidence || evidence.status!=='verified' || !destination || evidence.airport!==flight.offer.to || destination.airport!==flight.offer.to || resultQuery.destinationAirport!==flight.offer.to || evidence.cityId!==destination.cityId || evidence.countryCode!==destination.countryCode || normalizeLocation(evidence.city)!==normalizeLocation(destination.city) || normalizeLocation(evidence.hotelName)!==normalizeLocation(hotel.name) || !evidence.propertyKey || evidence.propertyKey!==hotelPropertyKey(hotel) || quoteFreshness(evidence).status!=='fresh')return null;
  if(!bookingPropertyKey(hotel.url)&&quoteFreshness(hotel.officialEvidence).status!=='fresh')return null;
  const stay=suggestedStay(flight),identified=Array.isArray(flight.query.travelers);
  if(!stay||!Number.isInteger(stay.adults)||stay.adults<1||flight.offer.currency!=='CAD'||hotel?.currency!=='CAD'||!Number.isFinite(flight.offer.price)||flight.offer.price<=0)return null;
  const childAges=stay.childrenAges ?? [],hotelChildAges=resultQuery?.childrenAges??[];
  if(!Array.isArray(hotelChildAges)||hotelChildAges.some(age=>!Number.isInteger(age)||age<0||age>17))return null;
  const flightTravelerCount=identified?flight.query.travelers.length:Number(flight.query.adults)+(Array.isArray(flight.query.childrenAges)?flight.query.childrenAges.length:Number(flight.query.children??0));
  const hotelAdults=resultQuery?.adults;
  if(!Number.isInteger(flightTravelerCount)||flightTravelerCount<1||!Number.isInteger(hotelAdults)||hotelAdults<1||hotelAdults+hotelChildAges.length!==flightTravelerCount)return null;
  if(identified&&(hotelAdults!==stay.adults||!sameAges(hotelChildAges,childAges)))return null;
  const rooms=resultQuery?.rooms??1;
 if(hotel.source==='Booking.com via api-anything'){
  const evidence=hotel.occupancyEvidence,roomEvidence=evidence?.rooms;
  const countsMatched=evidence&&(rooms===1?evidence.status==='provider_count_match'&&evidence.adultsMatched===true&&evidence.nightsMatched===true&&evidence.childrenCountMatched===true&&evidence.roomsMatched===true:evidence.status==='separate_room_count_matches'&&Array.isArray(roomEvidence)&&roomEvidence.length===rooms&&roomEvidence.every(room=>room.status==='provider_count_match'&&room.adultsMatched===true&&room.nightsMatched===true&&room.childrenCountMatched===true&&room.roomsMatched===true));
  if(!countsMatched||evidence.individualAgesEchoed!==false)return null;
  if(hotelChildAges.length)return null;
 }
  if(!Number.isInteger(rooms)||rooms<1||rooms>9||rooms!==hotel.stay?.rooms)return null;
  if(rooms>1){
    if(!Array.isArray(resultQuery.roomAllocations)||resultQuery.roomAllocations.length!==rooms||!roomAllocationsMatch(resultQuery.roomAllocations,hotel.stay.roomAllocations))return null;
    if(!sameAges(resultQuery.roomAllocations.flatMap(room=>room.childrenAges),hotelChildAges))return null;
    if(identified&&(!Array.isArray(stay.adultAges)||!sameAges(resultQuery.roomAllocations.flatMap(room=>room.adultAges),stay.adultAges)))return null;
    if(!identified&&resultQuery.roomAllocations.reduce((sum,room)=>sum+room.adultAges.length+room.childrenAges.length,0)!==flightTravelerCount)return null;
  }else if(hotel.stay.roomAllocations||hotel.roomQuotes)return null;
  if(identified&&resultQuery?.adultAges&&!sameAges(resultQuery.adultAges,stay.adultAges))return null;
  if(resultQuery.checkin!==stay.checkin||resultQuery.checkout!==stay.checkout)return null;
  const observedStay=hotel.stay,nights=(Date.parse(stay.checkout)-Date.parse(stay.checkin))/86400000;
  if(!observedStay||observedStay.checkin!==stay.checkin||observedStay.checkout!==stay.checkout||observedStay.nights!==nights||observedStay.adults!==hotelAdults||observedStay.rooms!==rooms||!sameAges(observedStay.childrenAges,hotelChildAges))return null;
  if(observedStay.adultAges&&!sameAges(observedStay.adultAges,resultQuery.adultAges??observedStay.adultAges))return null;
  const observedRoomCents=rooms>1?(hotel.source==='Booking.com Demand API'?hotelAmount(hotel.priceText):validatedRoomQuotes(hotel,resultQuery)):hotelAmount(hotel.priceText);
 if(observedRoomCents===null)return null;
 const roomSetObservedTogether=rooms>1&&demandRoomSetMatches(hotel,resultQuery,observedRoomCents);
 if(rooms>1&&hotel.source==='Booking.com Demand API'&&!roomSetObservedTogether)return null;
 const flightCents=Math.round(flight.offer.price*100),hotelCents=observedRoomCents;
  if(!Number.isSafeInteger(flightCents)||Math.abs(flight.offer.price*100-flightCents)>1e-6||flightCents<=0||!Number.isSafeInteger(hotelCents)||hotelCents<=0||!Number.isSafeInteger(flightCents+hotelCents))return null;
  const subtotal=(flightCents+hotelCents)/100;
 return {flightAmount:flight.offer.price,hotelAmount:hotelCents/100,subtotal,perAdult:subtotal/hotelAdults,perTraveler:subtotal/flightTravelerCount,currency:'CAD',nights:(Date.parse(stay.checkout)-Date.parse(stay.checkin))/86400000,rooms,simultaneousRoomsVerified:rooms===1,roomSetObservedTogether};
}
