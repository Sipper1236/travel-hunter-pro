const airport=x=>typeof x==='string'&&/^[A-Z]{3}$/.test(x);
const stamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===x.slice(0,10);
const elapsed=(from,to)=>(Date.parse(to)-Date.parse(from))/60000;
const equalTime=(a,b)=>stamp(a)&&stamp(b)&&Date.parse(a)===Date.parse(b);
const expectedPax=q=>Object.fromEntries(Object.entries(q.passengers).map(([key,n])=>[key==='youths'?'youth':key,n]));
function partyMatches(detail,q){
 if(!Array.isArray(detail.pricings)||!detail.pricings.length)return false;
 const expected=expectedPax(q),actual={};
 for(const pricing of detail.pricings??[])for(const[key,n]of Object.entries(pricing?.ext?.pax??{})){if(!Number.isSafeInteger(n)||n<1||n>9)return false;actual[key]=(actual[key]??0)+n;}
 return detail.passengerCount===Object.values(expected).reduce((a,b)=>a+b,0)&&Object.keys({...actual,...expected}).every(key=>actual[key]===expected[key]);
}
function direction(summary,detail,q,from,to,date){
 if(!detail||detail.origin?.code!==from||detail.destination?.code!==to||!equalTime(detail.departure,summary.departure)||!equalTime(detail.arrival,summary.arrival)||detail.departure.slice(0,10)!==date)return null;
 if(!Array.isArray(detail.segments)||!detail.segments.length||detail.segments.length>6||detail.segments.length!==summary.flights?.length||detail.segments.some(x=>!x||typeof x!=='object'))return null;
 const segments=[],airlines=[];
 for(const [i,segment]of detail.segments.entries()){
  if(!segment||typeof segment!=='object')return null;
  const carrier=segment.carrier?.code,number=String(segment.flight?.number??'');
  if(!/^[A-Z0-9]{2,3}$/.test(carrier??'')||!/^\d{1,4}[A-Z]?$/.test(number)||summary.flights[i]!==carrier+number)return null;
  if(!Array.isArray(segment.bookingInfos)||segment.bookingInfos.length!==q.pricingGroups||segment.bookingInfos.some(x=>x?.cabin?.replaceAll('_','-')!==q.cabin))return null;
  if(!Array.isArray(segment.legs)||!segment.legs.length||segment.legs.length>6||segment.legs.some(x=>!x||typeof x!=='object'))return null;
  if(!equalTime(segment.departure,segment.legs[0].departure)||!equalTime(segment.arrival,segment.legs.at(-1).arrival)||segment.origin?.code!==segment.legs[0].origin?.code||segment.destination?.code!==segment.legs.at(-1).destination?.code||elapsed(segment.departure,segment.arrival)!==segment.duration)return null;
  for(const leg of segment.legs){
   if(!leg||typeof leg!=='object')return null;
   const origin=leg.origin?.code,destination=leg.destination?.code;
   if(!airport(origin)||!airport(destination)||origin===destination||!stamp(leg.departure)||!stamp(leg.arrival)||elapsed(leg.departure,leg.arrival)<=0||elapsed(leg.departure,leg.arrival)!==leg.duration)return null;
   const previous=segments.at(-1);if(previous&&(previous.arrival_airport!==origin||Date.parse(leg.departure)<Date.parse(previous.arrival_time_utc)))return null;
   segments.push({marketing_carrier_code:carrier,flight_number:number,departure_airport:origin,arrival_airport:destination,departure_time_local:leg.departure,arrival_time_local:leg.arrival,departure_time_utc:new Date(leg.departure).toISOString(),arrival_time_utc:new Date(leg.arrival).toISOString(),...(segment.ext?.operationalDisclosure?{operatingDisclosure:segment.ext.operationalDisclosure}:{})});
  }
  if(i<detail.segments.length-1){const next=detail.segments[i+1],layover=elapsed(segment.arrival,next.departure);if(!stamp(next.departure)||layover<0||segment.connection?.duration!==undefined&&segment.connection.duration!==layover)return null;}
  airlines.push(segment.carrier.shortName||carrier);
 }
 const first=segments[0],last=segments.at(-1),duration=elapsed(detail.departure,detail.arrival);
 if(first.departure_airport!==from||last.arrival_airport!==to||!equalTime(first.departure_time_utc,detail.departure)||!equalTime(last.arrival_time_utc,detail.arrival)||duration<=0||duration!==summary.duration)return null;
 const via=segments.slice(0,-1).map(x=>x.arrival_airport);
 if(detail.stopCount!==undefined&&detail.stopCount!==via.length)return null;
 return {from,to,departureDate:detail.departure.slice(0,10),arrivalDate:detail.arrival.slice(0,10),departureTime:detail.departure.slice(11,16),arrivalTime:detail.arrival.slice(11,16),durationMinutes:duration,via,airlines:[...new Set(airlines)],segments};
}

/** Join only the exact selected summary to its separately returned first-party details. */
export function matrixDetailedItinerary(summary,detail,query){
 if(!summary?.id||detail?.id!==summary.id||detail.displayTotal!==summary.displayTotal||detail.ext?.totalPrice!==summary.displayTotal||!partyMatches(detail,query))return null;
 const expected=query.returnDate?2:1,slices=detail.itinerary?.slices,original=summary.itinerary?.slices;
 if(!Array.isArray(slices)||!Array.isArray(original)||slices.length!==expected||original.length!==expected)return null;
 const q={...query,pricingGroups:detail.pricings.length};
 const outbound=direction(original[0],slices[0],q,q.origin,q.destination,q.departureDate);
 const inbound=q.returnDate?direction(original[1],slices[1],q,q.destination,q.origin,q.returnDate):null;
 if(!outbound||q.returnDate&&(!inbound||Date.parse(inbound.segments[0].departure_time_utc)<Date.parse(outbound.segments.at(-1).arrival_time_utc)))return null;
 return {outbound,inbound};
}
