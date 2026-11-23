import {resolveCity} from './city-resolution.mjs';
const normalize=value=>value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');

export async function airportServedCities(code,fetcher=fetch){
  if(!/^[A-Z]{3}$/.test(code))throw Error('Select an arrival airport code.');
  const url=new URL('https://query.wikidata.org/sparql');
  url.search=new URLSearchParams({format:'json',query:`SELECT DISTINCT ?airport ?city ?cityLabel ?countryLabel ?iso WHERE { ?airport wdt:P238 "${code}"; wdt:P31/wdt:P279* wd:Q1248784; wdt:P931 ?city. ?city wdt:P31/wdt:P279* wd:Q486972; wdt:P17 ?country; wdt:P625 ?coordinates. ?country wdt:P297 ?iso. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?cityLabel LIMIT 51`});
  const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'TravelHunterPro/0.1'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Arrival-airport city lookup is unavailable.');
  const rows=(await response.json()).results?.bindings;
  if(!Array.isArray(rows))throw Error('Arrival-airport city lookup returned an unexpected response.');
  if(new Set(rows.map(row=>row.airport?.value)).size!==1)throw Error('The arrival airport could not be uniquely linked to a served city.');
  const cities=[...new Map(rows.filter(row=>/^Q[1-9]\d*$/.test(row.city?.value?.split('/').at(-1) ?? '') && /^[A-Z]{2}$/.test(row.iso?.value ?? '') && row.cityLabel?.value).map(row=>{
    const id=row.city.value.split('/').at(-1),countryCode=row.iso.value;
    return [`${id}:${countryCode}`,{id,label:row.cityLabel.value,countryCode,countryName:row.countryLabel?.value,url:`https://www.wikidata.org/wiki/${id}`}];
  })).values()];
  if(!cities.length||rows.length>=51)throw Error('Arrival-airport city coverage is missing or incomplete. Choose a more specific airport.');
  if(new Set(cities.map(city=>city.id)).size!==cities.length)throw Error('A served city has conflicting country claims; its hotel destination could not be verified.');
  return cities;
}

export async function resolveHotelDestination(query,{citiesForAirport=airportServedCities,cityLookup=(name,fetcher,id)=>resolveCity(name,fetcher,id,{includeAirports:false})}={}){
  let city;
  if(query.destinationAirport){
    const cities=await citiesForAirport(query.destinationAirport);
    if(normalize(query.city)===normalize(query.destinationAirport)){
      const choices=query.cityId?cities.filter(item=>item.id===query.cityId):cities;
      if(choices.length!==1){const error=Error('Choose a city served by the arrival airport.');error.cityChoices=cities.map(item=>({...item,description:`City in ${item.countryName || item.countryCode}`}));error.locationSide='destination';error.locationValue=query.city;throw error;}
      city=choices[0];
    }else{
      let resolved;try{resolved=await cityLookup(query.city,undefined,query.cityId);}catch(error){if(error.cityChoices){error.locationSide='destination';error.locationValue=query.city;}throw error;}
      const matches=cities.filter(item=>item.id===resolved.cityId && item.countryCode===resolved.countryCode);
      if(matches.length!==1)throw Error('The selected hotel city is not verified as a city served by the flight arrival airport.');
      city=matches[0];
    }
  }else{
    let resolved;try{resolved=await cityLookup(query.city,undefined,query.cityId);}catch(error){if(error.cityChoices){error.locationSide='destination';error.locationValue=query.city;}throw error;}
    city={id:resolved.cityId,label:resolved.region.name,countryCode:resolved.countryCode,countryName:resolved.countryName,url:resolved.region.url,coordinates:resolved.coordinates};
  }
  if(!/^[A-Z]{2}$/.test(city.countryCode ?? ''))throw Error('Hotel city country evidence could not be verified.');
  return {cityId:city.id,city:city.label,countryCode:city.countryCode,countryName:city.countryName,airport:query.destinationAirport ?? null,cityUrl:city.url,...(city.coordinates?{coordinates:city.coordinates}:{}),method:'Wikidata settlement/country and airport P931 served-city claims',observedAt:new Date().toISOString()};
}
