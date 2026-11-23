import {sourceFailure} from './source-errors.mjs';
import {matrixParty,validateSearchParty,skyscannerIdentityParty,googleRoundTripParty,validateTravelerIdentities,rejectUnsupportedTravelerFields} from './travelers.mjs';
import {searchGoogleRoundTrip} from './google-native.mjs';
import {validateFilters,applyFlightFilters} from './flight-filters.mjs';
import { searchFlights,canadianFetch } from './search.mjs';
import { searchIgnav } from './ignav.mjs';
import { searchExpedia } from './expedia.mjs';
import { searchSkyscanner } from './skyscanner.mjs';
import { searchAirCanada } from './air-canada.mjs';
import { flightOfferError } from './flight-offer.mjs';
import { searchMatrix } from './ita-matrix.mjs';
import {validateMatrixOptions} from './matrix-options.mjs';
import { searchOmkarExpedia, expediaSearchUrl } from './omkar-expedia.mjs';
import {withTransportMetrics,mergeTransportCoverage} from './transport-metrics.mjs';
import {searchIgnavWithCache} from './ignav-response-cache.mjs';

async function searchSingleProvider(input, options = {}) {
  let party;
  if(input.travelers&&input.source==='google'){
   rejectUnsupportedTravelerFields({...input,travelers:undefined});
   if(['adults','children','childrenAges'].some(key=>input[key]!==undefined))throw Error('Use identified travelers or counts, not both.');
   party={people:validateTravelerIdentities(input.travelers,input.tripType==='round-trip'?[input.date,input.returnDate]:[input.date])};
  }else party=input.travelers&&input.source==='skyscanner'?skyscannerIdentityParty(input):validateSearchParty(input);
  const identified=Boolean(party.people);
  const filters=validateFilters(input.filters);
  const tripType=input.tripType ?? 'one-way';
  if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
  if(tripType==='round-trip' && (typeof input.returnDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate) || !Number.isFinite(Date.parse(input.returnDate+'T00:00:00Z')) || new Date(input.returnDate+'T00:00:00Z').toISOString().slice(0,10)!==input.returnDate || input.returnDate<input.date))throw Error('Enter a valid return date on or after departure.');
  const requested = input.source ?? 'all';
  if (!['all', ...FLIGHT_PROVIDER_IDS].includes(requested)) throw new Error('Choose a configured flight source.');
  const statuses = [], offers = [], priceObservations=[];
  const wants = provider => requested === 'all' || requested === provider;

  if(wants('google')&&tripType==='round-trip'){
   let supported=true;try{googleRoundTripParty(input);}catch(error){supported=false;statuses.push({provider:'Google Flights',status:'unsupported_party',reason:error.message});}
   if(supported){
    if(process.env.TRAVEL_GOOGLE_ROUND_TRIP!=='1'&&!options.searchGoogleRoundTrip)statuses.push({provider:'Google Flights',status:'unconfigured',reason:'Enable TRAVEL_GOOGLE_ROUND_TRIP=1 for the verified native browser operation.'});
    else try{const result=await (options.searchGoogleRoundTrip??searchGoogleRoundTrip)(input,{...options.googleOptions,...(options.signal?{signal:options.signal}:{})});offers.push(...result.offers);statuses.push(...result.sources);}catch(error){statuses.push(sourceFailure('Google Flights',error));}
   }
  }
  if (wants('google') && tripType==='one-way') {
    if (identified || (input.adults ?? 1) !== 1 || (input.children ?? 0) !== 0) statuses.push({ provider: 'Google Flights', status: 'unsupported_party', reason: 'This Google operation supports one adult only and cannot price identified parties.' });
    else {
      try {
        const result = await (options.searchGoogle ?? (q=>searchFlights(q,undefined,{fetchImpl:(url,init)=>canadianFetch(url,options.signal?{...init,signal:options.signal}:init)})))(input);
        offers.push(...result.offers.map(offer => ({ ...offer, provider: 'Google Flights' })));
        statuses.push(...result.sources.map(source => ({ provider: 'Google Flights', ...source })));
      } catch (error) { statuses.push(sourceFailure('Google Flights',error)); }
    }
  }

  if (wants('ignav')) {
    if (!process.env.IGNAV_API_KEY && !options.searchIgnav) statuses.push({ provider: 'Ignav', status: 'unconfigured', reason: 'Set IGNAV_API_KEY on the server to enable this source.' });
    else {
      try {
        const result = await (options.searchIgnav ?? searchIgnav)(input,options.signal?{signal:options.signal}:{});
        offers.push(...result.offers);
        statuses.push(...result.sources);
      } catch (error) { statuses.push(sourceFailure('Ignav',error)); }
    }
  }

  for (const [provider, search, configured] of [
    ['Expedia', options.searchExpedia ?? searchExpedia, Boolean(process.env.EXPEDIA_TRAVEL_REDIRECT_KEY && process.env.EXPEDIA_TRAVEL_REDIRECT_AUTHORIZATION)],
    ['Skyscanner', options.searchSkyscanner ?? searchSkyscanner, Boolean(process.env.SKYSCANNER_API_KEY)],
  ]) {
    const source = provider.toLowerCase();
    if (!wants(source)) continue;
    if (identified) {if(source!=='skyscanner'){statuses.push({provider,status:'unsupported_party',reason:'This adapter cannot yet price identified parties.'});continue;}try{skyscannerIdentityParty(input);}catch(error){statuses.push({provider,status:'unsupported_party',reason:error.message});continue;}}
    if (tripType==='round-trip'&&!['skyscanner','expedia'].includes(source)) {statuses.push({provider,status:'unsupported_trip',reason:'Round-trip search is not yet supported by this adapter.'});continue;}
    if (!configured && !options[`search${provider}`]) {
      statuses.push({ provider, status: 'unconfigured', reason: provider === 'Expedia' ? 'Set the Expedia partner key and Authorization value on the server.' : 'Set SKYSCANNER_API_KEY on the server.' });
      continue;
    }
    try {
      const result = await search(input,{...(options.signal?{signal:options.signal}:{}),...(source==='skyscanner'?{maxPolls:options.maxPolls??8,requireTimeEvidence:true,...(options.loadSkyscannerTimezones?{loadTimezones:options.loadSkyscannerTimezones}:{})}:{})});
      offers.push(...result.offers);
      statuses.push(...result.sources);
    } catch (error) { statuses.push(sourceFailure(provider,error)); }
  }

  if(wants('air-canada') && tripType==='round-trip') statuses.push({provider:'Air Canada NDC',status:'unsupported_trip',reason:'Round-trip search is not yet supported by this adapter.'});
  if (wants('air-canada') && tripType==='one-way') {
    if (identified) statuses.push({provider:'Air Canada NDC',status:'unsupported_party',reason:'This adapter cannot yet price identified parties.'});
    else {
    const configured = Boolean(options.searchAirCanada || (process.env.AIR_CANADA_NDC_API_KEY && process.env.AIR_CANADA_NDC_SELLER_ID && process.env.AIR_CANADA_NDC_IATA_NUMBER && process.env.AIR_CANADA_NDC_AGENCY_ID));
    if (!configured) statuses.push({ provider: 'Air Canada NDC', status: 'unconfigured', reason: 'Set the Air Canada-issued NDC key, SellerID, accredited IATA/TIDS number, and Agency ID after partner onboarding.' });
    else {
      try {
        const result = await (options.searchAirCanada ?? searchAirCanada)(input,options.signal?{signal:options.signal}:{});
        offers.push(...result.offers);
        statuses.push(...result.sources);
      } catch (error) { statuses.push(sourceFailure('Air Canada NDC',error)); }
    }
    }
  }

  if(wants('ita-matrix')) {
      let matrixPassengers;try{matrixPassengers=matrixParty(input);}catch(error){statuses.push({provider:'ITA Matrix',status:'unsupported_party',reason:error.message});}
      if(matrixPassengers)try {
        const cabin={economy:'COACH',premium_economy:'PREMIUM-COACH',business:'BUSINESS',first:'FIRST'}[input.cabin??'economy'];
        const matrixOptions=validateMatrixOptions(input.matrixOptions);
        const result=await (options.searchMatrix??searchMatrix)({origin:input.origin,destination:input.destination,departureDate:input.date,...(tripType==='round-trip'?{returnDate:input.returnDate}:{}),cabin,currency:'CAD',passengers:matrixPassengers,...matrixOptions},{...options.matrixOptions,...(options.signal?{signal:options.signal}:{})});
        const accepted=result.offers.filter(offer=>{try{const dates=[input.date,...[offer,offer.inbound].filter(Boolean).flatMap(leg=>[leg.departureDate,leg.arrivalDate,...(leg.segments??[]).flatMap(segment=>[segment.departure_time_local,segment.arrival_time_local].filter(value=>typeof value==='string').map(value=>value.slice(0,10)))])];const actual=matrixParty(input,dates);return Object.keys({...matrixPassengers,...actual}).every(key=>matrixPassengers[key]===actual[key]);}catch{return false;}});
        offers.push(...accepted);
        priceObservations.push(...(result.priceObservations??[]));
        statuses.push(...result.sources);
      } catch(error) { statuses.push(sourceFailure('ITA Matrix',error)); }
  }

  if(wants('omkar-expedia')) {
    const oneAdult=!identified&&party.adults===1&&party.children===0&&!['youths','seniors','infantsInLap','infantsInSeat','infantsOnLap','infantInLap','infantInSeat'].some(field=>input[field]!==undefined&&input[field]!==0);
    if(!oneAdult)statuses.push({provider:'Expedia via Omkar',status:'unsupported_party',reason:'Omkar documents one-adult pricing only; no per-traveler quote is shown for a larger or identified party.'});
    else if(tripType!=='one-way') {
      let searchUrl;try{searchUrl=expediaSearchUrl({origin:input.origin,destination:input.destination,date:input.date,returnDate:input.returnDate,tripType,cabin:input.cabin??'economy',adults:1,originAirport:input.originAirport,destinationAirport:input.destinationAirport});}catch{}
      statuses.push({provider:'Expedia via Omkar',status:'unsupported_trip',reason:'Omkar documents one-way fares only. Use Expedia directly for a round-trip search; no one-way fares are added together.',...(searchUrl?{searchUrl}:{})});
    } else if(!process.env.OMKAR_API_KEY&&!options.searchOmkarExpedia) {
      let searchUrl;try{searchUrl=expediaSearchUrl({origin:input.origin,destination:input.destination,date:input.date,tripType,cabin:input.cabin??'economy',adults:1,originAirport:input.originAirport,destinationAirport:input.destinationAirport});}catch{}
      statuses.push({provider:'Expedia via Omkar',status:'unconfigured',reason:'Set OMKAR_API_KEY after creating an Omkar API account.',...(searchUrl?{searchUrl}:{})});
    } else {
      try {
        const result=await (options.searchOmkarExpedia??searchOmkarExpedia)(input,{...options.omkarOptions,...(options.signal?{signal:options.signal}:{})});
        offers.push(...result.offers);priceObservations.push(...(result.priceObservations??[]));statuses.push(...result.sources);
      } catch(error) { statuses.push(sourceFailure('Expedia via Omkar',error)); }
    }
  }

  const excludedNonCad = offers.filter(offer => offer?.currency !== 'CAD').length;
  const schemaCoverage = {};
  const validOffers = offers.filter(offer => {
    if (offer?.currency !== 'CAD') return false;
    const reason = flightOfferError(offer, input);
    if (!reason) return true;
    const provider = offer.provider || 'Unknown source';
    schemaCoverage[provider] ??= {};
    schemaCoverage[provider][reason] = (schemaCoverage[provider][reason] ?? 0) + 1;
    return false;
  });
  for (const [provider, reasons] of Object.entries(schemaCoverage)) statuses.push({provider, operation:'validation', status:'invalid_response', rejected:Object.values(reasons).reduce((sum,n)=>sum+n,0), reason:`Incomplete or mismatched observations excluded: ${Object.entries(reasons).map(([reason,n])=>`${reason} (${n})`).join(', ')}.`});
  const filtered=await applyFlightFilters(validOffers, filters);
  const cadOffers=filtered.offers;
  const countByProvider=rows=>rows.reduce((counts,offer)=>{const provider=offer.provider??'Unknown source';counts.set(provider,(counts.get(provider)??0)+1);return counts;},new Map());
  const validByProvider=countByProvider(validOffers),acceptedByProvider=countByProvider(cadOffers);
  const searchStatusCounts=statuses.reduce((counts,status)=>{
    if(status.provider&&Number.isSafeInteger(status.received)&&status.received>=0)counts.set(status.provider,(counts.get(status.provider)??0)+1);
    return counts;
  },new Map());
  // Some sources (Google's one-way adapter) report separate operation rows. Match those rows to offer sections.
  const countForStatus=(rows,status,counts)=>{
    const providerRows=rows.filter(offer=>(offer.provider??'Unknown source')===status.provider);
    if(typeof status.operation==='string'&&providerRows.some(offer=>typeof offer.section==='string'))return providerRows.filter(offer=>offer.section===status.operation).length;
    if((searchStatusCounts.get(status.provider)??0)>1)return null;
    return counts.get(status.provider)??0;
  };
  const finalStatuses=statuses.map(status=>{
    if(!status.provider||!Number.isSafeInteger(status.received)||status.received<0)return status;
    const accepted=countForStatus(cadOffers,status,acceptedByProvider),valid=countForStatus(validOffers,status,validByProvider);
    if(accepted===null||valid===null)return status;
    const filterRejected=Math.max(0,valid-accepted);
    return {...status,accepted,...(filterRejected>0?{filterRejected}:{})};
  });
  if (excludedNonCad) statuses.push({ provider: 'Currency filter', status: 'excluded', reason: `${excludedNonCad} non-CAD or unlabelled offers excluded; no conversion applied.` });
  return {
    query: { origin: input.origin, destination: input.destination, date: input.date, cabin:input.cabin ?? 'economy', tripType, returnDate:tripType==='round-trip'?input.returnDate:null, ...(identified?{travelers:party.people.map(({ages,...person})=>person)}:{adults:party.adults, children:party.children, childrenAges:party.childrenAges}), filters },
    observedAt: new Date().toISOString(), offers: cadOffers, priceObservations, filterCoverage:filtered.rejected, schemaCoverage, sources: [...finalStatuses,...(excludedNonCad?[{ provider: 'Currency filter', status: 'excluded', reason: `${excludedNonCad} non-CAD or unlabelled offers excluded; no conversion applied.` }]:[])], complete: false,
    limitations: ['Results cover only the configured sources and itineraries those sources returned; this is not an exhaustive market search.', 'Only CAD offers are displayed; other currencies are excluded without conversion.', 'A fare observation or seller link is not a completed booking; confirm price, availability, passenger details, and inclusions with the seller.'],
  };
}

