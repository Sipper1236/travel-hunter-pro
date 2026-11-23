import {Temporal} from '@js-temporal/polyfill';
import {fetchSource} from './source-fetch.mjs';
import {createRegionCache} from './region-cache.mjs';
import {join} from 'node:path';
export const TIMEZONE_SOURCE='https://raw.githubusercontent.com/mwgg/Airports/master/airports.json';
const cache=createRegionCache({directory:process.env.TRAVEL_TIMEZONE_CACHE_DIR??join(process.cwd(),'.cache','airport-timezones-v1')});
export function timezoneRecords(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Airport timezone directory has an invalid shape.');
 const groups=new Map();
 for(const [icao,airport] of Object.entries(data)){
  if(!/^[A-Z]{3}$/.test(airport?.iata??''))continue;
  const rows=groups.get(airport.iata)??[];rows.push({icao,airport});groups.set(airport.iata,rows);
 }
 const records=[];
 for(const [code,rows] of groups){
  if(rows.length!==1)continue;
  const {icao,airport}=rows[0];
  if(airport.icao!==icao||typeof airport.tz!=='string'||!airport.tz.includes('/')||!airport.name)continue;
  try{new Intl.DateTimeFormat('en',{timeZone:airport.tz});}catch{continue;}
  records.push({code,icao,name:airport.name,timeZone:airport.tz});
 }
 return records;
}
export async function airportTimezones(options={}){
 const snapshot=await cache('world',async()=>{
  const response=await fetchSource('Airport timezone directory',TIMEZONE_SOURCE,{signal:options.signal},{timeoutMs:45000});
  const reader=response.body.getReader(),parts=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>15_000_000){await reader.cancel();throw Error('Timezone directory exceeds size limit.');}parts.push(Buffer.from(value));}
  const airports=timezoneRecords(JSON.parse(Buffer.concat(parts).toString('utf8')));if(airports.length<1000)throw Error('Timezone directory has too few unambiguous airport records.');
  return {region:{name:'Airport IANA timezones'},airports};
 });
 if(snapshot.cache.status==='stale')throw Error('Fresh airport timezone evidence is unavailable; expired snapshot was not used.');
 return {byCode:new Map(snapshot.airports.map(row=>[row.code,row])),sourceUrl:TIMEZONE_SOURCE,retrievedAt:snapshot.cache.savedAt};
}
export function airportLocalInstant(local,timeZone){
 if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local))throw Error('Exact airport-local date and time required.');
 const plain=Temporal.PlainDateTime.from(local,{overflow:'reject'});
 return plain.toZonedDateTime(timeZone,{disambiguation:'reject'}).toInstant().toString();
}
export function airportLocalMatchesInstant(local,instant,timeZone){
 try{
  if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local)||typeof timeZone!=='string'||(!timeZone.includes('/')&&timeZone!=='UTC'))return false;
  const localDateTime=Temporal.PlainDateTime.from(local,{overflow:'reject'});
  const instantDateTime=Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDateTime();
  return Temporal.PlainDateTime.compare(localDateTime,instantDateTime)===0;
 }catch{return false;}
}
export function validateZonedItinerary(offer,evidence){
 const legs=[offer,...(offer.inbound?[offer.inbound]:[])];let outboundArrival;
 const validated=legs.map((leg,index)=>{
  if(!Array.isArray(leg.segments)||!leg.segments.length)throw Error('Complete flight segments required for timezone validation.');
  let priorArrival,priorAirport;
  const segments=leg.segments.map(segment=>{
   if(priorAirport&&priorAirport!==segment.from)throw Error('Flight segments do not connect at the same airport.');
   const from=evidence.byCode.get(segment.from),to=evidence.byCode.get(segment.to);if(!from||!to)throw Error('An airport has no unambiguous timezone evidence.');
   const departureUtc=airportLocalInstant(segment.departureAt,from.timeZone),arrivalUtc=airportLocalInstant(segment.arrivalAt,to.timeZone);
   if(Date.parse(arrivalUtc)<=Date.parse(departureUtc)||priorArrival&&Date.parse(departureUtc)<Date.parse(priorArrival))throw Error('Flight segment chronology is invalid.');
   priorArrival=arrivalUtc;priorAirport=segment.to;
   return {...segment,departure_time_utc:departureUtc,arrival_time_utc:arrivalUtc,departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone};
  });
  if(index===1&&Date.parse(segments[0].departure_time_utc)<Date.parse(outboundArrival))throw Error('Return departs before outbound arrival.');
  outboundArrival=segments.at(-1).arrival_time_utc;
  return {...leg,segments};
 });
 return {...validated[0],...(offer.inbound?{inbound:validated[1]}:{}),timeEvidence:{sourceUrl:evidence.sourceUrl,retrievedAt:evidence.retrievedAt,tzdbVersion:process.versions.tz??'runtime',status:'directory_validated'}};
}
