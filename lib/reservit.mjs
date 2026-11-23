import {call,saveSite} from 'api-anything';
import {mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {fetchSource} from './source-fetch.mjs';
import {getJobStore} from './job-store.mjs';
import {fetchPublic} from './public-fetch.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

export function directStayUrl(query,identity){
  const start=query.checkin.split('-').map(Number),end=query.checkout.split('-').map(Number),url=new URL(`https://secure.reservit.com/engine/booking/${identity.customer}/${identity.hotel}/avail`);
  url.search=new URLSearchParams({langcode:'EN',custid:identity.customer,fday:String(start[2]),fmonth:String(start[1]),fyear:String(start[0]),tday:String(end[2]),tmonth:String(end[1]),tyear:String(end[0]),nbpax:String(query.adults+query.childrenAges.length),currency:'CAD'}).toString();return url.toString();
}
export function reservitQuote(data){
  if(data?.bestPrice_unFormatted===-1)return null;
  const amount=data?.bestPrice_unFormatted,text=data?.bestPrice;
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(Math.round(amount*100))||Math.round(amount*100)<=0||Math.abs(amount*100-Math.round(amount*100))>1e-6)throw Error('The direct source returned an invalid stay price.');
  if(typeof text!=='string')throw Error('The direct source did not identify its displayed currency.');
  const match=/^(?:(?:CAD|CA\$|C\$)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)|((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)\s*(?:CAD|CA\$|C\$))$/.exec(text.replace(/&nbsp;/g,' ').trim());
  if(!match||Math.round(Number((match[1]||match[2]).replaceAll(',',''))*100)!==Math.round(amount*100))throw Error('The direct source did not return a matching explicit CAD price. No conversion was applied.');
  return {amount,priceText:`CAD ${amount.toFixed(2)}`,sourcePriceText:text};
}