function searchSource(input,options={}){
 if(input?.source==='ignav'&&options.providerCache)return searchIgnavWithCache(input,{cache:options.providerCache,search:query=>searchSingleProvider(query,options)});
 return searchSingleProvider(input,options);
}

export const FLIGHT_PROVIDER_IDS=Object.freeze(['google','ignav','expedia','skyscanner','air-canada','ita-matrix','omkar-expedia']);
const flightProviderNames={google:'Google Flights',ignav:'Ignav',expedia:'Expedia',skyscanner:'Skyscanner','air-canada':'Air Canada NDC','ita-matrix':'ITA Matrix','omkar-expedia':'Expedia via Omkar'};

function rejectedProviderResult(input,sourceId,error){
 const unsupported=/unsupported|not supported|cannot yet price|cannot price/i.test(error?.message??'');
 const travelers=Array.isArray(input.travelers)?input.travelers.map(({ages,...person})=>person):undefined;
 return {
  query:{origin:input.origin,destination:input.destination,date:input.date,cabin:input.cabin??'economy',tripType:input.tripType??'one-way',returnDate:input.tripType==='round-trip'?input.returnDate:null,...(travelers?{travelers}:{adults:input.adults??1,children:input.children??0,childrenAges:input.childrenAges??[]}),filters:input.filters??{}},
  observedAt:new Date().toISOString(),offers:[],priceObservations:[],sources:[{provider:flightProviderNames[sourceId]??sourceId,status:unsupported?'unsupported_party':'error',reason:error?.message??'Provider adapter failed.'}],complete:false,limitations:[],
 };
}

