import {withTransportMetrics,transportSnapshot} from './transport-metrics.mjs';
import {validateZonedItinerary} from './airport-timezones.mjs';
import {providerCapabilities,configuredProviders} from './provider-capabilities.mjs';
import {createFareSession} from './fare-session.mjs';
import {validateCalendarQuery,calendarDatePairs} from './calendar-query.mjs';
import {flightOfferError,connectionAirports} from './flight-offer.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {applyFlightFilters} from './flight-filters.mjs';
import {itineraryKey} from './ignav.mjs';
import {sourceFailure} from './source-errors.mjs';
import {ignavIdentityParty,skyscannerIdentityParty,googleRoundTripParty} from './travelers.mjs';
import {calendarSources,calendarProviders} from './calendar-query.mjs';
import {searchProviders} from './providers.mjs';
import {resolveRegion} from './regions.mjs';
import {detectDestination} from './destination.mjs';
import {resolvePlace} from './place-resolution.mjs';
import {searchGoogleCalendar} from './google-calendar.mjs';
import {matrixCalendarObservation} from './matrix-calendar-observation.mjs';

const routeLocalFailure=source=>source?.provider==='Ignav'&&source.httpStatus===424&&source.providerCode==='unable_to_complete_request'||['Google Flights','ITA Matrix'].includes(source?.provider)&&['native_query_timeout','native_direction_incomplete'].includes(source.providerCode);
const queryUnsupported=source=>['unsupported_trip','unsupported_party'].includes(source?.status);
const providerName=Object.fromEntries(calendarProviders.map(([id,label])=>[id,id==='expedia'?'Expedia':label]));
providerName.all='All configured providers';
const coverageProviderName=([id,label])=>id==='expedia'?'Expedia':label;
const sourceWideRefusal=row=>['rate_limited','rate','auth','blocked','access_denied','unconfigured'].includes(row?.status)||[401,402,403,429].includes(row?.httpStatus)||Number.isInteger(row?.httpStatus)&&row.httpStatus>=500;
const calendarDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const hasActiveCalendarFilters=filters=>Object.entries(filters??{}).some(([key,value])=>key==='sort'?value&&value!=='price':Array.isArray(value)?value.length>0:value!==undefined&&value!==null&&value!==false&&value!=='');
function recordProviderCoverage(dateRow,route,source,{responseReceived=false}={}){
 if(!calendarProviders.some(entry=>coverageProviderName(entry)===source?.provider))return;
 const index=dateRow.providerCoverage.findIndex(row=>row.provider===source.provider&&row.origin===route.origin&&row.destination===route.destination);
 const previous=index<0?{}:dateRow.providerCoverage[index];
 const next={...previous,...source,origin:route.origin,destination:route.destination,responseReceived:Boolean(previous.responseReceived||responseReceived&&!source.suppressed)};
 if(index<0)dateRow.providerCoverage.push(next);else dateRow.providerCoverage[index]=next;
}
function recordPriceObservation(dateRow,observation){
 if(!Array.isArray(dateRow.priceObservations))dateRow.priceObservations=[];
 const key=`${observation?.provider}:${observation?.date}:${observation?.returnDate??''}:${observation?.tripType??''}:${observation?.from}:${observation?.to}:${observation?.observedAt}`;
 if(!dateRow.priceObservationKeys.has(key)){dateRow.priceObservationKeys.add(key);dateRow.priceObservations.push(observation);}
}
function acceptedCalendarPriceObservations(result,query,range){
 const observations=[];
 for(const observation of result.priceObservations??[]){
  if(observation?.provider==='Google Flights'&&observation.currency==='CAD'&&observation.from===query.origin&&observation.to===query.destination&&observation.date===query.date&&(observation.returnDate??null)===(query.returnDate??null)&&observation.tripType===query.tripType){observations.push(observation);continue;}
  if(observation?.provider==='ITA Matrix'&&(result.sources??[]).some(source=>source.provider==='ITA Matrix'&&source.status==='ok'&&!source.suppressed)){
   const normalized=matrixCalendarObservation(observation,{...query,routePairs:[{origin:query.origin,destination:query.destination}]},{date:query.date,returnDate:query.returnDate??null,start:range.start,end:range.end});
   if(normalized)observations.push(normalized);
  }
 }
 return observations;
}
function calendarSearcher(source,providerOptions={},range,selected,checkpoint,onProviderResult){
 const refused=new Map();
 const googlePriceGridPromises=new Map();
 const googleCalendarEnabled=selected.some(row=>row.id==='google')&&(!providerOptions.searchGoogle||Boolean(providerOptions.searchGoogleCalendar))&&(Boolean(providerOptions.searchGoogleCalendar)||process.env.TRAVEL_GOOGLE_CALENDAR_RPC==='1');
 for(const entry of checkpoint?.responses??[])for(const row of entry.result?.sources??[])if(sourceWideRefusal(row)&&!row.suppressed)refused.set(row.provider,row);
 const supportsGooglePriceGrid=query=>{
  const exactRoundTrip=calendarDay(query.date)&&calendarDay(query.returnDate)&&query.returnDate>=query.date;
  return googleCalendarEnabled&&(query.tripType==='one-way'||query.tripType==='round-trip'&&exactRoundTrip)&&query.adults===1&&(query.children??0)===0&&(!query.cabin||query.cabin==='economy')&&!query.travelers&&!hasActiveCalendarFilters(query.filters);
 };
 const googlePriceGridResult=async(query,signal)=>{
  const sharedDepartureGrid=query.tripType==='one-way'||query.tripType==='round-trip'&&calendarDay(query.returnDate)&&query.returnDate>=range.start;
  const gridStart=sharedDepartureGrid?range.start:query.date,gridEnd=sharedDepartureGrid&&query.tripType==='round-trip'&&query.returnDate<range.end?query.returnDate:sharedDepartureGrid?range.end:query.date;
  const gridKey=JSON.stringify([query.origin,query.destination,query.tripType,query.returnDate??null,query.adults??1,query.children??0,query.childrenAges??[],query.cabin??'economy',query.filters??{},gridStart,gridEnd]);
  const sendsGridRequest=!googlePriceGridPromises.has(gridKey);
  if(sendsGridRequest)googlePriceGridPromises.set(gridKey,(providerOptions.searchGoogleCalendar??searchGoogleCalendar)({...query,start:gridStart,end:gridEnd},{signal}));
  const grid=await googlePriceGridPromises.get(gridKey);signal?.throwIfAborted();
  const observation=grid.priceObservations.find(row=>row.date===query.date&&row.from===query.origin&&row.to===query.destination&&(row.returnDate??null)===(query.returnDate??null));
  const noPrice=grid.noPriceDates.includes(query.date);
  const normalizedObservation=observation?{...observation,calendarStart:range.start,calendarEnd:range.end,sourceQueryDate:gridStart}:null;
  const sourceRow={provider:'Google Flights',status:'ok',operation:'GetCalendarPicker',received:observation||noPrice?1:0,accepted:0,priceObservations:observation?1:0,calendarDatesReturned:grid.coverage.datesReturned,wireResponses:sendsGridRequest?grid.coverage.endpointResponses??1:0,route:{origin:query.origin,destination:query.destination},reason:`Date-level ${query.tripType==='round-trip'?'round-trip for the exact return date':'one-way'} price only; no flight itinerary, seller availability, baggage or final charges were returned.`};
  return {offers:[],priceObservations:normalizedObservation?[normalizedObservation]:[],sources:[sourceRow],observedAt:grid.observedAt,complete:false,limitations:grid.limitations,...(noPrice?{noPriceDates:[query.date]}:{})};
 };
 return (query,{signal}={})=>{
   const adapters={...providerOptions,...(signal?{signal}:{}),maxPolls:8,requireSkyscannerTimeEvidence:true,onProviderResult:async event=>{if(event?.sourceId==='ita-matrix'&&event.result?.partial)await onProviderResult?.(query,event.result);}};
   if(source==='google'&&selected.length===1&&supportsGooglePriceGrid(query)){
    return (async()=>{const result=await googlePriceGridResult(query,adapters.signal);await onProviderResult?.(query,result);return result;})();
   }
   if(source!=='all')return (async()=>{const result=await searchProviders({...query,source},adapters);await onProviderResult?.(query,result);return result;})();
   return (async()=>{
    const results=new Array(selected.length);let cursor=0;
    const runNext=async()=>{
     for(;;){
      signal?.throwIfAborted();const index=cursor++;if(index>=selected.length)return;
      const row=selected[index],name=row.id==='expedia'?'Expedia':row.label,previous=refused.get(name);
      if(previous){results[index]={offers:[],sources:[{...previous,suppressed:true,reason:`Source not queried again after its earlier refusal: ${previous.reason??previous.status}`}]};continue;}
      let result;
      try{result=row.id==='google'&&supportsGooglePriceGrid(query)?await googlePriceGridResult(query,signal):await searchProviders({...query,source:row.id},adapters);}
      catch(error){result={offers:[],priceObservations:[],sources:[sourceFailure(name,error)]};}
      signal?.throwIfAborted();
      results[index]=result;await onProviderResult?.(query,result);
      for(const status of result.sources??[])if(sourceWideRefusal(status))refused.set(name,status);
     }
    };
    // Match the ordinary all-source search's conservative default while letting
    // faster providers publish before an earlier, slower adapter finishes.
    await Promise.all(Array.from({length:Math.min(2,selected.length)},runNext));
    return {offers:results.flatMap(r=>r.offers??[]),sources:results.flatMap(r=>r.sources??[]),priceObservations:results.flatMap(r=>r.priceObservations??[])};
   })();
 };
}

