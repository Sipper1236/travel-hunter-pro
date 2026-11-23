import {loadOurAirports,mergeAirportSources} from './ourairports.mjs';
import {SOURCE_STOP_STATUSES} from './source-errors.mjs';
import {fetchSource} from './source-fetch.mjs';
import {M49_POLICY_VERSION,m49PolicyFor,parseM49Catalog,selectM49Areas} from './m49-regions.mjs';
import { setDefaultResultOrder } from 'node:dns';
// Prefer IPv4 where hosts advertise IPv6 but the local network cannot route it.
setDefaultResultOrder('ipv4first');
import { validateFilters, applyFlightFilters } from './flight-filters.mjs';
import { searchProviders } from './providers.mjs';
import { join } from 'node:path';
import { createRegionCache } from './region-cache.mjs';
// A versioned cache prevents older geographic policies from masking current
// country and airport-boundary rules.
const cachedRegion = createRegionCache({directory:join(process.cwd(),'.cache','regions-v12'),ttlMs:7*24*60*60*1000});

const headers = { 'User-Agent': 'TravelHunterPro/0.1 (local travel research prototype)', Accept: 'application/json' };
const MAX_AIRPORTS = 100;
// A two-region search forms a Cartesian product; cap 20 per side at 400 pairs.
const MAX_SEARCH_AIRPORTS = 20;
// Keep result payloads bounded; large omitted pair sets are represented by
// their complete airport-code sets and exact cardinality instead of millions
// of duplicated objects.
const MAX_LISTED_UNCHECKED_PAIRS = 1000;
// Wikidata's passenger aggregation times out when all European countries are
// joined in one query. Small bounded batches keep lookup latency predictable.
const AIRPORT_QUERY_COUNTRY_BATCH = 10;
const EUROPE_POPULARITY_EXCLUSIONS = 3;
const MAX_COUNTRIES = 300;
const MAX_AIRPORT_BATCH_ROWS = 5000;
const M49_URL='https://unstats.un.org/unsd/methodology/m49/overview/';
let cachedM49, cachedM49At=0, m49InFlight;
async function getJson(url) {
  const response=await fetchSource('Wikidata geography',url,{headers},{timeoutMs:45000});
  return response.json();
}
export async function lookupRegion(name, fetchJson = getJson, options = {}) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 60) throw new Error('Enter a region or country name.');
  const namedPolicy=m49PolicyFor(name);
  if(namedPolicy){
    if(!namedPolicy.scope)throw Object.assign(Error(namedPolicy.note),{status:422});
    if(name.trim().toLocaleLowerCase('en')==='europe')return lookupContinentalEurope(name,fetchJson,options.fetchM49Catalog);
    return lookupM49Region(name,namedPolicy,fetchJson,options.fetchM49Catalog);
  }
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({action:'wbsearchentities', search:name.trim(), language:'en', format:'json', limit:'50'});
  const data = await fetchJson(url);
  const candidates = (data.search ?? []).filter(x => x.label?.toLocaleLowerCase() === name.trim().toLocaleLowerCase() && /\b(continent|country|region|subregion|archipelago|territory|island group)\b/i.test(x.description ?? '') && /^Q[1-9]\d*$/.test(x.id));
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Region name is ambiguous in Wikidata; use a more specific name.' : 'No uniquely identified region or country was found in Wikidata.');
  const region = candidates[0];
  // Airport country membership is used, so transcontinental countries can include airports outside the intended region.
  const countryQuery = `SELECT DISTINCT ?country ?countryLabel ?iso WHERE { { ?country wdt:P30 wd:${region.id}. } UNION { ?country wdt:P361 wd:${region.id}. } UNION { BIND(wd:${region.id} AS ?country) } ?country wdt:P297 ?iso. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?iso ?country LIMIT ${MAX_COUNTRIES + 1}`;
  const countryUrl = new URL('https://query.wikidata.org/sparql');
  countryUrl.search = new URLSearchParams({query:countryQuery,format:'json'});
  const countryRows = (await fetchJson(countryUrl)).results?.bindings ?? [];
  const countries = countryRows.map(x => ({id:x.country?.value?.match(/\/entity\/(Q[1-9]\d*)$/)?.[1],name:x.countryLabel?.value,iso:x.iso?.value})).filter(x => x.id && x.name && /^[A-Z]{2}$/.test(x.iso ?? ''));
  const countriesMoreAvailable = countries.length > MAX_COUNTRIES;
  const selectedCountries = countries.slice(0,MAX_COUNTRIES);
  const countryCoverage = {countryLimit:MAX_COUNTRIES,countries:selectedCountries.map(({id,...country})=>country),countriesUnchecked:countries.slice(MAX_COUNTRIES).map(({id,...country})=>country),countriesMoreAvailable};
  const regionInfo={name:region.label,description:region.description,id:region.id,url:`https://www.wikidata.org/wiki/${region.id}`};
  if (!selectedCountries.length) return {region:regionInfo,...countryCoverage,airports:[],uncheckedAirports:[],moreAvailable:false,method:'Wikidata country membership lookup returned no matches.'};
  const query = `SELECT DISTINCT ?airport ?airportLabel ?code ?countryLabel WHERE { VALUES ?country { ${selectedCountries.map(({id}) => `wd:${id}`).join(' ')} } ?airport wdt:P17 ?country; wdt:P238 ?code; wdt:P31 wd:Q1248784. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?code ?airport LIMIT ${MAX_AIRPORTS + 1}`;
  const sparql = new URL('https://query.wikidata.org/sparql');
  sparql.search = new URLSearchParams({query,format:'json'});
  const result = await fetchJson(sparql);
  const airports = (result.results?.bindings ?? []).map(x => ({code:x.code?.value, name:x.airportLabel?.value, country:x.countryLabel?.value, entity:x.airport?.value})).filter(x => /^[A-Z]{3}$/.test(x.code ?? '') && x.name && x.country);
  return { region:regionInfo,...countryCoverage,airports:airports.slice(0,MAX_AIRPORTS),uncheckedAirports:airports.slice(MAX_AIRPORTS),moreAvailable:airports.length > MAX_AIRPORTS,method:'Wikidata airport country membership, continent and direct part-of relationships for countries with ISO codes. Country and airport results are bounded; transcontinental countries may include airports outside the intended region, and Wikidata may be incomplete.' };
}

