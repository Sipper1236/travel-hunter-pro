import {parse} from 'node-html-parser';
import {bookingPropertyKey,normalizeLocation} from './hotel-identity.mjs';
import {locateChallenge} from './challenge.mjs';

export function readHotelLocation(html,{offer,destination,pageUrl}){
  const property=bookingPropertyKey(offer.url);
  if(!property || bookingPropertyKey(pageUrl)!==property)return {status:'unverified',reason:'Property page did not match the observed hotel link.'};
  if(new URL(offer.url).pathname.split('/')[2].toUpperCase()!==destination.countryCode)return {status:'unverified',reason:'Property country path conflicts with the verified destination.'};
  const candidates=[];
  for(const script of parse(html).querySelectorAll('script[type="application/ld+json"]')){
    let value;try{value=JSON.parse(script.textContent);}catch{continue;}
    const pending=[value];let visited=0;
    while(pending.length && visited++<1000){
      const node=pending.pop();if(Array.isArray(node)){pending.push(...node);continue;}if(!node || typeof node!=='object')continue;
      if(node['@graph'])pending.push(node['@graph']);if(node.mainEntity)pending.push(node.mainEntity);
      const types=[node['@type']].flat().filter(type=>typeof type==='string').map(type=>type.split('/').at(-1));
      if(!types.some(type=>['Hotel','Resort','LodgingBusiness'].includes(type)) || normalizeLocation(node.name)!==normalizeLocation(offer.name))continue;
      if(node.url && bookingPropertyKey(node.url)!==property)continue;
      const address=node.address,country=typeof address?.addressCountry==='string'?address.addressCountry:address?.addressCountry?.name;
      if(typeof address?.addressLocality!=='string'||typeof country!=='string')continue;
      candidates.push({city:address.addressLocality,country});
    }
  }
  const unique=[...new Map(candidates.map(value=>[`${normalizeLocation(value.city)}:${normalizeLocation(value.country)}`,value])).values()];
  if(unique.length!==1)return {status:'unverified',reason:'No unique structured hotel address was observed.'};
  const address=unique[0];
  if(normalizeLocation(address.city)!==normalizeLocation(destination.city) || ![normalizeLocation(destination.countryCode),normalizeLocation(destination.countryName)].filter(Boolean).includes(normalizeLocation(address.country)))return {status:'unverified',reason:'Observed hotel city/country does not match the verified destination.'};
  const sourceUrl=new URL(pageUrl);sourceUrl.search='';sourceUrl.hash='';
  return {status:'verified',city:address.city,countryCode:destination.countryCode,cityId:destination.cityId,airport:destination.airport,hotelName:offer.name,propertyKey:property,sourceUrl:sourceUrl.toString(),cityUrl:destination.cityUrl,observedAt:new Date().toISOString(),method:'Booking.com property Hotel/PostalAddress JSON-LD matched to Wikidata served city'};
}

export async function verifyHotelLocation(context,offer,destination){
  let page;
  try{
    if(!bookingPropertyKey(offer.url))return {status:'unverified',reason:'No supported Booking.com property identity.'};
    page=await context.newPage();const response=await page.goto(offer.url,{waitUntil:'domcontentloaded',timeout:20000});
    if(response && [401,403,429].includes(response.status()))return {status:'unverified',reason:'Property location access was refused.',stopChecking:true};
    if(await locateChallenge(page))return {status:'unverified',reason:'Property location requires separate provider verification.',stopChecking:true};
    return readHotelLocation(await page.content(),{offer,destination,pageUrl:page.url()});
  }catch{return {status:'unverified',reason:'Property location page could not be verified.'};}
  finally{await page?.close().catch(()=>{});}
}
