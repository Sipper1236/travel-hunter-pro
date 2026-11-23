const normalize = value => value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');

export async function resolveCity(name, fetcher=fetch, selectedId, {includeAirports=true}={}) {
  if (selectedId !== undefined && !/^Q[1-9]\d*$/.test(selectedId)) throw Error('Choose a valid city identity.');
  const get=async url=>{const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'TravelHunterPro/0.1 (local travel research prototype)'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Live city lookup is unavailable. Select an airport instead.');const data=await response.json();if(data.error)throw Error('Live city lookup reported an error. Try again or select an airport.');return data;};
  const url=new URL('https://www.wikidata.org/w/api.php');
  url.search=new URLSearchParams({action:'wbsearchentities',search:name,language:'en',format:'json',limit:'50'});
  const entities=(await get(url)).search;
  if(!Array.isArray(entities))throw Error('Live city lookup returned an unexpected response. Try again or select an airport.');
  const candidates=entities.filter(item=>/^Q[1-9]\d*$/.test(item.id) && normalize(item.label ?? '')===normalize(name) && /\b(city|town|municipality|metropolitan area|commune|village)\b/i.test(item.description ?? ''));
  if(!candidates.length)throw Error(`No unique city identity was found for “${name}”. Select a specific airport from the suggestions.`);
  const identityUrl=new URL('https://query.wikidata.org/sparql');
  identityUrl.search=new URLSearchParams({format:'json',query:`SELECT DISTINCT ?city ?countryLabel ?iso ?coordinates WHERE { VALUES ?city { ${candidates.map(item=>`wd:${item.id}`).join(' ')} } ?city wdt:P31/wdt:P279* ?type; wdt:P17 ?country; wdt:P625 ?coordinates. VALUES ?type { wd:Q486972 wd:Q15284 } OPTIONAL { ?country wdt:P297 ?iso. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 51`});
  const identities=(await get(identityUrl)).results?.bindings ?? [];
  const ids=new Set(identities.map(row=>row.city?.value?.match(/\/entity\/(Q[1-9]\d*)$/)?.[1]).filter(Boolean));
  const matches=[...new Map(candidates.filter(item=>ids.has(item.id)).map(item=>[item.id,item])).values()];
  if (selectedId && !matches.some(city=>city.id===selectedId)) throw Error('The selected city no longer matches this location. Choose a city again.');
  if(matches.length>1 && !selectedId) {
    const error=new Error(`“${name}” identifies multiple cities. Choose the intended city or select a specific airport.`);
    error.cityChoices=matches.map(({id,label,description})=>({id,label,description,url:`https://www.wikidata.org/wiki/${id}`}));
    throw error;
  }
  if(!matches.length)throw Error(`No unique city identity was found for “${name}”. Select a specific airport from the suggestions.`);
  const city=matches.find(item=>item.id===selectedId) ?? matches[0],sparql=new URL('https://query.wikidata.org/sparql');
  const countries=identities.filter(row=>row.city?.value?.endsWith(`/entity/${city.id}`) && /^[A-Z]{2}$/.test(row.iso?.value ?? ''));
  const countryCodes=[...new Set(countries.map(row=>row.iso.value))];
  if(!includeAirports){
    const points=countries.map(row=>/^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(row.coordinates?.value ?? '')).filter(Boolean).map(match=>({longitude:Number(match[1]),latitude:Number(match[2])})).filter(point=>Number.isFinite(point.longitude)&&Math.abs(point.longitude)<=180&&Number.isFinite(point.latitude)&&Math.abs(point.latitude)<=90);
    return {kind:'city',region:{name:city.label,url:`https://www.wikidata.org/wiki/${city.id}`},airports:[],cityId:city.id,countryCode:countryCodes.length===1?countryCodes[0]:null,countryName:countryCodes.length===1?countries[0].countryLabel?.value:null,coordinates:points[0] ?? null};
  }
  sparql.search=new URLSearchParams({format:'json',query:`SELECT DISTINCT ?airport ?airportLabel ?code ?countryLabel WHERE { ?airport wdt:P931 wd:${city.id}; wdt:P238 ?code; wdt:P17 ?country; wdt:P31/wdt:P279* wd:Q1248784. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?code LIMIT 11`});
  const rows=(await get(sparql)).results?.bindings ?? [];
  const airports=[...new Map(rows.filter(row=>/^[A-Z]{3}$/.test(row.code?.value ?? '')).map(row=>[row.code.value,{code:row.code.value,name:row.airportLabel?.value,city:city.label,country:row.countryLabel?.value,entity:row.airport?.value,source:'Wikidata P931'}])).values()];
  if(!airports.length)throw Error(`No airports with verified served-city relationships were found for “${name}”. Select a specific airport instead.`);
  return {kind:'city',region:{name:city.label,url:`https://www.wikidata.org/wiki/${city.id}`},airports:airports.slice(0,10),moreAvailable:airports.length>10,method:'Wikidata unique city identity and airport P931 (place served) claims, ordered by IATA code. Candidate cap and missing claims can omit airports; this is not comprehensive coverage.',source:'Wikidata',cityId:city.id,countryCode:countryCodes.length===1?countryCodes[0]:null,countryName:countryCodes.length===1?countries[0].countryLabel?.value:null};
}