async function lookupContinentalEurope(name,fetchJson=getJson,customCatalog){
 const catalog=await loadM49(fetchJson,customCatalog);
 const resolved=await lookupM49Region(name,m49PolicyFor(name),fetchJson,async()=>catalog);
 const observed=[...resolved.airports,...resolved.uncheckedAirports],byCode=new Map(),geographicExcludedAirports=[],geographyUnknownAirports=[];
 for(const airport of observed){
  const match=airport.coordinates?.match(/^Point\((-?[\d.]+) (-?[\d.]+)\)$/);
  if(!match){geographyUnknownAirports.push(airport);continue;}
  const longitude=Number(match[1]),latitude=Number(match[2]);
  if(longitude < -25||longitude > 45||latitude < 34||latitude > 72){geographicExcludedAirports.push(airport);continue;}
  const prior=byCode.get(airport.code);if(!prior||prior.passengers<airport.passengers)byCode.set(airport.code,airport);
 }
 const ranked=[...byCode.values()].sort((a,b)=>b.passengers-a.passengers||a.code.localeCompare(b.code));
 const popularityRanked=ranked.filter(airport=>Number.isFinite(airport.passengers)&&airport.passengers>0);
 const excludedAirports=popularityRanked.slice(0,EUROPE_POPULARITY_EXCLUSIONS),excludedCodes=new Set(excludedAirports.map(airport=>airport.code)),eligible=ranked.filter(airport=>!excludedCodes.has(airport.code));
 const popularityExclusionShortfall=Math.max(0,EUROPE_POPULARITY_EXCLUSIONS-excludedAirports.length);
 const region={...resolved.region,description:'UNSD M49 Europe (region 150) country membership, with a bounded airport-coordinate convention for continental candidate selection.',policyVersion:`${M49_POLICY_VERSION}+airport-box-v1`,policyNote:'Airports must lie within 25°W–45°E and 34°N–72°N. This is an explicit approximate airport-level boundary: it excludes eastern Russia beyond 45°E and does not split airport grounds across a boundary.'};
 const uniqueGeographicExcluded=[...new Map(geographicExcludedAirports.map(airport=>[airport.code,airport])).values()],uniqueGeographyUnknown=[...new Map(geographyUnknownAirports.map(airport=>[airport.code,airport])).values()];
 const geographicExcludedAirportCount=uniqueGeographicExcluded.length,geographyUnknownAirportCount=uniqueGeographyUnknown.length;
 const geography=`Known M49-country airports outside the coordinate box (${geographicExcludedAirportCount}) or without valid coordinates (${geographyUnknownAirportCount}) are omitted from fare candidates; up to ${MAX_AIRPORTS} codes per group are listed in coverage. The box is a documented approximate airport-level boundary, not a claim about every transcontinental country or airport.`;
 return {...resolved,region,geographicExcludedAirportCount,geographyUnknownAirportCount,geographicExcludedAirports:uniqueGeographicExcluded.slice(0,MAX_AIRPORTS),geographyUnknownAirports:uniqueGeographyUnknown.slice(0,MAX_AIRPORTS),excludedAirports,popularityExclusionLimit:EUROPE_POPULARITY_EXCLUSIONS,popularityRankedCandidates:popularityRanked.length,popularityExclusionShortfall,airports:eligible.slice(0,MAX_AIRPORTS),uncheckedAirports:eligible.slice(MAX_AIRPORTS),moreAvailable:resolved.moreAvailable||eligible.length>MAX_AIRPORTS,method:`${resolved.method} Within the coordinate box, candidates with positive recorded Wikidata passenger values (P3872) rank by that value, with code as tie-breaker; airports without traffic data follow alphabetically. Up to the top ${EUROPE_POPULARITY_EXCLUSIONS} traffic-ranked candidates are reported and excluded. ${popularityExclusionShortfall?`Only ${excludedAirports.length} of ${EUROPE_POPULARITY_EXCLUSIONS} requested exclusions had recorded traffic data; unknown-traffic airports are retained, not treated as popularity-ranked. `:''}${geography}`};
}

