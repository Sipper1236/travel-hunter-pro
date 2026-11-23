import {matrixParty} from './travelers.mjs';

const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)&&day(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&!/[+-]14:(?!00)/.test(value);
const activeFilters=filters=>Object.entries(filters??{}).some(([key,value])=>key==='sort'?value&&value!=='price':Array.isArray(value)?value.length>0:value!==undefined&&value!==null&&value!==false&&value!==''&&value!==0);
const travelerNouns={adults:['adult','adults'],youths:['youth','youths'],children:['child','children'],seniors:['senior','seniors'],infantsInSeat:['infant in seat','infants in seats'],infantsInLap:['lap infant','lap infants']};
function matrixTravelerSummary(passengers){return Object.entries(passengers).map(([type,count])=>`${count} ${(travelerNouns[type]??[type,type])[count===1?0:1]}`).join(', ');}
function matrixStateMatches(sourceUrl,query,date,returnDate){
 try{
  const url=new URL(sourceUrl);if(url.origin!=='https://matrix.itasoftware.com'||url.pathname!=='/flights'||url.username||url.password||url.hash)return false;
  const encoded=url.searchParams.get('search');if(!encoded)return false;
  const state=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
  const expectedType=returnDate?'round-trip':'one-way',slice=state?.slices?.length===1?state.slices[0]:null,dates=slice?.dates;
  const cabin={economy:'COACH',premium_economy:'PREMIUM_COACH',business:'BUSINESS',first:'FIRST'}[query.cabin??'economy'];
  const passengers=matrixParty({...query,date,tripType:expectedType,...(returnDate?{returnDate}:{}),...(returnDate?{}:{returnDate:undefined})},[date,...(returnDate?[returnDate]:[])]);
  const pax=Object.fromEntries(Object.entries(passengers).map(([key,count])=>[key==='youths'?'youth':key,String(count)]));
  return state.type===expectedType&&dates?.searchDateType==='specific'&&dates.departureDate===date&&(dates.returnDate??'')===(returnDate??'')&&slice.origin?.length===1&&slice.origin[0]===query.from&&slice.dest?.length===1&&slice.dest[0]===query.to&&state.options?.cabin===cabin&&state.options?.allowAirportChanges===String(query.matrixOptions?.allowAirportChanges??true)&&state.options?.stops==='-1'&&state.options?.extraStops==='-1'&&state.options?.showOnlyAvailable==='true'&&JSON.stringify(state.pax)===JSON.stringify(pax);
 }catch{return false;}
}

/** Normalize only a query-bound Matrix group total for an unfiltered exact calendar cell. */
export function matrixCalendarObservation(observation,query,{date,returnDate,start=query.start,end=query.end}={}){
 if(!observation||observation.provider!=='ITA Matrix'||activeFilters(query?.filters))return null;
 const tripType=query?.tripType??'one-way',expectedReturn=tripType==='round-trip'?returnDate??query.returnDate??null:null;
 const routes=Array.isArray(query?.routePairs)?query.routePairs:[{origin:query?.origin,destination:query?.destination}];
 const route=routes.find(pair=>pair?.origin===observation.origin&&pair?.destination===observation.destination);
 if(!route||!day(date)||observation.departureDate!==date||(observation.returnDate??null)!==expectedReturn||!['one-way','round-trip'].includes(tripType)||tripType==='round-trip'&&(!day(expectedReturn)||expectedReturn<date)||tripType==='one-way'&&observation.returnDate!==undefined)return null;
 const amount=Math.round(observation.price*100);
 if(observation.currency!=='CAD'||!Number.isSafeInteger(amount)||amount<=0||Math.abs(observation.price*100-amount)>1e-6||observation.priceScope!=='Matrix-reported group total'||observation.itineraryVerified!==false||observation.cabin!==(query.cabin??'economy')||typeof observation.travelers!=='string'||!instant(observation.observedAt))return null;
 if(!day(start)||!day(end)||end<start||query.start!==undefined&&start!==query.start||query.end!==undefined&&end!==query.end||observation.calendarStart!==undefined&&observation.calendarStart!==start||observation.calendarEnd!==undefined&&observation.calendarEnd!==end||observation.from!==undefined&&observation.from!==observation.origin||observation.to!==undefined&&observation.to!==observation.destination||observation.date!==undefined&&observation.date!==date||observation.tripType!==undefined&&observation.tripType!==tripType)return null;
 if(Date.parse(observation.observedAt)>Date.now()+120000||!matrixStateMatches(observation.sourceUrl,{...query,from:route.origin,to:route.destination},date,expectedReturn))return null;
 let expectedTravelers;try{const passengers=matrixParty({...query,date,tripType,...(expectedReturn?{returnDate:expectedReturn}:{})},[date,...(expectedReturn?[expectedReturn]:[])]);expectedTravelers=matrixTravelerSummary(passengers);}catch{return null;}
 if(observation.travelers!==expectedTravelers)return null;
 return {...observation,from:route.origin,to:route.destination,date,tripType,calendarStart:start,calendarEnd:end};
}
