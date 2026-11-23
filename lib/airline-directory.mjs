import {fetchSource} from './source-fetch.mjs';

const ENDPOINT='https://query.wikidata.org/sparql';
const cache=new Map();
const pending=new Map();

function normalizeQuery(query){
 if(typeof query!=='string'||query.trim().length<2||query.length>60)throw Object.assign(Error('Enter at least two characters.'),{status:400});
 const normalized=query.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!/^[\p{L}\p{N} .&'()-]+$/u.test(normalized))throw Object.assign(Error('Use letters, numbers, spaces, apostrophes, parentheses, periods, or hyphens.'),{status:400});
 return normalized;
}

/** Search Wikidata's live IATA-designator statements. This is discovery data, not an authoritative current-code registry. */
export async function searchAirlineDirectory(query,{fetcher,signal,now=Date.now()}={}){
 const normalized=normalizeQuery(query),key=normalized.toLocaleLowerCase('en'),cached=cache.get(key);
 if(cached&&now-cached.at<300000)return {...cached.value,cachedAt:new Date(cached.at).toISOString()};
 if(pending.has(key))return pending.get(key);
 const literal=normalized.replaceAll('\\','\\\\').replaceAll('"','\\"').toLocaleLowerCase('en');
 const codePrefix=literal.toLocaleUpperCase('en');
 const sparql=`SELECT ?code ?name WHERE { ?airline wdt:P229 ?code; wdt:P31/wdt:P279* wd:Q46970; rdfs:label ?name. FILTER(LANG(?name) = "en") FILTER(CONTAINS(LCASE(STR(?name)), "${literal}") || STRSTARTS(UCASE(STR(?code)), "${codePrefix}")) } ORDER BY LCASE(STR(?name)) LIMIT 80`;
 const url=new URL(ENDPOINT);url.search=new URLSearchParams({query:sparql,format:'json'});
 const task=(async()=>{
  const response=await fetchSource('Wikidata airline directory',url,{headers:{Accept:'application/sparql-results+json','User-Agent':'TravelHunterPro/0.1 (local travel research prototype)'},...(signal?{signal}:{})},{...(fetcher?{fetcher,policy:null}:{}),timeoutMs:20000});
  const data=await response.json(),byCode=new Map();
  for(const row of data.results?.bindings??[]){
   const code=row.code?.value,name=row.name?.value;
   if(!/^[A-Z0-9]{2}$/.test(code??'')||typeof name!=='string'||!name.trim())continue;
   const names=byCode.get(code)??new Set();names.add(name.trim());byCode.set(code,names);
  }
  const items=[...byCode].sort(([a],[b])=>a.localeCompare(b)).map(([code,names])=>({code,name:[...names].sort((a,b)=>a.localeCompare(b))[0],otherNames:[...names].sort((a,b)=>a.localeCompare(b)).slice(1,4)})).slice(0,20);
  const value={items,source:'Wikidata',sourceUrl:'https://www.wikidata.org/wiki/Property:P229',observedAt:new Date(now).toISOString(),limitation:'Live discovery results can be incomplete, ambiguous, historical, or missing. Confirm the code against the itinerary or carrier before relying on it.'};
  cache.set(key,{at:now,value});if(cache.size>200)cache.delete(cache.keys().next().value);
  return value;
 })();
 pending.set(key,task);
 try{return await task;}finally{pending.delete(key);}
}