async function loadM49(fetchJson,customCatalog){
 if(customCatalog)return customCatalog();
 const now=Date.now();if(cachedM49&&now-cachedM49At<24*60*60*1000)return cachedM49;if(m49InFlight)return m49InFlight;
 m49InFlight=(async()=>{
  const response=await fetchSource('UN M49',M49_URL,{headers:{...headers,Accept:'text/html'}},{timeoutMs:30000});
  if(new URL(response.url||M49_URL).origin!=='https://unstats.un.org')throw Error('UN M49 redirected away from the official data source.');
  const html=await response.text(),catalog=parseM49Catalog(html);cachedM49=catalog;cachedM49At=Date.now();return catalog;
 })();
 try{return await m49InFlight;}finally{m49InFlight=undefined;}
}

async function lookupM49Region(name,namedPolicy,fetchJson=getJson,customCatalog){
 const catalog=await loadM49(fetchJson,customCatalog),areas=selectM49Areas(catalog,namedPolicy.scope);
 if(!areas.length)throw Error(`The selected ${M49_POLICY_VERSION} policy did not match any UN country/area records for “${name}”.`);
 const selectedAreas=areas.slice(0,MAX_COUNTRIES),isoCodes=[...new Set(selectedAreas.map(area=>area.iso2).filter(value=>/^[A-Z]{2}$/.test(value??'')))];
 if(!isoCodes.length)throw Error(`No UN M49 countries or areas in “${name}” had an ISO-alpha2 code for airport resolution.`);
 const isoValues=isoCodes.map(value=>`"${value}"`).join(' '),countryQuery=`SELECT DISTINCT ?country ?countryLabel ?iso WHERE { VALUES ?iso { ${isoValues} } ?country wdt:P297 ?iso. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?iso ?country LIMIT ${MAX_COUNTRIES+1}`;
 const countryUrl=new URL('https://query.wikidata.org/sparql');countryUrl.search=new URLSearchParams({query:countryQuery,format:'json'});
 const rows=(await fetchJson(countryUrl)).results?.bindings??[],entitiesByIso=new Map();
 for(const row of rows){const iso=row.iso?.value,id=row.country?.value?.match(/\/entity\/(Q[1-9]\d*)$/)?.[1],name=row.countryLabel?.value;if(!/^[A-Z]{2}$/.test(iso??'')||!id||!name)continue;const list=entitiesByIso.get(iso)??[];if(!list.some(item=>item.id===id))list.push({id,name,iso});entitiesByIso.set(iso,list);}
 const byIso=new Map([...entitiesByIso].filter(([,items])=>items.length===1).map(([iso,items])=>[iso,items[0]]));
 const unresolved=selectedAreas.filter(area=>!area.iso2||!byIso.has(area.iso2)).map(area=>({name:area.name,iso:area.iso2,reason:!area.iso2?'UN M49 area has no ISO-alpha2 country code.':entitiesByIso.get(area.iso2)?.length>1?'ISO code maps to multiple Wikidata country entities.':'No Wikidata country entity for this M49 area code.'}));
 const resolved=selectedAreas.filter(area=>area.iso2&&byIso.has(area.iso2)).map(area=>byIso.get(area.iso2));
 const moreCountries=areas.length>MAX_COUNTRIES||rows.length>MAX_COUNTRIES;
 const countryCoverage={countryLimit:MAX_COUNTRIES,countries:resolved.map(({name,iso})=>({name,iso})),countriesUnchecked:areas.slice(MAX_COUNTRIES).map(area=>({name:area.name,iso:area.iso2})),countriesUnresolved:unresolved,countriesMoreAvailable:moreCountries};
 const m49Codes=[...(namedPolicy.scope.regions??[]).map(value=>`region ${value}`),...(namedPolicy.scope.subregions??[]).map(value=>`subregion ${value}`),...(namedPolicy.scope.intermediates??[]).map(value=>`intermediate region ${value}`),...(namedPolicy.scope.areas??[]).map(value=>`area ${value}`)],scopeIsoCodes=namedPolicy.scope.iso2??[];
 const scopeParts=[...(m49Codes.length?[`UNSD M49 membership: ${m49Codes.join(', ')}`]:[]),...(scopeIsoCodes.length?[`${m49Codes.length?'Explicit ISO additions':'Explicit ISO area scope'}: ${scopeIsoCodes.join(', ')}`]:[])];
 const region={name,description:scopeParts.join('; '),id:`${M49_POLICY_VERSION}:${name}`,url:namedPolicy.sourceUrl??M49_URL,policyVersion:M49_POLICY_VERSION,...(namedPolicy.note?{policyNote:namedPolicy.note}:{}),...(namedPolicy.sourceUrl?{policySourceUrl:namedPolicy.sourceUrl}:{})};
 const isEurope=name.trim().toLocaleLowerCase('en')==='europe';
 const membershipMethod=scopeIsoCodes.length?(m49Codes.length?'UNSD M49 plus explicit ISO area membership':'Explicit ISO country/area membership'):`${M49_POLICY_VERSION} M49 country/area membership`;
 const method=`${membershipMethod} resolved through live Wikidata ISO claims. ${isEurope?'Europe candidate airports are additionally filtered at airport level by the documented coordinate boundary.':'Airports are selected by country membership, not airport-level political/continental boundaries; transcontinental countries may include out-of-scope airports.'} ${unresolved.length?'Some UN country/area records could not be mapped to Wikidata. ':''}Wikidata may omit countries or airports.`;
 if(!resolved.length)return {region,...countryCoverage,airports:[],uncheckedAirports:[],moreAvailable:moreCountries||unresolved.length>0,method};
 const countryIds=[...new Set(resolved.map(value=>value.id))],airportRows=[];
 let airportQueryTruncated=false;
 for(let offset=0;offset<countryIds.length;offset+=AIRPORT_QUERY_COUNTRY_BATCH){
  const batch=countryIds.slice(offset,offset+AIRPORT_QUERY_COUNTRY_BATCH);
  const airportTypePath=name.trim().toLocaleLowerCase('en')==='europe'?'wdt:P31/wdt:P279*':'wdt:P31';
  const airportQuery=`SELECT ?airport ?airportLabel ?code ?countryLabel ?coord (MAX(?passengerValue) AS ?passengers) WHERE { VALUES ?country { ${batch.map(id=>`wd:${id}`).join(' ')} } ?airport wdt:P17 ?country; wdt:P238 ?code; ${airportTypePath} wd:Q1248784. OPTIONAL {?airport wdt:P625 ?coord.} OPTIONAL {?airport wdt:P3872 ?passengerValue.} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?airport ?airportLabel ?code ?countryLabel ?coord ORDER BY DESC(?passengers) ?code LIMIT ${MAX_AIRPORT_BATCH_ROWS}`;
  const airportUrl=new URL('https://query.wikidata.org/sparql');airportUrl.search=new URLSearchParams({query:airportQuery,format:'json'});
  const batchRows=(await fetchJson(airportUrl)).results?.bindings??[];
  if(batchRows.length>=MAX_AIRPORT_BATCH_ROWS)airportQueryTruncated=true;
  airportRows.push(...batchRows);
 }
 const airports=airportRows.map(row=>({code:row.code?.value,name:row.airportLabel?.value,country:row.countryLabel?.value,entity:row.airport?.value,passengers:Number(row.passengers?.value)||0,coordinates:row.coord?.value??null})).filter(airport=>/^[A-Z]{3}$/.test(airport.code??'')&&airport.name&&airport.country);
 const continentalEurope=name.trim().toLocaleLowerCase('en')==='europe';
 const scoped=airports;
 scoped.sort((a,b)=>b.passengers-a.passengers||a.code.localeCompare(b.code));
 return {region,...countryCoverage,airportQueryTruncated,airports:scoped.slice(0,MAX_AIRPORTS),uncheckedAirports:scoped.slice(MAX_AIRPORTS),moreAvailable:airportQueryTruncated||scoped.length>MAX_AIRPORTS||moreCountries||unresolved.length>0,method:`${method} Airport order uses highest recorded Wikidata passenger value (P3872) across country batches of at most ${AIRPORT_QUERY_COUNTRY_BATCH}; airports without passenger data follow by IATA code. Results are bounded to ${MAX_AIRPORT_BATCH_ROWS.toLocaleString("en")} airport rows per country batch.${airportQueryTruncated?' Additional airports may be omitted because an upstream batch reached its row limit; their identities are unknown.':''}${continentalEurope?' Europe additionally filters to a documented continental bounding box (25°W–45°E, 34°N–72°N), excluding overseas territories and distant transcontinental airports.':''}`};
}
export async function resolveRegion(name) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 60) throw new Error('Enter a region or country name.');
  const policy=m49PolicyFor(name);
  if(!policy?.scope)return cachedRegion(name,lookupRegion);
  const [primary,secondary]=await Promise.allSettled([(async()=>{
    const [snapshot,catalog]=await Promise.all([loadOurAirports(),loadM49()]);
    const areas=selectM49Areas(catalog,policy.scope),isos=new Set(areas.map(area=>area.iso2)),europe=name.trim().toLowerCase()==='europe';
    const selected=snapshot.airports.filter(a=>isos.has(a.iso)&&(!europe||(a.longitude>=-25&&a.longitude<=45&&a.latitude>=34&&a.latitude<=72)));
    return {region:{name,url:M49_URL,description:europe?'UNSD M49 Europe country membership with an airport-level coordinate boundary; OurAirports and Wikidata candidates are merged when both sources are available.':undefined,policyVersion:europe?`${M49_POLICY_VERSION}+airport-box-v1+dual-directory-v2`:M49_POLICY_VERSION+'+dual-directory-v1',policyNote:[policy.note,europe?'Airport coordinates must fall within 25°W–45°E and 34°N–72°N; this is an approximate continental-Europe convention. Wikidata traffic-ranked candidates are bounded and reported separately.':null].filter(Boolean).join(' ')},airports:selected,countries:areas.map(a=>({name:a.name,iso:a.iso2})),cache:snapshot.cache,method:'OurAirports scheduled-service IATA airports joined to UNSD M49 country/area scope; unioned with bounded Wikidata candidates. Neither directory is exhaustive.'};
  })(),cachedRegion(name,lookupRegion)]);
  const result=mergeAirportSources(primary.status==='fulfilled'?primary.value:null,secondary.status==='fulfilled'?secondary.value:null,{strictPopularity:name.trim().toLocaleLowerCase('en')==='europe'});
  result.method+=' Wikidata region snapshots are refreshed at most weekly; OurAirports snapshots daily. '+result.directorySources.map(s=>`${s.source}: ${s.status}${s.cache?.savedAt?' (snapshot '+s.cache.savedAt+')':''}${s.cache?.status==='stale'?' (stale cache; refresh failed)':''}.`).join(' ');
  return result;
}
export async function searchRegion(input, resolve = resolveRegion, search = searchProviders, side = 'destination') {
  if (!['origin', 'destination'].includes(side)) throw Error('Choose an origin or destination region.');
 const budget=input.airportLimit ?? 10;
 if(!Number.isInteger(budget)||budget<4||budget>MAX_SEARCH_AIRPORTS)throw Error(`Choose between 4 and ${MAX_SEARCH_AIRPORTS} airports per region.`);
  const coverage = await resolve(input[side]);
  const checked = [], offers = [], priceObservations=[];
  for (const airport of coverage.airports.slice(0,budget)) {
    const result = await search({...input,[side]:airport.code, originType:'place', destinationType:'place'});
    checked.push({airport, sources:result.sources, complete:result.complete, offers:result.offers.length});
     offers.push(...result.offers);
     priceObservations.push(...(result.priceObservations??[]));
    if (result.sources.some(s => SOURCE_STOP_STATUSES.includes(s.status))) break;
  }
  const filtered=await applyFlightFilters(offers,validateFilters(input.filters));
  const selected=coverage.airports.slice(0,budget);
  const uncheckedAirports=[...coverage.airports.slice(checked.length),...(coverage.uncheckedAirports ?? [])];
  return { query:input, observedAt:new Date().toISOString(), offers:filtered.offers, priceObservations, filterCoverage:filtered.rejected, coverage:{...coverage, side, airportLimit:budget, moreAvailable:coverage.moreAvailable || coverage.airports.length>budget, airports:selected, uncheckedAirports, checked}, sources:[], complete:false, limitations:[`${side === 'origin' ? 'Origin' : 'Destination'} region search checks at most ${budget} selected airport candidates from the resolved location; known omitted airports and bounded country coverage are listed.`,coverage.method,'Only the selected, configured providers and supported fare types are searched.','Prices are observations, not confirmed bookings.'] };
}