/** Public Best Price operation, with only explicitly supplied ages and no partner-rate substitution. */
export async function searchReservit(query,property,{signal,fetcher,policy,run=call,stateHome=process.env.TRAVEL_API_ANYTHING_HOME || join(process.cwd(),'.cache','api-anything')}={}){
  if(query.rooms!==1){
    const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y));
    if(!Array.isArray(query.roomAllocations)||query.roomAllocations.length!==query.rooms||query.roomAllocations.some(room=>!room||!Array.isArray(room.adultAges)||!room.adultAges.length||room.adultAges.some(age=>!Number.isInteger(age)||age<18||age>120)||!Array.isArray(room.childrenAges)||room.childrenAges.some(age=>!Number.isInteger(age)||age<0||age>17))||!same(query.roomAllocations.flatMap(room=>room.adultAges),query.adultAges)||!same(query.roomAllocations.flatMap(room=>room.childrenAges),query.childrenAges)||query.adults!==query.adultAges.length)throw Error('This official source needs a validated allocation for each room.');
    const quotes=[];let requests=0;
    for(const room of query.roomAllocations){
      signal?.throwIfAborted();
      const result=await searchReservit({...query,rooms:1,roomAllocations:undefined,adults:room.adultAges.length,adultAges:room.adultAges,childrenAges:room.childrenAges},property,{signal,fetcher,policy,run,stateHome});
      requests+=result.requests;
      if(result.offers.length!==1)return {offers:[],status:'no_matching_observation',requests};
      quotes.push(result.offers[0]);
    }
    if(quotes.some(quote=>quoteFreshness(quote).status!=='fresh'))throw Error('A room quote expired before all room rates were collected.');
    const cents=quotes.reduce((sum,quote)=>sum+Math.round(quote.amount*100),0);
    if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Room quote totals could not be combined safely.');
    const first=quotes[0],oldest=new Date(Math.min(...quotes.map(quote=>Date.parse(quote.observedAt)))).toISOString();
    const roomQuotes=quotes.map((quote,index)=>({room:index+1,priceText:quote.priceText,sourcePriceText:quote.sourcePriceText,taxText:quote.taxText,cancellationText:quote.cancellationText,url:quote.url,observedAt:quote.observedAt,adultAges:query.roomAllocations[index].adultAges,childrenAges:query.roomAllocations[index].childrenAges,propertyKey:quote.officialEvidence?.propertyKey??null}));
    return {status:'observed',requests,offers:[{...first,amount:cents/100,priceText:`CAD ${(cents/100).toFixed(2)}`,sourcePriceText:null,observedAt:oldest,stayText:`${first.stay.nights} nights, ${query.rooms} separately quoted rooms, ${query.adults} adults, ${query.childrenAges.length} children/youths`,stay:{checkin:query.checkin,checkout:query.checkout,nights:first.stay.nights,rooms:query.rooms,adults:query.adults,adultAges:[...query.adultAges],childrenAges:[...query.childrenAges],roomAllocations:query.roomAllocations},roomQuotes,taxText:`Separate Reservit room observations: ${roomQuotes.map(room=>`room ${room.room}: ${room.taxText}`).join(' | ')} Recheck region-specific taxes and mandatory extras for each room; this sum is not a verified checkout total.`,bookingStatus:'Sum of separate room observations; simultaneous inventory, room categories, final taxes and booking availability are unverified.'}]};
  }
  if(!Array.isArray(query.adultAges)||query.adultAges.length!==query.adults)throw Error('Supply each adult’s actual age before searching this source.');
  mkdirSync(stateHome,{recursive:true,mode:0o700});chmodSync(stateHome,0o700);process.env.API_ANYTHING_HOME=stateHome;
  const {identity}=property,url=new URL(`https://secure.reservit.com/api/rs/bestprice/${identity.customer}/${identity.hotel}`);
  url.search=new URLSearchParams({fromdate:query.checkin,todate:query.checkout,roomAge1:[...query.adultAges,...query.childrenAges].join(','),lang:'EN',currency:'CAD',serviceIncluded:'true'}).toString();
  const name='travel-hunter-reservit-direct';
  saveSite({name,displayName:'Official hotel via Reservit',baseUrl:'https://secure.reservit.com',operations:[{name:'bestPrice',readOnly:true,minTier:1,params:[],slots:[],volatile:[],request:{method:'GET',url:url.toString(),headers:{}},trigger:{url:directStayUrl(query,identity)},response:{format:'json'}}]});
  let calls=0,failure,result;
  try{result=await run(name,'bestPrice',{}, {maxTier:1,fetchImpl:async value=>{
    signal?.throwIfAborted();if(String(value)!==url.toString()||calls>=1)throw failure ?? Error('The direct rate request did not match the validated stay.');calls++;
    try{const response=await fetchSource('Reservit direct rates',value,{signal},{fetcher:fetcher ?? ((target,init)=>fetchPublic(target,{signal:init.signal,accept:'application/json'})),policy:policy ?? (fetcher?null:getJobStore()),retrySafe:true});
      if(response.url&&response.url!==url.toString())throw Error('The direct-rate endpoint changed the requested query.');return response;
    }catch(error){failure=error;throw error;}
  }});}catch(error){throw failure ?? error;}
  if(failure)throw failure;
  if(!result.ok||!result.data||typeof result.data!=='object')throw Error('API Anything could not verify the direct-rate response.');
  const price=reservitQuote(result.data);if(!price)return {offers:[],status:'no_matching_observation',requests:calls};
  const observedAt=new Date().toISOString(),nights=(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000;
  const officialEvidence={status:'verified',propertyKey:identity.key,officialUrl:property.officialUrl,bookingEngine:'Reservit',observedAt,method:'Booking identity observed on the property website; direct public Best Price request'};
  const destination=query.destination;
  const locationEvidence=property.addressVerified?{status:'verified',city:destination.city,countryCode:destination.countryCode,cityId:destination.cityId,airport:destination.airport,hotelName:property.name,propertyKey:identity.key,sourceUrl:property.officialUrl,cityUrl:destination.cityUrl,observedAt,method:'Official property structured postal address matched to verified destination'}:{status:'unverified',reason:'A primary property postal address was not independently observed.'};
  const offer={name:property.name,stars:property.stars,classification:property.classification,...price,currency:'CAD',source:'Official hotel website via API Anything / Reservit',provider:'official',observedAt,url:directStayUrl(query,identity),officialEvidence,locationEvidence,stayText:`${nights} nights, ${query.adults} adults${query.childrenAges.length?`, ${query.childrenAges.length} children/youths`:''}`,stay:{checkin:query.checkin,checkout:query.checkout,nights,rooms:1,adults:query.adults,adultAges:[...query.adultAges],childrenAges:[...query.childrenAges]},taxText:'No itemized tax/fee breakdown supplied. Reservit documentation states Best Price totals are before taxes in North America and include taxes in Europe; property-specific local charges and tax treatment elsewhere are not established. Verify the final total, mandatory extras, and settlement currency on the booking page.',taxSourceUrl:'https://help.reservit.com/EN/presentation-of-our-tools-for-web-agencies',cancellationText:null,bookingStatus:'The supplied occupant ages were used for this direct-rate request. The current Reservit booking link carries dates and total guest count only and does not distinguish adults from children; re-enter the exact ages displayed for this stay on the property booking page. Specific room/rate and final availability require rechecking.',discovery:property.discovery};
  return {offers:[offer],status:'observed',requests:calls};
}
