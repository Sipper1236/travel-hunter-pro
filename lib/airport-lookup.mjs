import {searchIgnavAirports} from './ignav.mjs';
const cache = globalThis.__travelAirportCache ??= new Map();
const pending = globalThis.__travelAirportPending ??= new Map();

export async function lookupAirports(query) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 80) throw Error('Enter at least two characters.');
  const key=query.trim().toLocaleLowerCase('en'), entry=cache.get(key);
  if (entry && Date.now()-entry.at<600000) return {items:entry.items,source:'Ignav',cachedAt:new Date(entry.at).toISOString()};
  if (pending.has(key)) return pending.get(key);
  const task=(async()=>{
    const items=await searchIgnavAirports(query), at=Date.now();
    if(cache.size>=200)cache.delete(cache.keys().next().value);
    cache.set(key,{items,at});
    return {items,source:'Ignav',cachedAt:new Date(at).toISOString()};
  })();
  pending.set(key,task);
  try {return await task;} finally {pending.delete(key);}
}
