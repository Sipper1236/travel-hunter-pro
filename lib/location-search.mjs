import {resolvePlace} from './place-resolution.mjs';
import {resolveRegion,searchRegionPair} from './regions.mjs';
import {searchProviders,FLIGHT_PROVIDER_IDS} from './providers.mjs';
import {quoteFreshness,QUOTE_MAX_AGE_MS} from './quote-freshness.mjs';
import {flightWorkerResultError} from './flight-worker-result.mjs';
import {mergeTransportCoverage} from './transport-metrics.mjs';

export async function searchLocations(input, detections, options={}) {
  const searchStartedAt=performance.now(),providerLatencyMs={},sourceTransportCoverage={};
  const place=options.resolvePlace ?? resolvePlace, region=options.resolveRegion ?? resolveRegion, search=options.search ?? searchProviders;
  const resolveSide=async side=>{
    try {return await (detections[side].type==='region' ? region(detections[side].canonicalName || input[side]) : place(input[side],undefined,undefined,input[`${side}CityId`]));}
    catch(error) {if(error.cityChoices){error.locationSide=side;error.locationValue=input[side];}throw error;}
  };
  const state=options.checkpoint ?? {version:1,pairs:{}};
  const [origin,destination]=state.scopes ? [state.scopes.origin,state.scopes.destination] : await Promise.all([resolveSide('origin'),resolveSide('destination')]);
  state.scopes={origin,destination};state.detections=detections;
  await options.onCheckpoint?.(state);
  const expanded=detections.origin.type==='region' || detections.destination.type==='region' || origin.airports.length!==1 || destination.airports.length!==1;
  const scopedInput={...input,matrixOptions:{...(input.matrixOptions??{}),expandDetailedItineraries:!expanded&&input.matrixOptions?.expandDetailedItineraries===true}};
  const budget=input.airportLimit??10,selectedOrigins=origin.airports.slice(0,budget),selectedDestinations=destination.airports.slice(0,budget);
  const pairCount=(left,right)=>left.reduce((sum,a)=>sum+right.filter(b=>a.code!==b.code).length,0);
  const pairsPlanned=expanded?pairCount(selectedOrigins,selectedDestinations):1;
  const providerCount=input.source==='all'?FLIGHT_PROVIDER_IDS.length:1,livePairs=new Map();
  const publishProviderResult=({query,event})=>{
    if(!event?.result)return;
    const pairOrigin=event.result.query?.origin??query.origin,pairDestination=event.result.query?.destination??query.destination;
    const key=`${pairOrigin}:${pairDestination}`;let pair=livePairs.get(key);
    if(!pair){pair={origin:selectedOrigins.find(item=>item.code===pairOrigin)??{code:pairOrigin,name:pairOrigin},destination:selectedDestinations.find(item=>item.code===pairDestination)??{code:pairDestination,name:pairDestination},results:new Map()};livePairs.set(key,pair);}
    pair.results.set(event.sourceId??'source',event.result);
    if(event.sourceId&&Number.isFinite(event.providerElapsedMs)){
      const timing=providerLatencyMs[event.sourceId]??={samples:0,latestMs:0,maxMs:0};
      timing.samples++;timing.latestMs=event.providerElapsedMs;timing.maxMs=Math.max(timing.maxMs,event.providerElapsedMs);
    }
    if(event.sourceId&&event.sourceId!=='cache'&&event.result.transportCoverage)sourceTransportCoverage[event.sourceId]=mergeTransportCoverage(sourceTransportCoverage[event.sourceId],event.result.transportCoverage);
    const routeResults=[...livePairs.values()].flatMap(row=>[...row.results.values()].map(result=>({row,result})));
    const offers=routeResults.flatMap(({result})=>result.offers??[]).filter(offer=>quoteFreshness(offer).status==='fresh');
    const priceObservations=routeResults.flatMap(({result})=>result.priceObservations??[]);
    const sources=routeResults.flatMap(({row,result})=>(result.sources??[]).map(source=>({...source,route:{origin:row.origin.code,destination:row.destination.code}})));
    const checked=[...livePairs.values()].map(row=>{
      const entries=[...row.results.entries()],results=entries.map(([,result])=>result),statuses=results.flatMap(result=>result.sources??[]);
      return {origin:row.origin,destination:row.destination,sources:statuses,offers:results.reduce((sum,result)=>sum+(result.offers?.length??0),0),complete:entries.some(([id])=>id==='cache')||entries.length>=providerCount&&results.every(result=>result.partial!==true)};
    });
    const sumCoverage={};for(const {result} of routeResults)for(const [name,count] of Object.entries(result.filterCoverage??{}))if(Number.isFinite(count))sumCoverage[name]=(sumCoverage[name]??0)+count;
    const perRouteExpected=providerCount;
    const responsesReceived=[...livePairs.values()].reduce((sum,row)=>sum+[...row.results.keys()].reduce((n,id)=>n+(id==='cache'?(row.results.get(id)?.sources??[]).map(source=>source.provider).filter((value,index,array)=>value&&array.indexOf(value)===index).length:1),0),0);
    const preview={
      ...(event.result),query:{...event.result.query,origin:input.origin,destination:input.destination},observedAt:new Date().toISOString(),
      offers,priceObservations,sources,filterCoverage:sumCoverage,complete:false,partial:true,
      locationResolution:{origin,destination},requestedLocations:{origin:input.origin,destination:input.destination},originDetection:detections.origin,destinationDetection:detections.destination,
      coverage:{side:'both',partial:true,airportLimit:budget,origin:{...origin,airports:selectedOrigins,uncheckedAirports:[...(origin.airports??[]).slice(budget),...(origin.uncheckedAirports??[])]},destination:{...destination,airports:selectedDestinations,uncheckedAirports:[...(destination.airports??[]).slice(budget),...(destination.uncheckedAirports??[])]},pairsPlanned,pairsChecked:checked.length,stoppedBySource:false,checked,uncheckedPairs:[],uncheckedAirportPairs:[]},
      streaming:{providerResponsesReceived:responsesReceived,providerResponsesPlanned:pairsPlanned*perRouteExpected,pairsWithResponses:checked.length,pairsPlanned,currentRoute:`${pairOrigin} → ${pairDestination}`,firstResponseMs:Math.round(performance.now()-searchStartedAt),providerLatencyMs:structuredClone(providerLatencyMs),sourceTransportCoverage:structuredClone(sourceTransportCoverage)},
      limitation:`Live partial results: ${responsesReceived} of ${pairsPlanned*perRouteExpected} provider/route responses received. Other selected airport pairs or sources may still be running; this is not an exhaustive regional minimum. Prices are observations, not confirmed bookings.`,
      limitations:[`Live partial results: ${responsesReceived} of ${pairsPlanned*perRouteExpected} provider/route responses received. Other selected airport pairs or sources may still be running; this is not an exhaustive regional minimum.`,...(event.result.limitations??[])],
    };
    const invalid=flightWorkerResultError(preview,input);
    if(!invalid)options.onProgress?.({stage:'provider_results_streaming',providerResultsReceived:responsesReceived,providerResultsPlanned:pairsPlanned*perRouteExpected,pairsChecked:checked.length,pairsPlanned,currentRoute:`${pairOrigin} → ${pairDestination}`,flightPreview:preview});
  };
  let reusedPairs=0;
  const checkpointSearch=async (query,searchOptions={})=>{
    const key=`${query.origin}:${query.destination}`,saved=state.pairs[key],now=Date.now();
    const forwardProviderResult=event=>searchOptions.onProviderResult?searchOptions.onProviderResult({...event,query}):publishProviderResult({query,event});
    if(saved && now>=saved.savedAt && now-saved.savedAt<QUOTE_MAX_AGE_MS && saved.result.offers.every(offer=>quoteFreshness(offer,now).status==='fresh')){reusedPairs++;forwardProviderResult({sourceId:'cache',sourceCount:(saved.result.sources??[]).map(source=>source.provider).filter((value,index,array)=>value&&array.indexOf(value)===index).length||1,result:saved.result});return saved.result;}
    const result=await search(query,{onProviderResult:forwardProviderResult,...(options.providerCache?{providerCache:options.providerCache}:{})});
    state.pairs[key]={savedAt:Date.now(),result};
    await options.onCheckpoint?.(state);
    return result;
  };
  options.onProgress?.({stage:'searching',pairsChecked:0,pairsPlanned:expanded?undefined:1});
  const exactRouteQuery={...scopedInput,origin:origin.airports[0].code,destination:destination.airports[0].code};
  const result=expanded ? await searchRegionPair(scopedInput,async (_name,side)=>side==='origin'?origin:destination,checkpointSearch,{onProgress:progress=>options.onProgress?.({...progress,reusedPairs}),onProviderResult:event=>publishProviderResult({query:event.query,event})}) : await checkpointSearch(exactRouteQuery,{onProviderResult:event=>publishProviderResult({query:exactRouteQuery,event})});
  const freshOffers=result.offers.filter(offer=>quoteFreshness(offer).status==='fresh');
  return {...result,offers:freshOffers,transportCoverage:mergeTransportCoverage(...Object.values(sourceTransportCoverage)),checkpointCoverage:{reusedPairs,completedPairs:Object.keys(state.pairs).length,staleOffersExcluded:result.offers.length-freshOffers.length},requestedLocations:{origin:input.origin,destination:input.destination},locationResolution:{origin,destination}};
}