function observationError(offer,query){
  const canonical=offer?{...offer,via:connectionAirports(offer),...(offer.inbound?{inbound:{...offer.inbound,via:connectionAirports(offer.inbound)}}:{})}:offer;
  const error=flightOfferError(canonical,query);if(error)return error;
  if(query.source==='all'?!calendarProviders.some(([,name])=>(name==='Expedia partner API'?'Expedia':name)===offer.provider):offer.provider!==providerName[query.source])return 'source_provider';
  if(offer.provider==='Skyscanner'||offer.provider==='Google Flights'&&query.tripType==='round-trip'){
    if(offer.provider==='Skyscanner'&&(typeof offer.skyscannerSessionToken!=='string'||!offer.skyscannerSessionToken.length||offer.skyscannerSessionToken.length>512||typeof offer.skyscannerItineraryId!=='string'||!offer.skyscannerItineraryId.length||offer.skyscannerItineraryId.length>512))return 'source_reference';
    if(offer.provider==='Google Flights'){
     if(!offer.googleSellerId||!['phone','online'].includes(offer.googleBookingMode)||!/^[a-f0-9]{64}$/.test(offer.itineraryKey??''))return 'source_reference';
     try{const party=googleRoundTripParty(query);if(!offer.googleParty||['adults','children','total'].some(key=>offer.googleParty[key]!==party[key]))return 'party';}catch{return 'party';}
    }
    if(query.tripType==='round-trip'||offer.timeEvidence){
      if(offer.timeEvidence?.status!=='directory_validated')return 'time_evidence';
      const byCode=new Map();
      for(const leg of [offer,...(offer.inbound?[offer.inbound]:[])])for(const segment of leg.segments??[]){
        for(const [code,timeZone] of [[segment.from,segment.departureTimeZone],[segment.to,segment.arrivalTimeZone]]){if(byCode.has(code)&&byCode.get(code).timeZone!==timeZone)return 'time_evidence';byCode.set(code,{timeZone});}
      }
      try{const verified=validateZonedItinerary(offer,{byCode,...offer.timeEvidence});
        for(const [leg,from,to,day] of [[offer,query.origin,query.destination,query.date],...(offer.inbound?[[offer.inbound,query.destination,query.origin,query.returnDate]]:[])]){
          const segments=leg.segments,first=segments[0],last=segments.at(-1),checked=leg===offer?verified:verified.inbound;
          if(first.from!==from||last.to!==to||first.departureAt.slice(0,10)!==day||leg.departureTime!==first.departureAt.slice(11,16)||leg.arrivalDate!==last.arrivalAt.slice(0,10)||leg.arrivalTime!==last.arrivalAt.slice(11,16))return 'segments';
          if(segments.some((s,i)=>s.departure_time_utc!==checked.segments[i].departure_time_utc||s.arrival_time_utc!==checked.segments[i].arrival_time_utc))return 'time_evidence';
        }
      }catch{return 'time_evidence';}
      return null;
    }
    const segments=offer.segments;
    if(!Array.isArray(segments)||!segments.length||segments[0].from!==query.origin||segments.at(-1).to!==query.destination||segments[0].departureAt?.slice(0,10)!==query.date||segments.at(-1).arrivalAt?.slice(0,10)!==offer.arrivalDate)return 'segments';
    for(let i=0;i<segments.length;i++){
      const segment=segments[i],validLocal=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)&&Number.isFinite(Date.parse(`${value}Z`));
      if(!/^[A-Z]{3}$/.test(segment.from??'')||!/^[A-Z]{3}$/.test(segment.to??'')||!validLocal(segment.departureAt)||!validLocal(segment.arrivalAt)||segment.arrivalAt<=segment.departureAt||i>0&&(segments[i-1].to!==segment.from||segment.departureAt<segments[i-1].arrivalAt))return 'segments';
    }
    if(offer.departureDate!==segments[0].departureAt.slice(0,10)||offer.departureTime!==segments[0].departureAt.slice(11,16)||offer.arrivalDate!==segments.at(-1).arrivalAt.slice(0,10)||offer.arrivalTime!==segments.at(-1).arrivalAt.slice(11,16))return 'segments';
    return null;
  }
  if(offer.provider!=='Ignav')return null;
  if(typeof offer.ignavId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(offer.ignavId))return 'source_reference';
  const amount=Math.round(offer.price*100);
  if(!Number.isSafeInteger(amount)||amount<=0||Math.abs(offer.price*100-amount)>1e-6)return 'price_precision';
  for(const [leg,from,to,date] of [[offer,query.origin,query.destination,query.date],...(offer.inbound?[[offer.inbound,query.destination,query.origin,query.returnDate]]:[])]){
    if(!itineraryKey({outbound:leg})||leg.segments[0].departure_airport!==from||leg.segments.at(-1).arrival_airport!==to||leg.segments[0].departure_time_local.slice(0,10)!==date)return 'segments';
  }
  if(offer.inbound&&Date.parse(offer.inbound.segments[0].departure_time_utc)<Date.parse(offer.segments.at(-1).arrival_time_utc))return 'return_chronology';
  return null;
}

