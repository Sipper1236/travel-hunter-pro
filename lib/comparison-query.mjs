import {validateTravelers,validateSearchParty} from './travelers.mjs';
import {validateFilters} from './flight-filter-query.mjs';

export const MAX_ROUTE_PAIR_SEARCHES = 20;
export const DEFAULT_ROUTE_PAIR_SEARCHES = 8;
// The search UI can retain up to 20 candidates on each side; the full exact
// Cartesian set must survive validation even though only 20 pairs are queried.
export const MAX_ROUTE_PAIR_CANDIDATES = 20 * 20;

/**
 * Build a bounded, deduplicated route-pair list from airport candidates already
 * ordered by their resolver. Lower rank-sum pairs are tried first so the cap
 * does not exhaust itself on one origin airport.
 */
export function buildRoutePairCandidates(origins,destinations,baseline,{limit=MAX_ROUTE_PAIR_CANDIDATES}={}){
  if(!Array.isArray(origins)||!Array.isArray(destinations)||!baseline||!Number.isInteger(limit)||limit<0||limit>MAX_ROUTE_PAIR_CANDIDATES)throw Error('Invalid route-pair candidate inputs.');
  const unique=(values)=>[...new Set(values.filter(code=>typeof code==='string'&&/^[A-Z]{3}$/.test(code)))];
  const from=unique(origins),to=unique(destinations),pairs=[];
  for(let originRank=0;originRank<from.length;originRank++)for(let destinationRank=0;destinationRank<to.length;destinationRank++){
    const origin=from[originRank],destination=to[destinationRank];
    if(origin===destination||(origin===baseline.origin&&destination===baseline.destination))continue;
    pairs.push({origin,destination,originRank,destinationRank});
  }
  pairs.sort((a,b)=>(a.originRank+a.destinationRank)-(b.originRank+b.destinationRank)||a.originRank-b.originRank||a.destinationRank-b.destinationRank);
  const selected=pairs.slice(0,limit).map(({origin,destination})=>({origin,destination}));
  return {pairs:selected,candidatePairs:pairs.length,omittedCandidatePairs:Math.max(0,pairs.length-selected.length)};
}

const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

/** Persist only the fields needed for a bounded, exact-airport comparison. */
export function validateComparisonQuery(input){
  if(!input||!['segments','party'].includes(input.mode))throw Error('Choose a supported ticket comparison.');
  if(input.travelers===undefined&&!Number.isInteger(input.adults))throw Error('Enter the actual adult traveler count for this comparison.');
  const party=input.travelers===undefined?validateTravelers(input):validateSearchParty(input);
  if(!party.people&&party.children)throw Error('Child and youth comparisons require guardian and age rules that are not yet supported.');
  for(const side of ['origin','destination'])if(typeof input[side]!=='string'||!/^[A-Z]{3}$/.test(input[side]))throw Error('Ticket comparisons require exact three-letter airport codes.');
  if(input.origin===input.destination)throw Error('Choose different origin and destination airports.');
  let routePairs=[];
  if(input.routePairs!==undefined){
    if(input.mode!=='segments')throw Error('Alternate airport pairs are supported only for segment comparisons.');
    if(!Array.isArray(input.routePairs)||input.routePairs.length>MAX_ROUTE_PAIR_CANDIDATES)throw Error(`Choose no more than ${MAX_ROUTE_PAIR_CANDIDATES} exact airport pairs for route discovery.`);
    const seen=new Set();
    routePairs=input.routePairs.map(pair=>{
      if(!pair||typeof pair.origin!=='string'||!/^[A-Z]{3}$/.test(pair.origin)||typeof pair.destination!=='string'||!/^[A-Z]{3}$/.test(pair.destination)||pair.origin===pair.destination)throw Error('Route discovery requires exact, different three-letter airport pairs.');
      const key=`${pair.origin}:${pair.destination}`;if(seen.has(key))throw Error('Route discovery airport pairs must be unique.');seen.add(key);
      return {origin:pair.origin,destination:pair.destination};
    });
  }
  if(!validDate(input.date)||input.date<new Date().toISOString().slice(0,10))throw Error('Enter a valid future departure date.');
  const tripType=input.tripType ?? 'one-way',cabin=input.cabin ?? 'economy';
  if(!['one-way','round-trip'].includes(tripType)||tripType==='round-trip'&&(!validDate(input.returnDate)||input.returnDate<input.date))throw Error('Choose a valid trip type and return date.');
  if(!['economy','premium_economy','business','first'].includes(cabin))throw Error('Choose a valid cabin.');
  const query={mode:input.mode,origin:input.origin,destination:input.destination,date:input.date,tripType,...(tripType==='round-trip'?{returnDate:input.returnDate}:{}),cabin,...(party.people?{travelers:party.people.map(({ages,...person})=>person)}:{adults:party.adults,children:0,childrenAges:[]}),filters:validateFilters(input.filters),...(routePairs.length?{routePairs}:{})};
  if(input.mode==='segments'){
    if(typeof input.itineraryKey!=='string'||!input.itineraryKey.length||input.itineraryKey.length>6000)throw Error('Choose a current itinerary to compare.');
    for(const field of ['splitPassengers','contiguousGroups'])if(input[field]!==undefined&&typeof input[field]!=='boolean')throw Error('Invalid ticket comparison option.');
    const minConnectionMinutes=input.minConnectionMinutes ?? 180,searchLimit=input.searchLimit ?? 100;
    if(!Number.isInteger(minConnectionMinutes)||minConnectionMinutes<180||minConnectionMinutes>1440)throw Error('Use a connection buffer from 180 to 1440 minutes.');
    if(!Number.isInteger(searchLimit)||searchLimit<1||searchLimit>200)throw Error('Choose a fare request budget from 1 to 200.');
    const routeSearchLimit=input.routeSearchLimit ?? DEFAULT_ROUTE_PAIR_SEARCHES;
    if(!Number.isInteger(routeSearchLimit)||routeSearchLimit<0||routeSearchLimit>MAX_ROUTE_PAIR_SEARCHES)throw Error(`Choose 0–${MAX_ROUTE_PAIR_SEARCHES} alternate airport-pair searches.`);
    Object.assign(query,{itineraryKey:input.itineraryKey,splitPassengers:input.splitPassengers ?? false,contiguousGroups:input.contiguousGroups ?? false,minConnectionMinutes,searchLimit,routeSearchLimit});
  }
  return query;
}

/** Options may be restored from the job; identity follows the trip and itinerary. */
export function comparisonStorageKey(input){
  return `travel-hunter-comparison:${JSON.stringify([input.mode,input.origin,input.destination,input.date,input.tripType ?? 'one-way',input.tripType==='round-trip'?input.returnDate:null,input.cabin ?? 'economy',input.travelers ?? null,input.adults,input.children ?? 0,validateFilters(input.filters),input.mode==='segments'?input.itineraryKey:null,input.routePairs ?? [],input.mode==='segments'?(input.routeSearchLimit ?? DEFAULT_ROUTE_PAIR_SEARCHES):null])}`;
}
