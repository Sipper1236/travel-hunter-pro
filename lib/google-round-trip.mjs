import {createHash} from 'node:crypto';
import {validateTravelerIdentities,googleRoundTripParty} from './travelers.mjs';
export {googleRoundTripParty} from './travelers.mjs';
import {validateZonedItinerary} from './airport-timezones.mjs';
import {flightOfferError} from './flight-offer.mjs';

const fail=message=>{throw Error(`Google round-trip evidence: ${message}`);};
const airport=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value);
const carrier=value=>typeof value==='string'&&/^[A-Z0-9]{2}$/.test(value);
const day=value=>{
 if(!Array.isArray(value)||value.length!==3||!value.every(Number.isInteger))return fail('missing exact flight date.');
 const text=value.map((part,index)=>String(part).padStart(index?2:4,'0')).join('-');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)return fail('invalid flight date.');
 return text;
};
const clock=value=>{
 // The observed protobuf JSON omits zero minutes and represents a zero hour as null.
 if(!Array.isArray(value)||value.length<1||value.length>2||!value.some(Number.isInteger))return fail('missing flight time.');
 const [hour=0,minute=0]=value.map(part=>part??0);
 if(!Number.isInteger(hour)||!Number.isInteger(minute)||hour<0||hour>23||minute<0||minute>59)return fail('invalid flight time.');
 return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
};
const flight=value=>Array.isArray(value)&&carrier(value[0])&&typeof value[1]==='string'&&/^\d{1,5}[A-Z]?$/.test(value[1]);
const amount=value=>Number.isFinite(value)&&value>0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6;
export const googleFlightSelection=offer=>Object.fromEntries([['outbound',offer],['return',offer.inbound]].map(([side,leg])=>[side,leg.segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt])]));

/** Parse completed, bounded native RPC streams; never use an outbound list as a return quote. */
export function parseGoogleRpcFrames(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>8_000_000||!raw.startsWith(")]}'"))return fail('invalid or oversized native RPC stream.');
 const frames=[];
 for(const line of raw.slice(4).split('\n').map(line=>line.trim()).filter(Boolean)){
  if(/^\d+$/.test(line))continue;
  let rows;try{rows=JSON.parse(line);}catch{return fail('incomplete native RPC stream.');}
  if(!Array.isArray(rows))return fail('invalid native RPC frame.');
  for(const row of rows)if(row?.[0]==='wrb.fr'&&typeof row[2]==='string'){
   try{frames.push(JSON.parse(row[2]));}catch{return fail('invalid native RPC payload.');}
   if(frames.length>1000)return fail('too many native RPC frames.');
  }
 }
 if(!frames.length)return fail('no native RPC data.');
 return frames;
}

function normalizeLeg(row){
 if(!Array.isArray(row)||!airport(row[3])||!airport(row[6])||!Array.isArray(row[2])||row[2].length<1||row[2].length>6||!Array.isArray(row[1])||!row[1].length||row[1].some(name=>typeof name!=='string'||!name.trim())||!Number.isInteger(row[9])||row[9]<=0)return fail('incomplete selected flight direction.');
 const segments=row[2].map(segment=>{
  if(!airport(segment?.[3])||!airport(segment?.[6])||!flight(segment?.[22])||segment[16]!==1||!Number.isInteger(segment[11])||segment[11]<=0)return fail('missing segment identity, economy cabin or duration.');
  const departureAt=`${day(segment[20])}T${clock(segment[8])}:00`,arrivalAt=`${day(segment[21])}T${clock(segment[10])}:00`;
  const codeshares=segment[15]??[];if(!Array.isArray(codeshares)||codeshares.some(item=>!flight(item)))return fail('invalid codeshare references.');
  return {from:segment[3],to:segment[6],departureAt,arrivalAt,departure_airport:segment[3],arrival_airport:segment[6],departure_time_local:departureAt,arrival_time_local:arrivalAt,marketing_carrier_code:segment[22][0],flight_number:segment[22][1],...(segment[2]?{operatingCarrierName:segment[2]}:{}),durationMinutes:segment[11],codeshares:codeshares.map(item=>({carrier:item[0],flightNumber:item[1]}))};
 });
 const departureDate=day(row[4]),arrivalDate=day(row[7]),departureTime=clock(row[5]),arrivalTime=clock(row[8]);
 if(segments[0].from!==row[3]||segments.at(-1).to!==row[6]||segments[0].departureAt!==`${departureDate}T${departureTime}:00`||segments.at(-1).arrivalAt!==`${arrivalDate}T${arrivalTime}:00`)return fail('selected direction and segment times disagree.');
 return {from:row[3],to:row[6],departureDate,arrivalDate,departureTime,arrivalTime,durationMinutes:row[9],airlines:row[1],via:segments.slice(0,-1).map(segment=>segment.to),segments};
}

