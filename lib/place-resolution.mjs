import {lookupAirports} from './airport-lookup.mjs';
import {resolveCity} from './city-resolution.mjs';
const normalize = value => value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');

export async function resolvePlace(value, lookup=lookupAirports, cityLookup=resolveCity, selectedCityId) {
  if (typeof value !== 'string' || value.trim().length<2 || value.length>60) throw Error('Enter an airport or city.');
  const name=value.trim();
  if (selectedCityId !== undefined) return cityLookup(name,undefined,selectedCityId);
  if (/^[A-Z]{3}$/.test(name)) return {kind:'airport',region:{name},airports:[{code:name,name,source:'Traveler input'}],moreAvailable:false,method:'Traveler-supplied three-letter airport/metro code; each flight provider must resolve and validate it.'};
  let data;
  try {data=await lookup(name);} catch {return cityLookup(name);}
  const items=data.items ?? [];
  const exactAirports=items.filter(item=>normalize(item.code)===normalize(name) || normalize(item.name)===normalize(name));
  if(!exactAirports.length)return cityLookup(name);
  const matches=exactAirports;
  if (new Set(matches.map(item=>item.country)).size>1 || exactAirports.length>1) throw Error(`“${name}” matches airports in more than one location. Select a specific airport from the suggestions (${matches.map(item=>`${item.code}, ${item.city}, ${item.country}`).join('; ')}).`);
  const airports=[...new Map(matches.map(item=>[item.code,item])).values()];
  return {kind:'airport',region:{name,url:'https://ignav.com/'},airports,moreAvailable:false,method:'Ignav live airport lookup, exact airport name/code match.',source:data.source,cachedAt:data.cachedAt};
}
