import {loadOurAirports} from './ourairports.mjs';
const cached=globalThis.__airportCountryCache ??= new Map();
const MAX_CODES=80;
/** Prefer fresh original airport records, then batch unresolved country claims through Wikidata. */
export async function lookupAirportCountries(codes, options={}){
 const unique=[...new Set(codes)].filter(code=>/^[A-Z]{3}$/.test(code));
 const result=new Map(), now=Date.now(), missing=[];
 for(const code of unique){const hit=cached.get(code);if(hit&&now-hit.at<86400000)result.set(code,hit.country);else if(missing.length<MAX_CODES)missing.push(code);}
 if(!missing.length)return result;
 // Injected HTTP-only callers retain their deterministic Wikidata contract unless a directory is supplied.
 if(options.loadDirectory||!options.fetcher)try{
  const directory=await (options.loadDirectory??loadOurAirports)();
  if(directory.cache?.status!=='stale'){
   const groups=new Map();for(const airport of directory.airports??[]){if(!missing.includes(airport.code)||!/^[A-Z]{2}$/.test(airport.iso??airport.country??''))continue;const set=groups.get(airport.code)??new Set();set.add(airport.iso??airport.country);groups.set(airport.code,set);}
   for(const [code,set] of groups)if(set.size===1){const country=[...set][0];result.set(code,country);cached.set(code,{country,at:now});}
  }
 }catch{/* Directory absence does not remove the independent Wikidata fallback. */}
 const unresolved=missing.filter(code=>!result.has(code));if(!unresolved.length)return result;
 const query=`SELECT DISTINCT ?code ?countryCode WHERE { VALUES ?code { ${unresolved.map(code=>`"${code}"`).join(' ')} } ?airport wdt:P238 ?code; wdt:P17 ?country. ?country wdt:P297 ?countryCode. }`;
 const url=new URL('https://query.wikidata.org/sparql');url.search=new URLSearchParams({query,format:'json'});
 let data;try{const response=await (options.fetcher ?? fetch)(url,{headers:{'User-Agent':'TravelHunterPro/0.1 (local travel research prototype)',Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('failed');data=await response.json();}catch{return result;}
 const countries=new Map();
 for(const row of data?.results?.bindings ?? []){const code=row.code?.value,country=row.countryCode?.value;if(unresolved.includes(code)&&/^[A-Z]{2}$/.test(country||'')){if(!countries.has(code))countries.set(code,new Set());countries.get(code).add(country);}}
 for(const [code,set] of countries)if(set.size===1){const country=[...set][0];result.set(code,country);cached.set(code,{country,at:now});}
 return result;
}