export function googleOneWayUrl(input){
 if(!airport(input?.origin)||!airport(input?.destination)||input.origin===input.destination||typeof input.date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.date)||!Number.isFinite(Date.parse(`${input.date}T00:00:00Z`))||new Date(`${input.date}T00:00:00Z`).toISOString().slice(0,10)!==input.date)throw Error('Google one-way search requires exact airport codes and a valid date.');
 const url=new URL('https://www.google.com/travel/flights');url.search=new URLSearchParams({q:`Flights from ${input.origin} to ${input.destination} on ${input.date} one way`,hl:'en-CA',gl:'CA',curr:'CAD'}).toString();return url.toString();
}

/** Normalize a one-way Google results-page price only when its visible query, party and currency match. */
export function normalizeGoogleOneWay(raw,input,{evidence,timezones,observedAt=new Date().toISOString(),maxCandidates=80}={}){
 const url=googleOneWayUrl(input);
 if(input.tripType!=='one-way'||input.travelers!==undefined||input.cabin&&input.cabin!=='economy'||(input.adults??1)!==1||(input.children??0)!==0)fail('only one adult, economy, one-way results are supported.');
 if(evidence?.currencyLabel!=='Currency CAD'||typeof evidence?.partyLabel!=='string'||!/^1 passenger(?:,|$)/.test(evidence.partyLabel)||evidence?.sourceUrl!==url)fail('the results page did not confirm the exact one-adult CAD query.');
 if(!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>80)fail('invalid result examination bound.');
 const data=parseGoogleRpcFrames(raw).at(-1),rows=[...(data?.[2]?.[0]??[]),...(data?.[3]?.[0]??[])];
 if(!Array.isArray(data)||!Array.isArray(rows))fail('missing one-way results.');
 const candidates=googleDirectionCandidates(raw,{timezones,maxCandidates}).filter(candidate=>candidate.leg.from===input.origin&&candidate.leg.to===input.destination&&candidate.leg.departureDate===input.date);
 const offers=[];
 for(const candidate of candidates){
  const offer={...candidate.leg,provider:'Google Flights',source:'Google Flights native one-way results-page observation',price:candidate.indicativePrice,currency:'CAD',observedAt,cabin:'economy',travelers:'1 adult; Google page displayed one passenger',sourceUrl:url.toString(),bookingStatus:'Observed Google results-page price; seller availability and price have not been rechecked.',fees:'Baggage, mandatory charges and seller checkout total were not independently verified.'};
  offer.itineraryKey=createHash('sha256').update(JSON.stringify(offer.segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt]))).digest('hex');
  if(!flightOfferError(offer,input))offers.push(offer);
 }
 return {offers:offers.sort((a,b)=>a.price-b.price),received:rows.length,candidates:candidates.length,partial:rows.length>maxCandidates,observedAt,sourceUrl:url.toString(),limitation:'These are bounded Google results-page observations, not seller-refreshed or bookable fares. Verify the exact itinerary, availability, baggage, mandatory charges and total with the seller.'};
}

/** Bounded native direction observations for choosing a full return; not canonical fare offers. */
export function googleDirectionCandidates(raw,{timezones,maxCandidates=80}={}){
 const data=parseGoogleRpcFrames(raw).at(-1);
 const rows=[...(data?.[2]?.[0]??[]),...(data?.[3]?.[0]??[])];
 if(!Array.isArray(data)||!rows.length)return [];
 const seen=new Set(),candidates=[];
 for(const row of rows.slice(0,maxCandidates))try{
  const id=row?.[0]?.[17],price=row?.[1]?.[0]?.[1];
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||seen.has(id)||!amount(price))continue;
  const leg=validateZonedItinerary(normalizeLeg(row[0]),timezones);
  for(const segment of leg.segments)if((Date.parse(segment.arrival_time_utc)-Date.parse(segment.departure_time_utc))/60000!==segment.durationMinutes)throw Error('Segment duration mismatch.');
  seen.add(id);candidates.push({id,indicativePrice:price,leg});
 }catch{/* Missing direction evidence never gets filled from the query. */}
 return candidates.sort((a,b)=>a.indicativePrice-b.indicativePrice);
}

function sourceParty(text){
 const section=typeof text==='string'?text.match(/Prices include required taxes \+ fees for ([^.]+)\./)?.[1]:null;
 if(!section)return fail('missing full-party tax/fee statement.');
 const counts={adults:0,children:0};
 const remainder=section.replace(/(\d+)\s+(adults?|children|child)\b/g,(_,count,type)=>{const key=type.startsWith('adult')?'adults':'children';if(counts[key])return fail('duplicate source party category.');counts[key]=Number(count);return '';});
 if(!/^(?:\s|,|and)*$/.test(remainder))return fail('unverified source passenger category.');
 return counts;
}