export async function searchRegionPair(input, resolve = resolveRegion, search = searchProviders, {onProgress=()=>{},onProviderResult}={}) {
  const budget = input.airportLimit ?? 10;
 if (!Number.isInteger(budget)||budget<4||budget>MAX_SEARCH_AIRPORTS) throw Error(`Choose between 4 and ${MAX_SEARCH_AIRPORTS} airports per region.`);
  const [originCoverage, destinationCoverage] = await Promise.all([resolve(input.origin,'origin'), resolve(input.destination,'destination')]);
  const origins = originCoverage.airports.slice(0, budget), destinations = destinationCoverage.airports.slice(0, budget);
  const checked = [], offers = [], priceObservations=[];
  let stoppedBySource = false;
  const planned=origins.reduce((n,o)=>n+destinations.filter(d=>d.code!==o.code).length,0);
  onProgress({stage:'searching',pairsChecked:0,pairsPlanned:planned});
  outer: for (const origin of origins) for (const destination of destinations) {
    if (origin.code === destination.code) continue;
    const routeQuery={...input, origin:origin.code, destination:destination.code, originType:'place', destinationType:'place'};
    const result = await search(routeQuery,{onProviderResult:event=>onProviderResult?.({...event,query:routeQuery})});
    checked.push({origin, destination, sources:result.sources, complete:result.complete, offers:result.offers.length});
    offers.push(...result.offers);
    priceObservations.push(...(result.priceObservations??[]));
    onProgress({stage:'searching',pairsChecked:checked.length,pairsPlanned:planned,currentRoute:`${origin.code} → ${destination.code}`});
    if (result.sources.some(source => SOURCE_STOP_STATUSES.includes(source.status))) { stoppedBySource = true; break outer; }
  }
  const filtered = await applyFlightFilters(offers, validateFilters(input.filters));
  const pairsPlanned = origins.reduce((sum,origin)=>sum+destinations.filter(destination=>destination.code!==origin.code).length,0);
  const checkedKeys = new Set(checked.map(pair=>`${pair.origin.code}:${pair.destination.code}`));
  const uncheckedPairs = origins.flatMap(origin=>destinations.filter(destination=>destination.code!==origin.code&&!checkedKeys.has(`${origin.code}:${destination.code}`)).map(destination=>({origin,destination})));
  const allOrigins=[...new Map([...(originCoverage.airports??[]),...(originCoverage.uncheckedAirports??[])].filter(airport=>/^[A-Z]{3}$/.test(airport?.code??'')).map(airport=>[airport.code,airport])).values()];
  const allDestinations=[...new Map([...(destinationCoverage.airports??[]),...(destinationCoverage.uncheckedAirports??[])].filter(airport=>/^[A-Z]{3}$/.test(airport?.code??'')).map(airport=>[airport.code,airport])).values()];
  const selectedOriginCodes=new Set(origins.map(airport=>airport.code)),selectedDestinationCodes=new Set(destinations.map(airport=>airport.code));
  const countPairs=(left,right)=>left.reduce((sum,origin)=>sum+right.filter(destination=>destination.code!==origin.code).length,0);
  const allKnownPairs=countPairs(allOrigins,allDestinations),selectedKnownPairs=countPairs(origins,destinations),outsideSelectedPairs=Math.max(0,allKnownPairs-selectedKnownPairs);
  const uncheckedAirportPairs=outsideSelectedPairs<=MAX_LISTED_UNCHECKED_PAIRS?allOrigins.flatMap(origin=>allDestinations.filter(destination=>origin.code!==destination.code&&(!selectedOriginCodes.has(origin.code)||!selectedDestinationCodes.has(destination.code))).map(destination=>({origin,destination,reason:'outside_selected_airport_limit'}))):[];
  const outsideSelectedPairCoverage={knownOriginAirportCount:allOrigins.length,knownDestinationAirportCount:allDestinations.length,knownAirportPairs:allKnownPairs,selectedAirportPairs:selectedKnownPairs,outsideSelectedPairs,enumeratedPairs:uncheckedAirportPairs.length,enumerationLimit:MAX_LISTED_UNCHECKED_PAIRS,resolverMayHaveMore:Boolean(originCoverage.moreAvailable||destinationCoverage.moreAvailable),representation:'Cartesian product of the known origin and destination airport codes, excluding same-code pairs; outside-selected pairs are those for which at least one endpoint is not in the selected airport sets.'};
  return {
     query:input, observedAt:new Date().toISOString(), offers:filtered.offers, priceObservations, filterCoverage:filtered.rejected, sources:[], complete:false,
    coverage:{side:'both', airportLimit:budget, origin:{...originCoverage, airports:origins, uncheckedAirports:[...originCoverage.airports.slice(budget),...(originCoverage.uncheckedAirports ?? [])], knownAirportCount:allOrigins.length, moreAvailable:originCoverage.moreAvailable || originCoverage.airports.length>budget}, destination:{...destinationCoverage, airports:destinations, uncheckedAirports:[...destinationCoverage.airports.slice(budget),...(destinationCoverage.uncheckedAirports ?? [])], knownAirportCount:allDestinations.length, moreAvailable:destinationCoverage.moreAvailable || destinationCoverage.airports.length>budget}, pairsPlanned, pairsChecked:checked.length, stoppedBySource, checked, uncheckedPairs, uncheckedAirportPairs, outsideSelectedPairCoverage},
    limitations:[`Location search checked ${checked.length} of ${pairsPlanned} planned airport pairs. Pairs omitted after a source stop and known airport combinations outside the selected airport limits are listed; resolver caps may hide additional locations and pairs.`,`${budget} selected airports per location maximum; Wikidata coverage can be incomplete.`,...(stoppedBySource?['Search stopped early because a source reported blocking, rate limiting, an authorization failure, or temporary unavailability.']:[]),'Only the selected, configured providers and supported fare types are searched.','Prices are observations, not confirmed bookings.'],
  };
}
