import {parse} from 'node-html-parser';
import {fetchSource} from './source-fetch.mjs';
import {getJobStore} from './job-store.mjs';
import {fetchPublic} from './public-fetch.mjs';
import {normalizeLocation} from './hotel-identity.mjs';

export function reservitIdentity(value,base){
  try{
    const url=new URL(value,base);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!['secure.reservit.com','hotel.reservit.com'].includes(url.hostname))return null;
    const match=/^\/(?:engine|fo)\/booking\/(\d{1,8})\/(\d{1,8})(?:\/|$)/.exec(url.pathname);
    const customer=match?.[1] ?? url.searchParams.get('custid') ?? url.searchParams.get('id'),hotel=match?.[2] ?? url.searchParams.get('hotelid');
    return /^\d{1,8}$/.test(customer ?? '')&&/^\d{1,8}$/.test(hotel ?? '')?{customer,hotel,key:`reservit:${customer}:${hotel}`}:null;
  }catch{return null;}
}
const tidy=value=>normalizeLocation(value).replace(/[’‘]/g,"'");
function structuredHotels(doc){
  const result=[];
  for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){
    let data;try{data=JSON.parse(script.textContent);}catch{continue;}
    const pending=[data];let visited=0;
    while(pending.length&&visited++<1000){const node=pending.pop();if(Array.isArray(node)){pending.push(...node);continue;}if(!node||typeof node!=='object')continue;
      if(node['@graph'])pending.push(node['@graph']);if(node.mainEntity)pending.push(node.mainEntity);
      if([node['@type']].flat().some(type=>typeof type==='string'&&['Hotel','Resort','LodgingBusiness','LocalBusiness'].includes(type.split('/').at(-1))))result.push(node);
    }
  }
  return result;
}