/** Search independent sources with a small bounded pool and publish each completed source result. */
export async function searchProviders(input,options={}){
 const requested=input?.source??'all';
 if(requested!=='all'){
  const startedAt=performance.now();
  const result=await withTransportMetrics(()=>searchSource(input,options));
  await options.onProviderResult?.({sourceId:requested,sourceIndex:0,sourceCount:1,providerElapsedMs:Math.round(performance.now()-startedAt),result});
  return result;
 }
 if(!input||typeof input!=='object')throw Error('Provide a search request.');
 validateSearchParty(input);validateFilters(input.filters);
 const tripType=input.tripType??'one-way';
 if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
 if(tripType==='round-trip'&&(typeof input.returnDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate)||!Number.isFinite(Date.parse(input.returnDate+'T00:00:00Z'))||new Date(input.returnDate+'T00:00:00Z').toISOString().slice(0,10)!==input.returnDate||input.returnDate<input.date))throw Error('Enter a valid return date on or after departure.');
 const maxConcurrent=options.maxConcurrentProviders??2;
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>4)throw Error('Provider concurrency must be between one and four.');
 const results=new Array(FLIGHT_PROVIDER_IDS.length);let cursor=0;
 const runNext=async()=>{
  for(;;){const index=cursor++;if(index>=FLIGHT_PROVIDER_IDS.length)return;const sourceId=FLIGHT_PROVIDER_IDS[index];
   const startedAt=performance.now();
   const result=await withTransportMetrics(async()=>{
    try{return await searchSource({...input,source:sourceId},{...options,onProviderResult:undefined});}
    catch(error){return rejectedProviderResult(input,sourceId,error);}
   });
   results[index]=result;
   await options.onProviderResult?.({sourceId,sourceIndex:index,sourceCount:FLIGHT_PROVIDER_IDS.length,providerElapsedMs:Math.round(performance.now()-startedAt),result});
  }
 };
 await Promise.all(Array.from({length:Math.min(maxConcurrent,FLIGHT_PROVIDER_IDS.length)},runNext));
 const present=results.filter(Boolean),query=present[0]?.query;
 const sumCoverage=present.reduce((sum,result)=>{for(const [key,value] of Object.entries(result.filterCoverage??{}))if(Number.isFinite(value))sum[key]=(sum[key]??0)+value;return sum;},{});
 const schemaCoverage={};for(const result of present)for(const [provider,reasons] of Object.entries(result.schemaCoverage??{})){schemaCoverage[provider]??={};for(const [reason,count] of Object.entries(reasons))schemaCoverage[provider][reason]=(schemaCoverage[provider][reason]??0)+count;}
 return {
  query,observedAt:new Date().toISOString(),offers:present.flatMap(result=>result.offers).sort((a,b)=>a.price-b.price),
  priceObservations:present.flatMap(result=>result.priceObservations??[]),filterCoverage:sumCoverage,schemaCoverage,
  sources:present.flatMap(result=>result.sources),complete:false,transportCoverage:mergeTransportCoverage(present.map(result=>result.transportCoverage)),
  limitations:[...new Set(present.flatMap(result=>result.limitations??[]))],
 };
}
