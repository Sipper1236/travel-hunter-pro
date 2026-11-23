import {lookupAirportCountries} from './airport-countries.mjs';
import {connectionAirports} from './flight-offer.mjs';
import {elapsedJourneyMinutes} from './elapsed-duration.mjs';
export {validateFilters} from './flight-filter-query.mjs';
function segmentCodes(leg){
 if(!Array.isArray(leg.segments)||!leg.segments.length)return null;
 const codes=leg.segments.map(s=>s.marketing_carrier_code||s.carrierCode||s.airline);
 return codes.every(c=>typeof c==='string'&&/^[A-Z0-9]{2}$/.test(c))?codes:null;
}
function layovers(leg){
  const via=connectionAirports(leg);if(via===null)return null;
  if(via.length===0)return [];
  if(!Array.isArray(leg.segments)||leg.segments.length!==via.length+1)return null;
 const times=[];
 for(let i=1;i<leg.segments.length;i++){
  const a=leg.segments[i-1],b=leg.segments[i],arrival=Date.parse(a.arrival_time_utc),departure=Date.parse(b.departure_time_utc);
  if(!Number.isFinite(arrival)||!Number.isFinite(departure)||departure<arrival)return null;
  times.push((departure-arrival)/60000);
 }
 return times;
}
export function filterOffers(offers,filters,countries=new Map()){
 const rejected={stops:0,budget:0,unknownStops:0,duration:0,unknownDuration:0,departureTime:0,unknownDepartureTime:0,airline:0,unknownAirline:0,layover:0,unknownLayover:0,country:0,unknownCountry:0};
 const filtered=offers.filter(o=>{
  if(filters.maxPrice!==null && o.price>filters.maxPrice){rejected.budget++;return false;}
  const legs=[o,...(o.inbound?[o.inbound]:[])];
  if(filters.maxDurationMinutes!==null){const durations=legs.map(elapsedJourneyMinutes);if(durations.some(value=>!Number.isFinite(value)||value<=0)){rejected.unknownDuration++;return false;}if(durations.some(value=>value>filters.maxDurationMinutes)){rejected.duration++;return false;}}
  if(filters.departureWindow!==null){
   const times=legs.map(leg=>typeof leg.departureTime==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(leg.departureTime)?Number(leg.departureTime.slice(0,2))*60+Number(leg.departureTime.slice(3)):null);
   if(times.some(value=>value===null)){rejected.unknownDepartureTime++;return false;}
   const [start,end]={before_0600:[0,360], '0600_1200':[360,720], '1200_1800':[720,1080], '1800_2400':[1080,1440]}[filters.departureWindow];
   if(times.some(value=>value<start||value>=end)){rejected.departureTime++;return false;}
  }
   if(filters.maxStops!==null){const connections=legs.map(connectionAirports);if(connections.some(v=>v===null)){rejected.unknownStops++;return false;} if(connections.some(v=>v.length>filters.maxStops)){rejected.stops++;return false;}}
  if(filters.airlinesInclude.length||filters.airlinesExclude.length){
   const codes=legs.map(segmentCodes);if(codes.some(c=>c===null)){rejected.unknownAirline++;return false;}
   const all=codes.flat();if(all.some(c=>filters.airlinesExclude.includes(c))||(filters.airlinesInclude.length&&all.some(c=>!filters.airlinesInclude.includes(c)))){rejected.airline++;return false;}
  }
  if(filters.countriesExclude.length){
    const via=legs.map(connectionAirports);if(via.some(v=>v===null)){rejected.unknownCountry++;return false;}
   const airports=via.flat();if(airports.some(code=>!countries.has(code))){rejected.unknownCountry++;return false;}
   if(airports.some(code=>filters.countriesExclude.includes(countries.get(code)))){rejected.country++;return false;}
  }
  if(filters.minLayover!==null||filters.maxLayover!==null){
   const waits=legs.map(layovers);if(waits.some(w=>w===null)){rejected.unknownLayover++;return false;}
   if(waits.flat().some(m=>(filters.minLayover!==null&&m<filters.minLayover)||(filters.maxLayover!==null&&m>filters.maxLayover))){rejected.layover++;return false;}
  }
  return true;
 });
 const value=o=>filters.sort==='duration'?(()=>{const outbound=elapsedJourneyMinutes(o),inbound=o.inbound?elapsedJourneyMinutes(o.inbound):0;return Number.isFinite(outbound)&&Number.isFinite(inbound)?outbound+inbound:Infinity;})():filters.sort==='departure'?(typeof o.departureTime==='string'?o.departureTime:'99:99'):o.price;
 filtered.sort((a,b)=>{const x=value(a),y=value(b);return typeof x==='string'?x.localeCompare(y):filters.sort==='price_high'?y-x:x-y;});
 return {offers:filtered,rejected};
}

export async function applyFlightFilters(offers,filters,options={}){
  const airports=filters.countriesExclude.length?offers.flatMap(o=>[o,...(o.inbound?[o.inbound]:[])].flatMap(l=>connectionAirports(l)??[])):[];
 const countries=airports.length?await (options.lookup ?? lookupAirportCountries)(airports):new Map();
 return filterOffers(offers,filters,countries);
}