export function inspectOfficialHotel(html,{pageUrl,candidate,destination,minStars=4}){
  const doc=parse(html),titles=[doc.querySelector('title')?.textContent,...doc.querySelectorAll('h1').map(n=>n.textContent),doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')].filter(Boolean);
  const hotels=structuredHotels(doc).filter(node=>typeof node.name==='string');
  const matches=hotels.filter(node=>{
    const address=node.address,country=typeof address?.addressCountry==='string'?address.addressCountry:address?.addressCountry?.name;
    return tidy(address?.addressLocality)===tidy(destination.city)&&[destination.countryCode,destination.countryName].filter(Boolean).some(value=>tidy(value)===tidy(country));
  });
  const names=[...new Set(matches.map(node=>tidy(node.name)))];
  if(names.length>1)throw Error('The website contains multiple hotel identities for this city.');
  const node=matches[0];
  const candidateNames=[candidate.name,...(candidate.names ?? [])].filter(Boolean);
  if(node&&candidateNames.length&&!candidateNames.some(name=>tidy(name)===tidy(node.name)))throw Error('The website hotel name differs from the discovered property.');
  const name=node?.name ?? candidateNames.find(name=>titles.some(title=>tidy(title).includes(tidy(name)))) ?? (!candidateNames.length?doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content'):null);
  if(!name)throw Error('A unique hotel name could not be matched to this website.');
  const descriptions=[...titles,doc.querySelector('meta[name="description"]')?.getAttribute('content'),...hotels.filter(h=>tidy(h.name)===tidy(name)).map(h=>h.description)].filter(value=>typeof value==='string').join(' ');
  const stated=new Set([...descriptions.matchAll(/\b([1-5]|one|two|three|four|five)[ -]*(?:stars?|étoiles?)\b/gi)].map(m=>({one:1,two:2,three:3,four:4,five:5})[m[1].toLowerCase()] ?? Number(m[1])));
  if(node?.starRating?.ratingValue!==undefined)stated.add(Number(node.starRating.ratingValue));
  if(stated.size>1)throw Error('The website has conflicting star-class statements.');
  const stars=stated.size?[...stated][0]:candidate.stars;
  if(![4,5].includes(stars)||stars<minStars)throw Error('The property is not verified at the requested four/five-star class.');
  if(candidate.stars&&stated.size&&candidate.stars!==stars)throw Error('Website and directory star classes disagree.');
  const identityMap=new Map();
  for(const element of doc.querySelectorAll('a[href],iframe[src],form[action]')){
    const identity=reservitIdentity(element.getAttribute('href')||element.getAttribute('src')||element.getAttribute('action'),pageUrl);
    if(identity)identityMap.set(identity.key,identity);
  }
  if(identityMap.size!==1)throw Error(identityMap.size?'The website links more than one Reservit property.':'The official website does not expose a supported Reservit booking link.');
  const identity=[...identityMap.values()][0];
  const primaryAddress=Boolean(node);
  if(!primaryAddress&&!(tidy(candidate.city)===tidy(destination.city)&&candidate.countryCode===destination.countryCode))throw Error('The property city and country could not be matched.');
  const officialUrl=new URL(pageUrl);officialUrl.hash='';officialUrl.search='';
  return {name,stars,identity,officialUrl:officialUrl.toString(),classification:{value:stars,source:stated.size?'Official property website':'OpenStreetMap stars tag',url:stated.size?officialUrl.toString():candidate.sourceUrl},addressVerified:primaryAddress,discovery:candidate.sourceUrl?{source:'OpenStreetMap',url:candidate.sourceUrl}:null};
}

/** Candidate websites only; live property/booking observations supply the prices. */
export async function discoverOfficialHotels(destination,{limit=5,signal,fetcher=fetch}={}){
  if(!/^Q[1-9]\d*$/.test(destination.cityId ?? ''))throw Error('A verified hotel city is required.');
  let coordinates=destination.coordinates;
  if(!coordinates){
    const url=new URL('https://query.wikidata.org/sparql');url.search=new URLSearchParams({format:'json',query:`SELECT ?coordinates WHERE { wd:${destination.cityId} wdt:P625 ?coordinates. } LIMIT 2`}).toString();
    const r=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'TravelHunterPro/0.1'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!r.ok)throw Error('Hotel city coordinates are unavailable.');
    const value=(await r.json()).results?.bindings?.[0]?.coordinates?.value,match=/^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(value ?? '');if(match)coordinates={longitude:Number(match[1]),latitude:Number(match[2])};
  }
  if(!Number.isFinite(coordinates?.latitude)||Math.abs(coordinates.latitude)>90||!Number.isFinite(coordinates?.longitude)||Math.abs(coordinates.longitude)>180)throw Error('Verified city coordinates are unavailable.');
  const radius=10000,query=`[out:json][timeout:20];nwr(around:${radius},${coordinates.latitude},${coordinates.longitude})["tourism"="hotel"]["stars"~"^[45]$"];out tags center 101;`;
  const url=new URL('https://overpass-api.de/api/interpreter');url.searchParams.set('data',query);
  const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'TravelHunterPro/0.1'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(`Hotel website discovery is unavailable (HTTP ${response.status}).`);
  const data=await response.json();if(!Array.isArray(data.elements)||data.remark)throw Error('The hotel directory query did not finish with complete candidate data.');
  const seen=new Set(),candidates=[];
  for(const element of data.elements){
    const tags=element.tags ?? {},website=tags.website || tags['contact:website'];
    if(!['node','way','relation'].includes(element.type)||!Number.isSafeInteger(element.id)||typeof tags.name!=='string'||!website||![4,5].includes(Number(tags.stars)))continue;
    let official;try{official=new URL(website);if(official.protocol==='http:')official.protocol='https:';if(official.protocol!=='https:'||official.username||official.password)continue;}catch{continue;}
    const key=official.origin+official.pathname;if(seen.has(key))continue;seen.add(key);
    candidates.push({name:tags.name,names:[tags['name:en']].filter(Boolean),stars:Number(tags.stars),website:official.toString(),city:tags['addr:city'],countryCode:tags['addr:country'],sourceUrl:`https://www.openstreetmap.org/${element.type}/${element.id}`});
  }
  return {candidates:candidates.slice(0,limit),coverage:{discovered:candidates.length,checkedLimit:limit,radiusMeters:radius,moreAvailable:candidates.length>limit||data.elements.length>=101,source:'OpenStreetMap',attributionUrl:'https://www.openstreetmap.org/copyright',cityUrl:destination.cityUrl}};
}

export async function readOfficialWebsite(url,{signal,fetcher,policy}={}){
  const response=await fetchSource('Official hotel websites',url,{signal},{fetcher:fetcher ?? ((value,init)=>fetchPublic(value,{signal:init.signal})),policy:policy ?? (fetcher?null:getJobStore()),retrySafe:true});
  if(!response.ok)throw Error(`Official hotel website failed (HTTP ${response.status}).`);return response;
}