/** Internal server-only normalization; evidence must be read from the same native browser page. */
export function normalizeGoogleRoundTrip(raw,input,{evidence,timezones,observedAt=new Date().toISOString()}={}){
 if(!airport(input.origin)||!airport(input.destination)||input.origin===input.destination)return fail('different exact airport codes are required.');
 const party=googleRoundTripParty(input),actual=sourceParty(evidence?.text);
 if(evidence?.currency!=='CAD'||actual.adults!==party.adults||actual.children!==party.children||!new RegExp(`(?:^|\\n)${party.total} passengers?(?:\\n|$)`).test(evidence.text)||!evidence.text.includes('Lowest total price'))return fail('source currency, party or group-total evidence does not match.');
 let url;try{url=new URL(evidence.sourceUrl);}catch{return fail('missing selected-itinerary handoff.');}
 if(url.origin!=='https://www.google.com'||url.pathname!=='/travel/flights/booking'||url.username||url.password||!url.searchParams.get('tfs')||!url.searchParams.get('tfu')||url.searchParams.get('curr')!=='CAD'||url.toString().length>20000)return fail('invalid selected-itinerary handoff.');
 for(const key of [...url.searchParams.keys()])if(!['tfs','tfu','hl','gl','curr'].includes(key))url.searchParams.delete(key);
 const data=parseGoogleRpcFrames(raw).at(-1)?.[1],directions=data?.[5]?.[0];
 if(!Array.isArray(directions)||directions.length!==2||!Array.isArray(data[0]))return fail('a complete selected return and seller quotes are required.');
 const [outbound,inbound]=directions.map(normalizeLeg),segments=[...outbound.segments,...inbound.segments];
 const observedDates=segments.flatMap(segment=>[segment.departureAt.slice(0,10),segment.arrivalAt.slice(0,10)]);
 if(input.travelers){
  const people=validateTravelerIdentities(input.travelers,[input.date,...observedDates]);
  if(people.some(person=>person.ages.some(age=>age<2||(age<12)!==(person.ages[0]<12))))return fail('a traveler changes fare category on an observed flight date.');
 }else googleRoundTripParty({...input,returnDate:[input.returnDate,...observedDates].sort().at(-1)});
 let base=validateZonedItinerary({...outbound,inbound},timezones);
 for(const leg of [base,base.inbound]){
  if((Date.parse(leg.segments.at(-1).arrival_time_utc)-Date.parse(leg.segments[0].departure_time_utc))/60000!==leg.durationMinutes)return fail('source direction duration disagrees with UTC chronology.');
  for(const segment of leg.segments)if((Date.parse(segment.arrival_time_utc)-Date.parse(segment.departure_time_utc))/60000!==segment.durationMinutes)return fail('source segment duration disagrees with UTC chronology.');
 }
 const offers=[];
 for(const row of data[0]){
  const price=row?.[7]?.[0]?.[1],seller=row?.[1]?.[0];
  if(!amount(price)||!Array.isArray(seller)||typeof seller[0]!=='string'||typeof seller[1]!=='string'||!seller[1].trim()||![0,2].includes(row[0])||!Array.isArray(row[3])||row[3].length!==segments.length)continue;
  if(!row[3].every((ref,index)=>flight(ref)&&(ref[0]===segments[index].marketing_carrier_code&&ref[1]===segments[index].flight_number||segments[index].codeshares.some(other=>other.carrier===ref[0]&&other.flightNumber===ref[1]))))continue;
  if(row[0]===2&&!Array.isArray(row[6])||row[0]===0&&(!Array.isArray(row[5])||row[5]?.[2]?.[0]!=='https://www.google.com/travel/clk/f'))continue;
  const offer={...base,provider:'Google Flights',source:'Google Flights native selected round-trip observation',price,currency:'CAD',observedAt,cabin:'economy',airlines:[...new Set([...outbound.airlines,...inbound.airlines])],travelers:`${party.total} ${party.total===1?'traveler':'travelers'}; source fare categories: ${party.adults} adult${party.adults===1?'':'s'}, ${party.children} child${party.children===1?'':'ren'}`,seller:seller[1],sourceUrl:url.toString(),bookingStatus:row[0]===2?'Observed group return quote; calling the airline is required for this option. Seller price and eligibility have not been rechecked.':'Observed group return quote; continue through Google to the named seller to verify price and eligibility.',fees:'Google reports required taxes and fees included; baggage and optional charges require seller confirmation.',googleSellerId:seller[0],googleBookingMode:row[0]===2?'phone':'online',googleSellerFlights:row[3].map(ref=>({carrier:ref[0],flightNumber:ref[1]}))};
  offer.itineraryKey=createHash('sha256').update(JSON.stringify(segments.map(segment=>[segment.from,segment.to,segment.marketing_carrier_code,segment.flight_number,segment.departureAt,segment.arrivalAt]))).digest('hex');
  if(flightOfferError(offer,input))return fail('selected quote failed canonical itinerary validation.');
  offer.googleParty={...actual,total:party.total};offer.googleFlightSelection=googleFlightSelection(offer);offers.push(offer);
 }
 if(!offers.length)return fail('no attributable complete seller quote matched the selected flights.');
 return {offers:offers.sort((a,b)=>a.price-b.price),party,observedAt,limitation:'Quotes cover this one fully selected native return itinerary only. Other outbound/return choices and final seller acceptance have not been verified.'};
}