/** Lowest currently observed matching itinerary for each exact provider date query. */
export async function searchFareCalendar(raw,options={}){
 return withTransportMetrics(()=>executeFareCalendar(raw,options),{previous:options.checkpoint?.transportCoverage,interrupted:Boolean(options.checkpoint?.pending)});
}
async function executeFareCalendar(raw,options={}){
  let queryInput={...raw};for(const side of ['origin','destination']){
    const supplied=raw[`${side}Airports`],type=raw[`${side}Type`]??'auto';
    queryInput[`${side}Airports`]=Array.isArray(supplied)?[...supplied]:type==='region'||['auto','place'].includes(type)&&!/^[A-Z]{3}$/.test(raw[side])?[]:[raw[side]];
  }
  const locationCoverage={};
  const airportLimit=queryInput.airportLimit??10;
  const unresolved=['origin','destination'].filter(side=>!queryInput[`${side}Airports`].length&&(raw[`${side}Type`]==='region'||['auto','place'].includes(raw[`${side}Type`]??'auto')&&!/^[A-Z]{3}$/.test(raw[side])));
  if(unresolved.length){options.onProgress?.({stage:'resolving_locations'});const resolveRegional=options.resolveRegion??resolveRegion,resolvePlaceName=options.resolvePlace??resolvePlace;
    for(const side of unresolved){const requestedType=raw[`${side}Type`],detection=requestedType==='region'?{type:'region'}:requestedType==='place'?{type:'place'}:await (options.detectDestination??detectDestination)(raw[side]);
      if(!['region','place'].includes(detection.type))throw Error(`${side==='origin'?'Origin':'Destination'}: ${detection.reason??'Choose a specific airport, city or region.'}`);
      if(detection.type==='region')queryInput={...queryInput,[`${side}Type`]:'region'};
      const resolution=detection.type==='region'?await resolveRegional(detection.canonicalName??raw[side]):await resolvePlaceName(raw[side]);
      const selected=(resolution.airports??[]).slice(0,airportLimit);
      if(!selected.length)throw Error(`${side==='origin'?'Origin':'Destination'} ${detection.type} did not resolve to any airport candidates.`);
      queryInput[`${side}Airports`]=selected.map(airport=>airport.code);
      const remainingAirports=(resolution.airports??[]).slice(selected.length),resolverOmitted=resolution.uncheckedAirports??[],airportOmissions=[...remainingAirports,...resolverOmitted],omittedCount=airportOmissions.length;
      const popularityCoverage=Number.isInteger(resolution.popularityExclusionLimit)?{popularityExclusionLimit:resolution.popularityExclusionLimit,popularityRankedCandidates:resolution.popularityRankedCandidates??0,popularityExclusionShortfall:resolution.popularityExclusionShortfall??Math.max(0,resolution.popularityExclusionLimit-(resolution.excludedAirports?.length??0)),popularityExcludedAirports:(resolution.excludedAirports??[]).slice(0,20).map(({code,name,country,passengers})=>({code,...(name?{name}:{}),...(country?{country}:{}),...(Number.isFinite(passengers)?{passengers}:{})}))}:{};
      locationCoverage[side]={type:detection.type,method:resolution.method,airports:selected.map(({code,name,city,country})=>({code,name,city,country})),uncheckedAirports:airportOmissions.map(({code,name,city,country})=>({code,name,city,country})),uncheckedAirportCount:omittedCount,moreAvailable:Boolean(resolution.moreAvailable||omittedCount),...(Object.keys(popularityCoverage).length?popularityCoverage:{}),...(resolution.geographicExcludedAirportCount?{geographicExcludedAirportCount:resolution.geographicExcludedAirportCount,geographicExcludedAirports:resolution.geographicExcludedAirports??[],geographicExcludedAirportsTruncated:(resolution.geographicExcludedAirports?.length??0)<resolution.geographicExcludedAirportCount}:{}),...(resolution.geographyUnknownAirportCount?{geographyUnknownAirportCount:resolution.geographyUnknownAirportCount,geographyUnknownAirports:resolution.geographyUnknownAirports??[],geographyUnknownAirportsTruncated:(resolution.geographyUnknownAirports?.length??0)<resolution.geographyUnknownAirportCount}:{}),...(resolution.countries?{countries:resolution.countries}:{}),...(resolution.countriesUnchecked?.length?{countriesUnchecked:resolution.countriesUnchecked}:{}),...(resolution.countriesUnresolved?.length?{countriesUnresolved:resolution.countriesUnresolved}:{}),...(resolution.region?.description?{scopeDescription:resolution.region.description}:{}),...(resolution.region?.policyNote?{policyNote:resolution.region.policyNote}:{}),...(resolution.region?.policySourceUrl?{policySourceUrl:resolution.region.policySourceUrl}:{})};
    }
  }
  for(const side of ['origin','destination']){
    const field=`${side}Airports`,candidates=queryInput[field]??[];
    if(candidates.length>airportLimit){
      const selected=candidates.slice(0,airportLimit),omitted=candidates.slice(airportLimit);
      queryInput[field]=selected;
      locationCoverage[side]??={type:queryInput[`${side}Type`]??'place',method:'Airport candidates supplied by the prior location resolution; selected in their supplied order.',airports:[],uncheckedAirports:[],uncheckedAirportCount:0,moreAvailable:false};
      locationCoverage[side].airports=selected.map(code=>({code}));
      locationCoverage[side].uncheckedAirports=[...(locationCoverage[side].uncheckedAirports??[]),...omitted.map(code=>({code}))].slice(0,100);
      locationCoverage[side].uncheckedAirportCount=(locationCoverage[side].uncheckedAirportCount??0)+omitted.length;
      locationCoverage[side].moreAvailable=true;
    }
  }
  for(const side of ['origin','destination'])if(queryInput[`${side}Type`]==='region'&&queryInput[`${side}Airports`]?.length&&!locationCoverage[side])locationCoverage[side]={type:'region',method:'Previously resolved region airport set',airports:queryInput[`${side}Airports`].map(code=>({code})),uncheckedAirports:[],uncheckedAirportCount:0,moreAvailable:false};
  const candidateAirportPairs=queryInput.originAirports.flatMap(origin=>queryInput.destinationAirports.filter(destination=>destination!==origin).map(destination=>({origin,destination})));
  const preliminary=validateCalendarQuery({...queryInput,originAirports:[],destinationAirports:[],originType:'region',destinationType:'region'});
  const configured=options.searcher?undefined:{...configuredProviders(process.env)};
  if(configured){for(const [id,key] of Object.entries({ignav:'searchIgnav',google:'searchGoogle',expedia:'searchExpedia',skyscanner:'searchSkyscanner','air-canada':'searchAirCanada','ita-matrix':'searchMatrix','omkar-expedia':'searchOmkarExpedia'}))if(options.providerOptions?.[key])configured[id]=true;}
  if(configured&&options.providerOptions?.searchGoogleRoundTrip){configured.google=true;configured.googleRoundTrip=true;}
  const gridFeatureEnabled=Boolean(options.providerOptions?.searchGoogleCalendar)||process.env.TRAVEL_GOOGLE_CALENDAR_RPC==='1';
  const eligibleGooglePriceGrid=['google','all'].includes(preliminary.source)&&preliminary.tripType==='round-trip'&&preliminary.adults===1&&preliminary.children===0&&!preliminary.travelers&&preliminary.cabin==='economy'&&!hasActiveCalendarFilters(preliminary.filters)&&candidateAirportPairs.length>0&&gridFeatureEnabled;
  if(configured&&eligibleGooglePriceGrid){configured.google=true;configured.googleCalendarRpc=true;}
  const capabilities=providerCapabilities(preliminary,{calendar:true,configured}),selectedProviders=capabilities.filter(row=>row.eligible&&(preliminary.source==='all'||row.id===preliminary.source));
  if(!selectedProviders.length)throw Error('No selected provider supports this calendar query with current server access.');
  const days=calendarDatePairs(preliminary).length,providerCount=queryInput.source==='all'?selectedProviders.length:1,maxPairs=Math.floor((queryInput.searchLimit??250)/(days*providerCount));
  if(maxPairs<1)throw Error(`This date range needs at least ${days*providerCount} provider/date searches for one route pair, above the selected budget. Reduce the date range or select fewer providers.`);
  const routeCount=()=>queryInput.originAirports.reduce((count,origin)=>count+queryInput.destinationAirports.filter(destination=>origin!==destination).length,0);
  while(routeCount()>maxPairs){
    const side=['origin','destination'].filter(value=>queryInput[`${value}Airports`].length>1).sort((a,b)=>queryInput[`${b}Airports`].length-queryInput[`${a}Airports`].length)[0];
    if(!side)break;
    const removed=queryInput[`${side}Airports`].pop();
    const coverage=locationCoverage[side]??={type:queryInput[`${side}Type`]??'place',method:'Airport candidates reduced to fit the date/provider request budget; candidates retain their supplied order.',airports:queryInput[`${side}Airports`].map(code=>({code})),uncheckedAirports:[],uncheckedAirportCount:0,moreAvailable:false};
    coverage.airports=coverage.airports.filter(airport=>airport.code!==removed);
    coverage.uncheckedAirportCount++;coverage.uncheckedAirports.unshift({code:removed});coverage.moreAvailable=true;
  }
  const input=validateCalendarQuery(queryInput,{configured}),provider=providerName[input.source];
  const requestMultiplier=input.source==='all'?selectedProviders.length:1,progress=options.onProgress;let calendarPreview,streamedOffers=[],activeQueryKey='',onProviderResult;
  const defaultSearcher=calendarSearcher(input.source,options.providerOptions,{start:input.start,end:input.end,returnStart:input.returnStart,returnEnd:input.returnEnd},selectedProviders,options.checkpoint,async(query,result)=>onProviderResult?.(query,result));
  const session=await createFareSession({...input,eligibleProviderIds:selectedProviders.map(row=>row.id)},{...options,transportSnapshot,onProgress:update=>progress?.({...update,requestBudget:input.searchLimit,fareRequestsStarted:update.fareRequestsStarted*requestMultiplier,responsesReused:update.responsesReused*requestMultiplier,interruptedRequests:update.interruptedRequests*requestMultiplier,...(calendarPreview?{calendarPreview,providerResponsesReceived:calendarPreview.coverage.providerResponsesReceived,providerResponsesPlanned:calendarPreview.coverage.providerResponsesPlanned}:{})}),searcher:options.searcher??defaultSearcher,limit:Math.floor(input.searchLimit/requestMultiplier),initialStage:'calendar_searching'});
  const dates=calendarDatePairs(input);
  const checked=new Map(),pairQueriesPlanned=dates.length*input.routePairs.length;let stopped=null,pairQueriesChecked=0;const routeFailures=[],routeUnsupported=[];
  const publishPreview=()=>{
    const cells=dates.map(({date,returnDate})=>{
      const row=checked.get(JSON.stringify([date,returnDate]));
      if(!row)return {date,returnDate,currency:'CAD',price:null,status:'not_scanned',providerCoverage:[],reason:'Waiting for this date combination to be searched.'};
      if(row.unsupported)return {date,returnDate,currency:'CAD',price:null,status:'unsupported_party',reason:row.unsupported};
      const currentKey=JSON.stringify([date,returnDate]);
      const offers=[...row.candidates,...(activeQueryKey===currentKey?streamedOffers:[])].filter(candidate=>quoteFreshness(candidate).status==='fresh').sort((a,b)=>a.price-b.price);
      const offer=offers[0]??null;
      const complete=row.pairQueriesChecked===input.routePairs.length;
      const priceObservations=row.priceObservations??[];
      return {date,returnDate,currency:'CAD',price:offer?.price??null,status:complete?(offer?'observed':priceObservations.length?'price_only_observed':'no_matching_observation'):'partial_route_coverage',offer,offers,priceObservations,route:offer?{origin:offer.from,destination:offer.to}:null,providerCoverage:row.providerCoverage,observedAt:offer?.observedAt??priceObservations[0]?.observedAt??null,expiresAt:offer?.expiresAt??null,received:row.received,rejected:row.rejected,filterRejected:row.filterRejected,reason:complete?(offer?null:priceObservations.length?'A date-level price was returned without an itinerary. Run an exact-date search to see flights and refresh the price.':'No matching observation yet for this date.'):`${row.pairQueriesChecked} of ${input.routePairs.length} airport pairs completed; any shown fare is provisional.`};
    });
    const datesChecked=[...checked.values()].filter(row=>!row.unsupported&&row.pairQueriesChecked===input.routePairs.length).length;
    const providerResponsesReceived=[...checked.values()].reduce((count,row)=>count+(row.providerCoverage??[]).filter(source=>source.responseReceived).length,0);
    const providerResponsesPlanned=pairQueriesPlanned*requestMultiplier;
    const progressLocationCoverage=Object.fromEntries(Object.entries(locationCoverage).map(([side,coverage])=>[side,{...coverage,uncheckedAirports:(coverage.uncheckedAirports??[]).slice(0,20),uncheckedAirportsSampled:(coverage.uncheckedAirports?.length??0)>20}]));
    calendarPreview={partial:true,status:'running',query:input,...(Object.keys(locationCoverage).length?{locationCoverage:progressLocationCoverage}:{}),observedAt:new Date().toISOString(),dates:cells,coverage:{datesPlanned:dates.length,datesChecked,datesWithQuotes:cells.filter(cell=>cell.offer).length,datesWithPriceObservations:cells.filter(cell=>cell.priceObservations?.length).length,datesUnsupported:cells.filter(cell=>cell.status==='unsupported_party').length,datesRejected:0,datesExpired:0,datesNoMatch:cells.filter(cell=>cell.status==='no_matching_observation').length,datesNotScanned:cells.filter(cell=>cell.status==='not_scanned').length,pairQueriesPlanned,pairQueriesChecked,pairQueriesNotScanned:Math.max(0,pairQueriesPlanned-pairQueriesChecked),providerResponsesReceived,providerResponsesPlanned,pairQueriesUnsupported:0,providerDispatchesSuppressed:0,fareRequestsStarted:session.coverage.fareRequestsStarted*requestMultiplier,responsesReused:session.coverage.responsesReused*requestMultiplier},limitation:'Itinerary quotes and date-level price observations are separate; price-only values do not identify flights or verify seller availability.'};
    progress?.({stage:'calendar_results_streaming',calendarPreview,datesPlanned:dates.length,datesChecked,pairQueriesPlanned,pairQueriesChecked,providerResponsesReceived,providerResponsesPlanned,...session.coverage,requestBudget:input.searchLimit,fareRequestsStarted:session.coverage.fareRequestsStarted*requestMultiplier,responsesReused:session.coverage.responsesReused*requestMultiplier});
  };
  onProviderResult=async(query,result)=>{
    if(activeQueryKey!==JSON.stringify([query.date,query.returnDate]))return;
    const dateRow=checked.get(JSON.stringify([query.date,query.returnDate]));
    if(!dateRow)return;
    for(const source of result.sources??[])recordProviderCoverage(dateRow,query,source,{responseReceived:true});
    for(const observation of acceptedCalendarPriceObservations(result,query,{start:input.start,end:input.end}))recordPriceObservation(dateRow,observation);
    const expected=input.source==='all'?null:providerName[input.source];
    const usable=new Set((result.sources??[]).filter(row=>row.status==='ok'&&!row.partial&&(!expected||row.provider===expected)).map(row=>row.provider));
    const validatedQuery={...query,source:input.source};
    const valid=(result.offers??[]).filter(offer=>usable.has(offer?.provider)&&!observationError(offer,validatedQuery));
    if(!valid.length){publishPreview();return;}
    const filtered=await applyFlightFilters(valid,{...input.filters,sort:'price'},options.filterOptions);
    streamedOffers.push(...filtered.offers);publishPreview();
  };
  session.report({datesPlanned:dates.length,datesChecked:0,pairQueriesPlanned,pairQueriesChecked:0});
  for(const {date,returnDate} of dates){
    const dateKey=JSON.stringify([date,returnDate]);
    session.check();
    const party=input.travelers?{travelers:input.travelers}:{adults:input.adults,children:input.children,childrenAges:input.childrenAges};
  const dateRow={candidates:[],priceObservations:[],priceObservationKeys:new Set(),received:0,validCount:0,rejected:{},filterRejected:{},pairQueriesChecked:0,providerCoverage:[]};checked.set(dateKey,dateRow);publishPreview();
    const identityQuery={date,tripType:input.tripType,source:input.source,...(input.tripType==='round-trip'?{returnDate}:{}),cabin:input.cabin,filters:input.filters,...party};
    if(input.travelers)try{if(input.source==='google'||selectedProviders.every(row=>row.id==='google'))googleRoundTripParty(identityQuery);else if(input.source==='skyscanner'||selectedProviders.every(row=>row.id==='skyscanner'))skyscannerIdentityParty(identityQuery);else ignavIdentityParty(identityQuery);}catch(error){checked.set(dateKey,{unsupported:error.message});session.report({datesChecked:[...checked.values()].filter(row=>!row.unsupported&&row.pairQueriesChecked===input.routePairs.length).length,date,pairQueriesChecked});continue;}
    for(const route of input.routePairs){
      session.check();
      const query={...identityQuery,...route};
      try{
        activeQueryKey=dateKey;streamedOffers=[];
        const result=await session.search(query);
        streamedOffers=[];activeQueryKey='';
        if(!Array.isArray(result?.offers)||!Array.isArray(result.sources))throw Error('The provider returned an invalid calendar fare response.');
        const groups=new Map();
        for(const row of result.sources)if(calendarProviders.some(([,name])=>(name==='Expedia partner API'?'Expedia':name)===row.provider)){const values=groups.get(row.provider)??[];values.push(row);groups.set(row.provider,values);}
        const requestedProviders=input.source==='all'?selectedProviders.map(row=>row.id==='expedia'?'Expedia':row.label):[provider];
        const sourceStatuses=requestedProviders.map(name=>{const rows=groups.get(name)??[];const failed=rows.find(row=>row.status!=='ok'||row.partial);return !rows.length?{provider:name,status:'missing'}:failed?failed:{...rows[0],provider:name,status:'ok'};});
        const usableProviders=new Set(sourceStatuses.filter(row=>row.status==='ok'&&!row.partial).map(row=>row.provider));
        for(const source of sourceStatuses)recordProviderCoverage(dateRow,route,source,{responseReceived:source.status!=='missing'});
        if(!usableProviders.size&&sourceStatuses.every(queryUnsupported)){routeUnsupported.push({date,returnDate,...route,sources:sourceStatuses});dateRow.providerCoverage.at(-1).routeComplete=true;publishPreview();continue;}
        if(!usableProviders.size&&sourceStatuses.some(routeLocalFailure)&&sourceStatuses.every(s=>routeLocalFailure(s)||['unsupported_trip','unsupported_party','unconfigured'].includes(s.status))){routeFailures.push({date,returnDate,...route,sources:sourceStatuses});dateRow.providerCoverage.at(-1).routeComplete=true;publishPreview();continue;}
        if(!usableProviders.size){stopped={status:'source_unavailable',source:input.source==='all'?{provider,status:'error',reason:'No selected provider completed this exact airport-pair date search.',providers:sourceStatuses}:sourceStatuses[0]};break;}
        const providerOffers=result.offers.filter(offer=>!offer||usableProviders.has(offer.provider));
        for(const observation of acceptedCalendarPriceObservations(result,query,{start:input.start,end:input.end}))recordPriceObservation(dateRow,observation);
        dateRow.received+=providerOffers.length;
        const valid=providerOffers.filter(offer=>{const reason=observationError(offer,query);if(reason)dateRow.rejected[reason]=(dateRow.rejected[reason] ?? 0)+1;return !reason;});
        dateRow.validCount+=valid.length;
        const journeys=valid.map(offer=>({...offer,via:offer.via,...(offer.inbound?{inbound:{...offer.inbound,via:offer.inbound.via}}:{})}));
        const filtered=await applyFlightFilters(journeys,{...input.filters,sort:'price'},options.filterOptions);
        dateRow.candidates.push(...filtered.offers);
        for(const [key,count] of Object.entries(filtered.rejected))dateRow.filterRejected[key]=(dateRow.filterRejected[key] ?? 0)+count;
        dateRow.pairQueriesChecked++;pairQueriesChecked++;
        publishPreview();
        session.report({datesChecked:[...checked.values()].filter(row=>!row.unsupported&&row.pairQueriesChecked===input.routePairs.length).length,date,pairQueriesChecked});
      }catch(error){
        dateRow.candidates.push(...streamedOffers);streamedOffers=[];activeQueryKey='';
        session.check();const failure=sourceFailure(provider,error);if(routeLocalFailure(failure)||queryUnsupported(failure)){recordProviderCoverage(dateRow,route,failure);(queryUnsupported(failure)?routeUnsupported:routeFailures).push({date,returnDate,...route,sources:[failure]});publishPreview();continue;}stopped=session.budgetExhausted?{status:'budget_exhausted',reason:error.message}:{status:'source_unavailable',source:failure};publishPreview();break;
      }
    }
    checked.set(dateKey,dateRow);
    if(stopped)break;
  }
  session.check();
  const cells=dates.map(({date,returnDate})=>{
    const row=checked.get(JSON.stringify([date,returnDate]));
    if(!row)return {date,returnDate,currency:'CAD',price:null,status:'not_scanned',providerCoverage:[],reason:stopped?.source?.reason ?? stopped?.reason ?? 'This date was not checked.'};
    if(row.unsupported)return {date,returnDate,currency:'CAD',price:null,status:'unsupported_party',reason:row.unsupported};
    if(routeUnsupported.filter(entry=>entry.date===date&&entry.returnDate===returnDate).length===input.routePairs.length)return {date,returnDate,currency:'CAD',price:null,status:'unsupported_trip',pairQueriesChecked:0,pairQueriesPlanned:input.routePairs.length,providerCoverage:row.providerCoverage,reason:'No selected provider supports this exact query for any selected airport pair. Other date combinations were checked independently.'};
    if(row.pairQueriesChecked===0)return {date,returnDate,currency:'CAD',price:null,status:routeFailures.some(f=>f.date===date&&f.returnDate===returnDate)?'source_failure':'not_scanned',offers:row.candidates.filter(offer=>quoteFreshness(offer).status==='fresh').sort((a,b)=>a.price-b.price),pairQueriesChecked:0,pairQueriesPlanned:input.routePairs.length,providerCoverage:row.providerCoverage,reason:stopped?.source?.reason ?? stopped?.reason ?? 'No airport pair completed successfully for this date; check provider coverage for failures.'};
    const fresh=row.candidates.filter(offer=>quoteFreshness(offer).status==='fresh').sort((a,b)=>a.price-b.price);
    if(row.pairQueriesChecked!==input.routePairs.length)return {date,returnDate,currency:'CAD',price:null,status:'partial_route_coverage',offers:fresh,pairQueriesChecked:row.pairQueriesChecked,pairQueriesPlanned:input.routePairs.length,providerCoverage:row.providerCoverage,received:row.received,rejected:row.rejected,filterRejected:row.filterRejected,reason:`Only ${row.pairQueriesChecked} of ${input.routePairs.length} airport pairs were checked; no lowest-route price is displayed.`};
    const offer=fresh[0] ?? null;
    const rejectedOnly=row.received>0&&row.validCount===0;
    return {date,returnDate,currency:'CAD',price:offer?.price ?? null,status:offer?'observed':row.candidates.length?'expired':rejectedOnly?'rejected_observations':row.priceObservations.length?'price_only_observed':'no_matching_observation',offer,offers:fresh,priceObservations:row.priceObservations,route:offer?{origin:offer.from,destination:offer.to}:null,providerCoverage:row.providerCoverage,observedAt:offer?.observedAt ?? row.priceObservations[0]?.observedAt ?? null,expiresAt:offer?.expiresAt ?? null,received:row.received,rejected:row.rejected,filterRejected:row.filterRejected,reason:offer?null:row.candidates.length?'Matching observations expired before this scan finished.':rejectedOnly?'Returned itineraries failed source or application quote validation. No price is displayed.':row.priceObservations.length?'A date-level price was returned without an itinerary. Run an exact-date search to see flights and refresh the price.':'No returned current offer matched these exact airport pairs, dates and filters.'};
  });
  const quoted=cells.filter(cell=>cell.offer),unsupported=cells.filter(c=>queryUnsupported(c)).length;
  const providerQueriesPerDate=input.routePairs.length*requestMultiplier;
  const completeDates=cells.filter(c=>{const row=checked.get(JSON.stringify([c.date,c.returnDate]));return row?.pairQueriesChecked===input.routePairs.length&&!row.unsupported&&(input.source!=='all'||row.providerCoverage.length===providerQueriesPerDate&&row.providerCoverage.every(s=>s.status==='ok'&&!s.partial));}).length;
  const sourceCoverage=input.source==='all'?calendarProviders.map(([id,label])=>{const name=id==='expedia'?'Expedia':label,entries=[...checked.values()].flatMap(row=>(row.providerCoverage??[]).filter(source=>source.provider===name));const capability=capabilities.find(row=>row.id===id);return {provider:label,excluded:!selectedProviders.some(row=>row.id===id),reason:capability?.reason,planned:selectedProviders.some(row=>row.id===id)?dates.length*input.routePairs.length:0,queries:entries.filter(source=>!source.suppressed).length,suppressed:entries.filter(source=>source.suppressed).length,successful:entries.filter(source=>source.status==='ok'&&!source.partial).length,unavailable:entries.filter(source=>source.status!=='ok'||source.partial).length};}):undefined;
  const sessionCoverage=session.coverage;
  const finalPairs=new Set(input.routePairs.map(pair=>`${pair.origin}:${pair.destination}`));
  const airportPairsUncheckedByBudget=candidateAirportPairs.filter(pair=>!finalPairs.has(`${pair.origin}:${pair.destination}`)).map(pair=>({...pair,reason:'reduced_to_fit_request_budget'}));
  const airportPairsNotSearched=dates.flatMap(({date,returnDate})=>{
    const row=checked.get(JSON.stringify([date,returnDate])),attempted=new Set((row?.providerCoverage??[]).map(item=>`${item.origin}:${item.destination}`));
    return input.routePairs.filter(pair=>!attempted.has(`${pair.origin}:${pair.destination}`)).map(pair=>({date,returnDate,...pair,reason:row?.unsupported?'party_unsupported':row?'stopped_before_query':'date_not_started'}));
  });
  const providerResponsesReceived=[...checked.values()].reduce((count,row)=>count+(row.providerCoverage??[]).filter(source=>source.responseReceived).length,0);
  const coverage={...sessionCoverage,providerResponsesReceived,providerResponsesPlanned:pairQueriesPlanned*requestMultiplier,requestBudget:input.searchLimit,airportLimit:input.airportLimit,airportPairsUncheckedByBudget,airportPairsNotSearched,routeFailures,routeUnsupported,providerCapabilities:capabilities,providerSlotsReserved:sessionCoverage.fareRequestsStarted*requestMultiplier,providerDispatchesSuppressed:[...checked.values()].flatMap(row=>row.providerCoverage??[]).filter(row=>row.suppressed).length,fareRequestsStarted:sessionCoverage.fareRequestsStarted*requestMultiplier,responsesReused:sessionCoverage.responsesReused*requestMultiplier,interruptedRequests:sessionCoverage.interruptedRequests*requestMultiplier,datesPlanned:dates.length,datesChecked:completeDates,datesWithQuotes:quoted.length,datesWithPriceObservations:cells.filter(cell=>cell.priceObservations?.length).length,datesNotScanned:cells.filter(c=>c.status==='not_scanned').length,datesUnsupported:unsupported,datesRejected:cells.filter(c=>c.status==='rejected_observations').length,datesExpired:cells.filter(c=>c.status==='expired').length,datesNoMatch:cells.filter(c=>c.status==='no_matching_observation').length,pairQueriesPlanned,pairQueriesChecked,pairQueriesFailed:routeFailures.length,pairQueriesUnsupported:routeUnsupported.length,pairQueriesNotScanned:pairQueriesPlanned-pairQueriesChecked-routeFailures.length-routeUnsupported.length,airportPairsPlanned:input.routePairs.length,fullyScanned:pairQueriesChecked===pairQueriesPlanned&&unsupported===0&&completeDates===dates.length,...(sourceCoverage?{sourceCoverage}:{})};
  return {status:stopped?.status ?? (routeFailures.length?'partial_source_failure':routeUnsupported.length?'partial_unsupported':'complete'),query:input,...(Object.keys(locationCoverage).length?{locationCoverage}:{}),observedAt:new Date().toISOString(),dates:cells,coverage,stopped,limitation:`${input.source==='all'?'Each price is the lowest fresh returned itinerary among providers that completed the exact query. Per-provider coverage below discloses unavailable or unsupported sources.':'Each price is the lowest fresh returned '+provider+' itinerary'} across every selected airport pair for its exact date, cabin, party and filters. The selected airport sets and request cap bound coverage; this is not an exhaustive market minimum or confirmed booking. Taxes, baggage, fees and seller availability require confirmation. ${selectedProviders.some(row=>row.id==='google')&&input.tripType==='round-trip'?'Google native returns cover one selected eligible itinerary per exact query, not every outbound/return option; phone-only seller quotes are labeled. Browser RPCs and assets are additional and outside shared HTTP counters. ':''}${input.source==='skyscanner'?'Skyscanner may make up to eight poll requests per fare query; incomplete searches are withheld and API credentials are required.':'Provider pacing, transport retries and seller lookups are additional to the route/date search budget.'}`};
}
