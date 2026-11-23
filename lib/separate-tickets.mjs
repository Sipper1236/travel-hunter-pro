import {searchIgnav} from './ignav.mjs';
import {validateTravelers,validateTravelerIdentities,ignavIdentityParty} from './travelers.mjs';
import {validateFilters,applyFlightFilters} from './flight-filters.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {SOURCE_STOP_STATUSES} from './source-errors.mjs';
import {DEFAULT_ROUTE_PAIR_SEARCHES,MAX_ROUTE_PAIR_SEARCHES} from './comparison-query.mjs';
export const MAX_ROUTE_ALTERNATIVES_SHOWN=8;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
function offsetInstant(value){
 if(typeof value!=='string')return null;
 const match=/^(\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?)(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match||!validDate(match[1].slice(0,10)))return null;
 if(match[2]!=='Z'){const hours=Number(match[4]),minutes=Number(match[5]);if(minutes>59||hours>14||hours===14&&minutes!==0||match[3]==='-'&&hours===0&&minutes===0)return null;}
 const instant=Date.parse(value);return Number.isFinite(instant)?instant:null;
}
function localTimestamp(value){
 if(typeof value!=='string')return false;
 const match=/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(value);
 return Boolean(match&&validDate(match[1]));
}
const operatingCarrier=segment=>typeof segment?.operating_carrier_code==='string'&&segment.operating_carrier_code.trim()?`code:${segment.operating_carrier_code.trim().toUpperCase()}`:typeof segment?.operating_carrier_name==='string'&&segment.operating_carrier_name.trim()?`name:${segment.operating_carrier_name.trim().toLocaleLowerCase('en')}`:null;
const same=(a,b)=>{
 const opA=operatingCarrier(a),opB=operatingCarrier(b);
 if((opA!==null||opB!==null)&&opA!==opB)return false;
 const aDeparture=offsetInstant(a.departure_time_utc),bDeparture=offsetInstant(b.departure_time_utc),aArrival=offsetInstant(a.arrival_time_utc),bArrival=offsetInstant(b.arrival_time_utc);
 return aDeparture!==null&&bDeparture!==null&&aArrival!==null&&bArrival!==null&&a.marketing_carrier_code===b.marketing_carrier_code&&a.flight_number===b.flight_number&&a.departure_airport===b.departure_airport&&a.arrival_airport===b.arrival_airport&&aDeparture===bDeparture&&aArrival===bArrival;
};
const cents=value=>{const n=Math.round(value*100);return Number.isFinite(value)&&Number.isSafeInteger(n)&&n>0&&Math.abs(value*100-n)<1e-6?n:null;};
function validChain(chain){
 return Array.isArray(chain)&&chain.length>=1&&chain.length<=4&&chain.every((segment,index)=>{
  const departure=offsetInstant(segment?.departure_time_utc),arrival=offsetInstant(segment?.arrival_time_utc),previous=index?offsetInstant(chain[index-1]?.arrival_time_utc):null;
  return /^[A-Z]{3}$/.test(segment?.departure_airport)&&/^[A-Z]{3}$/.test(segment?.arrival_airport)&&/^[A-Z0-9]{2,3}$/.test(segment?.marketing_carrier_code)&&typeof segment?.flight_number==='string'&&segment.flight_number.trim().length>0&&segment.flight_number.length<=20&&departure!==null&&arrival!==null&&arrival>departure&&localTimestamp(segment?.departure_time_local)&&localTimestamp(segment?.arrival_time_local)&&(!index||chain[index-1].arrival_airport===segment.departure_airport&&previous!==null&&departure>=previous);
 });
}
function partitions(chain,grouped,whole,eligible){
 const results=[],walk=(start,blocks)=>{if(start===chain.length){if(whole||blocks.length>1)results.push(blocks);return;}for(let end=start+1;end<=chain.length;end++){if(!grouped&&end!==start+1)continue;if(end<chain.length&&!eligible(end-1))continue;walk(end,[...blocks,[start,end]]);}};
 walk(0,[]);
 if(whole&&!grouped&&chain.length>1)results.unshift([[0,chain.length]]);
 return results;
}
function identifiedGroups(query,people,splitPassengers,flightDates){
 const all=people.map(({ages,...person})=>person);
 const groups=[],fullMask=(1<<all.length)-1;
 let ageCategoryTransitionGroupsSkipped=0;
 for(let mask=1;mask<(1<<all.length);mask++){
  if(!splitPassengers&&mask!==fullMask)continue;
  const travelers=all.filter((_,index)=>mask&(1<<index));
  try{
   const validated=validateTravelerIdentities(travelers,flightDates);
   const crossedFareBoundary=validated.some(person=>new Set(person.ages.map(age=>age<2?`infant_${person.infantSeating}`:age<12?'child':'adult')).size>1);
   if(crossedFareBoundary){ageCategoryTransitionGroupsSkipped++;continue;}
   ignavIdentityParty({...query,tripType:'one-way',returnDate:undefined,travelers});
   groups.push({mask,travelers,travelerIds:travelers.map(person=>person.id)});
  }catch{}
 }
 return {groups,ageCategoryTransitionGroupsSkipped};
}
function bestIdentifiedPartition(allMask,quotes){
 const memo=new Map([[0,{amount:0,tickets:[]}]]);
 const solve=mask=>{
  if(memo.has(mask))return memo.get(mask);
  const first=mask&-mask;let best=null;
  for(let sub=mask;sub;sub=(sub-1)&mask){
   if(!(sub&first))continue;
   const quote=quotes.get(sub),rest=solve(mask^sub);if(!quote||!rest)continue;
   const amount=cents(quote.offer.price)+rest.amount;
   if(Number.isSafeInteger(amount)&&(!best||amount<best.amount))best={amount,tickets:[{offer:quote.offer,travelerIds:quote.travelerIds},...rest.tickets]};
  }
  memo.set(mask,best);return best;
 };
 return solve(allMask);
}
function routeMatchesQuery(offer,query,tripType){
 if(!validChain(offer?.segments)||offer.currency!=='CAD'||offer.cabin!==query.cabin||cents(offer.price)===null||typeof offer.itineraryKey!=='string'||offer.itineraryKey.length>6000||!offer.ignavId||offer.requiresSelfTransfer||quoteFreshness(offer).status!=='fresh')return false;
 const outbound=offer.segments,first=outbound[0],last=outbound.at(-1),inbound=offer.inbound?.segments;
 if(first.departure_airport!==query.origin||last.arrival_airport!==query.destination||first.departure_time_local.slice(0,10)!==query.date)return false;
 if(tripType==='round-trip')return validChain(inbound)&&inbound[0].departure_airport===query.destination&&inbound.at(-1).arrival_airport===query.origin&&inbound[0].departure_time_local.slice(0,10)===query.returnDate&&Date.parse(inbound[0].departure_time_utc)>=Date.parse(last.arrival_time_utc);
 return !offer.inbound;
}
function routeSummary(offer){
 const summarize=segments=>({from:segments[0].departure_airport,to:segments.at(-1).arrival_airport,departureDate:segments[0].departure_time_local.slice(0,10),departureTime:segments[0].departure_time_local.slice(11,16),arrivalDate:segments.at(-1).arrival_time_local.slice(0,10),arrivalTime:segments.at(-1).arrival_time_local.slice(11,16),airlines:[...new Set(segments.map(segment=>segment.marketing_carrier_code))],via:segments.slice(0,-1).map(segment=>segment.arrival_airport),segments});
 return {itineraryKey:offer.itineraryKey,price:offer.price,currency:'CAD',observedAt:offer.observedAt,expiresAt:offer.expiresAt,outbound:summarize(offer.segments),...(offer.inbound?{inbound:summarize(offer.inbound.segments)}:{})};
}
async function discoverRoutes(responses,selected,tripType,filters,pairsPlanned,pairsAttempted,pairsSearched,pairsStopped,notSearched,routeSearchLimit){
 const candidates=responses.flatMap(({query,result})=>(Array.isArray(result?.offers)?result.offers:[]).filter(offer=>!(offer.itineraryKey===selected.itineraryKey&&query.origin===selected.segments[0].departure_airport&&query.destination===selected.segments.at(-1).arrival_airport)&&routeMatchesQuery(offer,query,tripType)).map(offer=>({...offer,via:offer.segments.slice(0,-1).map(segment=>segment.arrival_airport),...(offer.inbound?{inbound:{...offer.inbound,via:offer.inbound.segments.slice(0,-1).map(segment=>segment.arrival_airport)}}:{})})));
 const matching=(await applyFlightFilters(candidates,filters)).offers;
 const unique=[...new Map(matching.map(offer=>[`${offer.segments[0].departure_airport}:${offer.segments.at(-1).arrival_airport}:${offer.itineraryKey}`,offer])).values()].sort((a,b)=>a.price-b.price||a.segments[0].departure_airport.localeCompare(b.segments[0].departure_airport)||a.segments.at(-1).arrival_airport.localeCompare(b.segments.at(-1).arrival_airport)),alternatives=unique.slice(0,MAX_ROUTE_ALTERNATIVES_SHOWN).map(routeSummary);
 const completionKnown=responses.every(({result})=>typeof result?.complete==='boolean');
 return {alternatives,coverage:{scope:pairsPlanned.length?'bounded_resolved_airport_pairs':'same_exact_airport_pair_refresh',candidateItinerariesReturned:responses.reduce((sum,{result})=>sum+(Array.isArray(result?.offers)?result.offers.length:0),0),matchingAlternatives:unique.length,alternativesShown:alternatives.length,displayLimit:MAX_ROUTE_ALTERNATIVES_SHOWN,omittedMatchingAlternatives:Math.max(0,unique.length-alternatives.length),providerCompletionKnown:completionKnown,providerReportedComplete:completionKnown&&responses.every(({result})=>result.complete===true),alternateAirportPairsPlanned:pairsPlanned.length,alternateAirportPairsAttempted:pairsAttempted.length,alternateAirportPairsAttemptedList:pairsAttempted,alternateAirportPairsSearched:pairsSearched.length,alternateAirportPairsSearchedList:pairsSearched,alternateAirportPairsStoppedList:pairsStopped,alternateAirportPairsNotSearched:notSearched,airportPairSearchLimit:routeSearchLimit,exhaustive:false}};
}
function emptyRouteCoverage(routePairs,query,routeSearchLimit=DEFAULT_ROUTE_PAIR_SEARCHES){
 const pairs=(routePairs??[]).filter(pair=>pair.origin!==query.origin||pair.destination!==query.destination);
 return {scope:pairs.length?'bounded_resolved_airport_pairs':'same_exact_airport_pair_refresh',candidateItinerariesReturned:0,matchingAlternatives:0,alternativesShown:0,displayLimit:MAX_ROUTE_ALTERNATIVES_SHOWN,omittedMatchingAlternatives:0,providerCompletionKnown:false,providerReportedComplete:false,alternateAirportPairsPlanned:pairs.length,alternateAirportPairsAttempted:0,alternateAirportPairsAttemptedList:[],alternateAirportPairsSearched:0,alternateAirportPairsSearchedList:[],alternateAirportPairsStoppedList:[],alternateAirportPairsNotSearched:pairs,airportPairSearchLimit:routeSearchLimit,exhaustive:false};
}
function sourceCoverage(sources=[]){return sources.slice(0,12).map(source=>({provider:typeof source.provider==='string'?source.provider.slice(0,80):null,status:typeof source.status==='string'?source.status.slice(0,40):'unknown',...(Number.isSafeInteger(source.received)&&source.received>=0?{received:source.received}:{}),...(Number.isSafeInteger(source.accepted)&&source.accepted>=0?{accepted:source.accepted}:{})}));}
function summarizeTicketBlocks(blocks,responses,results){return [...blocks.values()].map(block=>{const chain=block.direction.segments.slice(block.start,block.end),queries=responses.get(block.key)??[],qualifyingQuotes=queries.reduce((sum,response)=>sum+response.qualifyingQuotes,0);return {direction:block.direction.name,segmentStart:block.start+1,segmentEnd:block.end,status:results.has(block.key)?'priced':qualifyingQuotes?'partial':queries.length?'unpriced':'not_searched',exactFlights:chain.map(segment=>({carrier:segment.marketing_carrier_code,flight:segment.flight_number,from:segment.departure_airport,to:segment.arrival_airport,departureAt:segment.departure_time_utc,arrivalAt:segment.arrival_time_utc})),fareRequests:queries.length,qualifyingQuotes,responses:queries};});}
/** Price exact observed flights; totals remain observations before unverified extras. */
export async function compareSeparateTickets(input,options={}){
 const identified=input.travelers!==undefined,party=identified?ignavIdentityParty(input):validateTravelers(input);
 if(!identified&&party.children)throw Error('Separate-ticket comparisons for children and youths require identified travelers with guardian links.');
 const tripType=input.tripType ?? 'one-way';
 if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
 if(input.splitPassengers!==undefined&&typeof input.splitPassengers!=='boolean')throw Error('Invalid split-passenger selection.');
 if(typeof input.itineraryKey!=='string'||input.itineraryKey.length>6000)throw Error('Choose a current itinerary to compare.');
 if(input.contiguousGroups!==undefined&&typeof input.contiguousGroups!=='boolean')throw Error('Invalid ticket-group selection.');
 const buffer=input.minConnectionMinutes ?? 180;if(!Number.isInteger(buffer)||buffer<180||buffer>1440)throw Error('Use a connection buffer of at least 180 minutes.');
 const limit=input.searchLimit ?? 100;if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Choose a search budget from 1 to 200 requests.');
 const filters=validateFilters(input.filters),search=options.searcher ?? searchIgnav;
 const query={origin:input.origin,destination:input.destination,date:input.date,...(identified?{travelers:party.people.map(({ages,...person})=>person)}:{adults:party.adults,children:0,childrenAges:[]}),cabin:input.cabin ?? 'economy',filters,tripType,...(tripType==='round-trip'?{returnDate:input.returnDate}:{})};
 const samePair=pair=>pair.origin===query.origin&&pair.destination===query.destination;
 const allAlternativePairs=(input.routePairs??[]).filter(pair=>!samePair(pair));
 const routePairLimit=input.routeSearchLimit??DEFAULT_ROUTE_PAIR_SEARCHES;
 if(!Number.isInteger(routePairLimit)||routePairLimit<0||routePairLimit>MAX_ROUTE_PAIR_SEARCHES)throw Error(`Choose 0–${MAX_ROUTE_PAIR_SEARCHES} alternate airport-pair searches.`);
 const candidatePairs=allAlternativePairs.slice(0,routePairLimit),pairsBeyondLimit=allAlternativePairs.slice(routePairLimit);
 let routeResponses=[],attemptedPairs=[],searchedPairs=[],stoppedPairs=[],notSearchedPairs=[...candidatePairs,...pairsBeyondLimit],routeAlternatives=[],routeAlternativeCoverage;
 const updateRouteAlternatives=async(selected,tripType)=>{const discovered=await discoverRoutes(routeResponses,selected,tripType,filters,allAlternativePairs,attemptedPairs,searchedPairs,stoppedPairs,notSearchedPairs,routePairLimit);routeAlternatives=discovered.alternatives;routeAlternativeCoverage=discovered.coverage;};
 const matchingRouteCount=()=>routeAlternativeCoverage?.matchingAlternatives??routeAlternatives.length;
 let searches=1;
 options.onProgress?.({stage:'comparison_baseline',fareRequestsPlanned:1});
 const baselineResult=await search(query),baseline=baselineResult.offers.find(o=>o.itineraryKey===input.itineraryKey&&o.currency==='CAD'&&o.cabin===query.cabin&&validChain(o.segments)&&!o.requiresSelfTransfer&&cents(o.price)!==null&&quoteFreshness(o).status==='fresh'&&(tripType==='round-trip'?validChain(o.inbound?.segments):o.segments.length>=2&&!o.inbound));
 if(!baseline)return {status:'baseline_unavailable',plans:[],routeAlternatives:[],routeAlternativeCoverage:emptyRouteCoverage(input.routePairs,query,routePairLimit),limitation:'The original current itinerary quote was not found on refresh; no comparison was made.'};
 routeResponses=[{query,result:baselineResult}];
 const directions=[{name:'outbound',segments:baseline.segments},...(tripType==='round-trip'?[{name:'inbound',segments:baseline.inbound.segments}]:[])];
 const first=baseline.segments[0],last=baseline.segments.at(-1),back=baseline.inbound?.segments;
 if(first.departure_airport!==query.origin||last.arrival_airport!==query.destination||first.departure_time_local.slice(0,10)!==query.date||back&&(back[0].departure_airport!==query.destination||back.at(-1).arrival_airport!==query.origin||back[0].departure_time_local.slice(0,10)!==query.returnDate||Date.parse(back[0].departure_time_utc)<Date.parse(last.arrival_time_utc))){await updateRouteAlternatives(baseline,tripType);return {status:'itinerary_ineligible',plans:[],routeAlternatives,routeAlternativeCoverage,limitation:'The refreshed itinerary did not match the requested route, dates or travel chronology.'};}
 const filteredBaseline={...baseline,via:baseline.segments.slice(0,-1).map(s=>s.arrival_airport),...(back?{inbound:{...baseline.inbound,via:back.slice(0,-1).map(s=>s.arrival_airport)}}:{})};
 if(!(await applyFlightFilters([filteredBaseline],{...filters,maxPrice:null})).offers.length){await updateRouteAlternatives(baseline,tripType);return {status:'filter_ineligible',plans:[],routeAlternatives,routeAlternativeCoverage,limitation:'The refreshed itinerary does not satisfy the requested flight filters.'};}
 const combinations=[];
 for(const direction of directions){
  direction.waits=direction.segments.slice(1).map((s,i)=>(Date.parse(s.departure_time_utc)-Date.parse(direction.segments[i].arrival_time_utc))/60000);
  const eligible=i=>direction.waits[i]>=Math.max(buffer,filters.minLayover ?? 0)&&(filters.maxLayover===null||direction.waits[i]<=filters.maxLayover);
  direction.partitions=partitions(direction.segments,Boolean(input.contiguousGroups),tripType==='round-trip',eligible);
 }
 if(directions.some(d=>!d.partitions.length)){await updateRouteAlternatives(baseline,tripType);return {status:'connection_ineligible',plans:[],routeAlternatives,routeAlternativeCoverage,limitation:`No ticket split meets the ${buffer}-minute self-transfer buffer and requested layover window.`};}
 const walk=(index,blocks)=>{if(index===directions.length){combinations.push(blocks);return;}const d=directions[index];for(const p of d.partitions)walk(index+1,[...blocks,...p.map(([start,end])=>({direction:d,start,end,key:`${d.name}:${start}:${end}`}))]);};walk(0,[]);
 const blocks=new Map(combinations.flatMap(plan=>plan.map(block=>[block.key,block]))),results=new Map(),blockResponses=new Map([...blocks.keys()].map(key=>[key,[]]));
 const groupOptions=new Map();let ageCategoryTransitionGroupsSkipped=0;
 for(const [key,block] of blocks){
  const chain=block.direction.segments.slice(block.start,block.end),leg=chain[0],date=leg.departure_time_local.slice(0,10);
  if(identified){
   const dates=[...new Set(chain.flatMap(segment=>[segment.departure_time_local.slice(0,10),segment.arrival_time_local.slice(0,10)]))];
   const eligibility=identifiedGroups({...query,date},party.people,Boolean(input.splitPassengers),dates);
   groupOptions.set(key,eligibility.groups);ageCategoryTransitionGroupsSkipped+=eligibility.ageCategoryTransitionGroupsSkipped;
  }else groupOptions.set(key,[...(input.splitPassengers?Array.from({length:party.adults},(_,i)=>i+1):[party.adults])].map(adults=>({adults})));
 }
 const ageCoverage=ageCategoryTransitionGroupsSkipped?{ageCategoryTransitionGroupsSkipped}:{};
 const segmentSearchEstimate=1+[...groupOptions.values()].reduce((sum,groups)=>sum+groups.length,0),pairSearchSlots=Math.max(0,limit-segmentSearchEstimate),pairsToSearch=candidatePairs.slice(0,pairSearchSlots);
 notSearchedPairs=[...candidatePairs.slice(pairsToSearch.length),...pairsBeyondLimit];
 const estimatedSearches=segmentSearchEstimate+pairsToSearch.length;
 options.onProgress?.({stage:'comparison_pricing',fareRequestsPlanned:estimatedSearches,ticketBlocks:blocks.size});
 if(segmentSearchEstimate>limit){await updateRouteAlternatives(baseline,tripType);return {status:'budget_exceeded',plans:[],ticketBlockCoverage:summarizeTicketBlocks(blocks,blockResponses,results),routeAlternatives,routeAlternativeCoverage,coverage:{searches,estimatedSearches:segmentSearchEstimate,searchLimit:limit,routeAlternativesDiscovered:matchingRouteCount(),...ageCoverage},limitation:'The required independent-ticket searches exceed this request budget. Only the original itinerary refresh was sent.'};}
 for(const pair of pairsToSearch){
  searches++;const pairQuery={...query,origin:pair.origin,destination:pair.destination},result=await search(pairQuery);routeResponses.push({query:pairQuery,result});attemptedPairs.push(pair);
  if(result.sources?.some(source=>SOURCE_STOP_STATUSES.includes(source.status))){stoppedPairs.push(pair);await updateRouteAlternatives(baseline,tripType);return {status:'source_unavailable',plans:[],ticketBlockCoverage:summarizeTicketBlocks(blocks,blockResponses,results),routeAlternatives,routeAlternativeCoverage,coverage:{searches,estimatedSearches,searchLimit:limit,routeAlternativesDiscovered:matchingRouteCount(),...ageCoverage},limitation:'The source refused or deferred further requests during bounded route discovery. No complete route or ticket comparison is claimed.'};}
  searchedPairs.push(pair);
 }
 await updateRouteAlternatives(baseline,tripType);
 options.onProgress?.({stage:'comparison_pricing',fareRequestsPlanned:estimatedSearches,ticketBlocks:blocks.size,routePairsChecked:searchedPairs.length,routePairsPlanned:candidatePairs.length});
 for(const [key,block] of blocks){
  const chain=block.direction.segments.slice(block.start,block.end),leg=chain[0],prices=new Map(),groups=groupOptions.get(key);
  for(const group of groups){
   searches++;const request={...query,tripType:'one-way',returnDate:undefined,origin:leg.departure_airport,destination:chain.at(-1).arrival_airport,date:leg.departure_time_local.slice(0,10),...(identified?{travelers:group.travelers}:{adults:group.adults})};
   const result=await search(request);
   if(result.sources?.some(source=>SOURCE_STOP_STATUSES.includes(source.status))){blockResponses.get(key).push({travelerIds:group.travelerIds??null,adults:group.adults??null,sources:sourceCoverage(result.sources),qualifyingQuotes:0});return {status:'source_unavailable',plans:[],ticketBlockCoverage:summarizeTicketBlocks(blocks,blockResponses,results),routeAlternatives,routeAlternativeCoverage,coverage:{searches,estimatedSearches,searchLimit:limit,routeAlternativesDiscovered:matchingRouteCount(),...ageCoverage},limitation:'The source refused or deferred further requests. No complete ticket comparison is claimed.'};}
   const candidates=result.offers.filter(o=>o.currency==='CAD'&&o.cabin===query.cabin&&o.segments?.length===chain.length&&chain.every((s,i)=>same(o.segments[i],s))&&!o.inbound&&!o.requiresSelfTransfer&&cents(o.price)!==null&&o.ignavId&&quoteFreshness(o).status==='fresh');
   candidates.sort((a,b)=>a.price-b.price);blockResponses.get(key).push({travelerIds:group.travelerIds??null,adults:group.adults??null,sources:sourceCoverage(result.sources),qualifyingQuotes:candidates.length,...(candidates.length?{lowestQuote:{price:candidates[0].price,currency:candidates[0].currency,observedAt:candidates[0].observedAt,expiresAt:candidates[0].expiresAt??null}}:{})});if(candidates.length)prices.set(identified?group.mask:group.adults,identified?{offer:candidates[0],travelerIds:group.travelerIds}:candidates[0]);
  }
  if(identified){
   const best=bestIdentifiedPartition((1<<party.people.length)-1,prices);if(best)results.set(key,best);
  }else{
   const best=Array(party.adults+1).fill(null);best[0]={amount:0,tickets:[]};
   for(let count=1;count<=party.adults;count++)for(const [size,offer]of prices)if(size<=count&&best[count-size]){const amount=best[count-size].amount+cents(offer.price);if(Number.isSafeInteger(amount)&&(!best[count]||amount<best[count].amount))best[count]={amount,tickets:[...best[count-size].tickets,{offer,adults:size}]};}
   if(best[party.adults])results.set(key,best[party.adults]);
  }
 }
 if(quoteFreshness(baseline).status!=='fresh')return {status:'baseline_expired',plans:[],routeAlternatives,routeAlternativeCoverage,coverage:{searches,estimatedSearches,searchLimit:limit,routeAlternativesDiscovered:matchingRouteCount(),...ageCoverage},limitation:'The baseline quote aged out during comparison. Run a fresh search.'};
 const plans=combinations.flatMap(plan=>{
  if(plan.some(block=>!results.has(block.key)))return [];
  const tickets=plan.flatMap(block=>results.get(block.key).tickets.map(({offer,adults,travelerIds})=>({direction:block.direction.name,segment:block.start+1,segmentEnd:block.end,...(identified?{travelerIds}:{adults}),price:offer.price,currency:offer.currency,cabin:offer.cabin,ignavId:offer.ignavId,observedAt:offer.observedAt,expiresAt:offer.expiresAt,segments:offer.segments})));
  if(tickets.some(ticket=>quoteFreshness(ticket).status!=='fresh'))return [];
  const total=plan.reduce((sum,block)=>sum+results.get(block.key).amount,0),difference=(cents(baseline.price)-total)/100;
  if(!Number.isSafeInteger(total))return [];
  if(filters.maxPrice!==null&&total/100>filters.maxPrice)return [];
  const boundaries=plan.filter(block=>block.end<block.direction.segments.length).map(block=>block.direction.waits[block.end-1]);
  const observations=[baseline,...tickets],observedAt=new Date(Math.min(...observations.map(o=>Date.parse(o.observedAt)))).toISOString(),expiresAt=new Date(Math.min(...observations.map(o=>quoteFreshness(o).usableUntil))).toISOString();
  return [{price:total/100,currency:'CAD',observedAt,expiresAt,differenceBeforeExtras:difference,comparison:difference>0?'lower_before_extras':'no_lower_price',connectionMinutes:boundaries.length?Math.min(...boundaries):null,connectionsMinutes:boundaries,tickets}];
 }).sort((a,b)=>a.price-b.price);
 const coverage={searches,eligibleTicketPartitions:combinations.length,uniqueTicketBlocks:blocks.size,pricedTicketBlocks:results.size,completePlans:plans.length,routeAlternativesDiscovered:matchingRouteCount(),...ageCoverage};
 const ticketBlockCoverage=summarizeTicketBlocks(blocks,blockResponses,results);
 const ageCaveat=ageCategoryTransitionGroupsSkipped?` ${ageCategoryTransitionGroupsSkipped} traveler-group ticket quote${ageCategoryTransitionGroupsSkipped===1?' was':'s were'} skipped because supplied birth dates cross an infant/child/adult fare category within the exact segment dates.`:'';
 if(!plans.length)return {status:'segment_unavailable',coverage,ticketBlockCoverage,routeAlternatives,routeAlternativeCoverage,plans:[],limitation:`No eligible complete independently priced same-flight ticket grouping was found.${ageCaveat}`};
 return {status:'observed',tripType,coverage,ticketBlockCoverage,routeAlternatives,routeAlternativeCoverage,baseline:{price:baseline.price,currency:'CAD',ignavId:baseline.ignavId,observedAt:baseline.observedAt,expiresAt:baseline.expiresAt,itineraryKey:baseline.itineraryKey},plans,limitation:`Independent unprotected tickets on the same marketed flights. Carrier-specific age/fare eligibility, minor terms, issuance and original-ticket protection are unverified; a supplier-accepted quote is not proof that a seller can issue the group. Difference excludes unobserved baggage, transfer, change or other costs; independent quotes may refer to overlapping inventory, so seats are not confirmed and prices may change. Outbound and return stay time is not counted as a connection. Confirm entry, baggage and connection requirements and recheck each seller before purchase.${ageCaveat}`};
}
