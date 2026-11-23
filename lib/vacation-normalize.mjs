import {parse} from 'node-html-parser';
import {inspectVacationCards} from './vacation-extract.mjs';
import {rejectUnsupportedTravelerFields} from './travelers.mjs';
const PACKAGE_API='https://vacations-api.aircanada.com/packages-search/search';
const exact=(a,b)=>Object.is(a,b)||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>exact(value,b[index]))||a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&exact(a[key],b[key]));
const locationKey=value=>typeof value==='string'?value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
const isoDate=value=>{
 if(typeof value!=='string')return null;
 const normalized=/^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:value;
 return /^\d{4}-\d{2}-\d{2}$/.test(normalized)&&Number.isFinite(Date.parse(`${normalized}T00:00:00Z`))&&new Date(`${normalized}T00:00:00Z`).toISOString().slice(0,10)===normalized?normalized:null;
};
const cents=value=>Number.isFinite(value)&&value>0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6?Math.round(value*100):null;
const adultPaxType=value=>typeof value==='string'&&(/^(adult|adt)$/i.test(value)||/^a$/i.test(value));
const childPaxType=value=>typeof value==='string'&&(/^(child|chd)$/i.test(value)||/^c$/i.test(value));
const validObservedAt=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
function packageApiRequestMatches(value,query){
 try{
  const url=new URL(value),p=url.searchParams,limit=Number(p.get('limit')),offset=Number(p.get('offset'));
  const ageParams=p.getAll('child-ages'),childAgesMatch=query.childrenAges.length===0?ageParams.length===0:query.childrenAges.length===1&&ageParams.length===1&&ageParams[0]===String(query.childrenAges[0]);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&url.hostname==='vacations-api.aircanada.com'&&url.pathname==='/packages-search/search'&&p.get('orig')===query.origin&&isoDate(p.get('dep-date'))===query.date&&isoDate(p.get('ret-date'))===query.returnDate&&Number(p.get('adults'))===query.adults&&Number(p.get('rooms'))===query.rooms&&p.get('cabin')==='Y'&&p.get('destId')&&p.get('destType')&&p.get('dest')&&Number.isSafeInteger(limit)&&limit===20&&Number.isSafeInteger(offset)&&offset===0&&childAgesMatch&&!p.getAll('non_adult1').length&&!p.getAll('childAges').length;
 }catch{return false;}
}
function packageApiDestinationId(value){
 try{return new URL(value).searchParams.get('dest');}catch{return null;}
}
function packageListingMatches(value,query){
 try{
  const url=new URL(value),p=url.searchParams,infants=['nb_infant','nb_infants','infants'].flatMap(key=>p.getAll(key));
  const ages=[...p.entries()].filter(([key])=>/^non_adult\d+$/.test(key)).sort(([a],[b])=>Number(a.slice(9))-Number(b.slice(9))).map(([,age])=>/^\d+$/.test(age)?Number(age):NaN);
  let roomAdults=0,roomChildren=[];
  if(query.childrenAges.length){
   const room=p.get('r0');if(query.rooms!==1||!room)return false;
   for(const part of room.split(',')){const match=/^(\d+)-(adult|child)-(\d+)$/.exec(part);if(!match)return false;const count=Number(match[1]),age=Number(match[3]);if(!Number.isSafeInteger(count)||count<1)return false;if(match[2]==='adult'){if(age!==0)return false;roomAdults+=count;}else{if(age<2||age>17)return false;for(let index=0;index<count;index++)roomChildren.push(age);}}
  }
  return url.origin==='https://vacations.aircanada.com'&&url.pathname==='/en/packages/product-listing'&&p.get('departureLocation')===query.origin&&p.get('arrivalLocationName')===query.destinationLabel&&p.get('departingDateTime')===query.date.split('-').reverse().join('/')&&p.get('returnDateTime')===query.returnDate.split('-').reverse().join('/')&&p.get('nb_adult')===String(query.adults)&&p.get('numberOfRooms')===String(query.rooms)&&p.get('nb_child')===String(query.childrenAges.length)&&ages.length===query.childrenAges.length&&ages.every((age,index)=>age===query.childrenAges[index])&&(!query.childrenAges.length||roomAdults===query.adults&&roomChildren.length===query.childrenAges.length&&roomChildren.every((age,index)=>age===query.childrenAges[index]))&&(!infants.length||infants.length===1&&infants[0]==='0');
 }catch{return false;}
}

/** Normalize only the JSON package response observed from the exact ordinary widget submission. */
export function normalizeVacationApiResponse(data,{query,requestUrl,sourceUrl,observedAt,currencyTermsText,responseBytes}={}){
 rejectUnsupportedTravelerFields({...query,infants:undefined});
 if(!query||!Array.isArray(query.childrenAges)||query.childrenAges.length>1||query.childrenAges.some(age=>!Number.isInteger(age)||age<2||age>17)||query.infants?.length||query.childrenAges.length&&query.rooms!==1)throw Error('The structured package response supports adults with at most one exact-age child in one room; infants are not supported.');
 if((query.maxResults??20)!==20)throw Error('The structured package response currently supports one 20-result page.');
 if(!validObservedAt(observedAt)||!Number.isSafeInteger(responseBytes)||responseBytes<1||responseBytes>2_000_000)throw Error('The structured package response has invalid observation or size evidence.');
 if(!/All prices are in Canadian currency, unless otherwise indicated/i.test(currencyTermsText||''))throw Error('Air Canada Vacations CAD terms were not verified.');
 if(!packageApiRequestMatches(requestUrl,query))throw Error('The package API request does not match the exact supported query.');
 const requestDestinationId=packageApiDestinationId(requestUrl);
 const listing=new URL(sourceUrl);
 if(!packageListingMatches(sourceUrl,query))throw Error('The structured package response is not tied to the exact rendered provider listing.');
 const packages=data?.results?.packages,meta=data?.results?.metaData;
 const expectedInclusiveEnd=Array.isArray(packages)&&packages.length?packages.length-1:0;
 if(!data||!Array.isArray(packages)||packages.length>20||!meta||!Number.isSafeInteger(meta.totalAvailable)||meta.totalAvailable<0||!Number.isSafeInteger(meta.currentStart)||meta.currentStart!==0||!Number.isSafeInteger(meta.currentEnd)||meta.currentEnd!==expectedInclusiveEnd||meta.totalAvailable<packages.length||!data.hotels||typeof data.hotels!=='object'||!data.itineraries||typeof data.itineraries!=='object')throw Error('The package JSON response has an unsupported result envelope.');
 const expectedCity=locationKey(query.destinationLabel.split(',')[0]);
 const occupancyEvidence={status:'listing_parameters_match',adultsRequested:query.adults,adultsInListingUrl:Number(listing.searchParams.get('nb_adult')),roomsRequested:query.rooms,roomsInListingUrl:Number(listing.searchParams.get('numberOfRooms')),childrenAgesRequested:[...query.childrenAges],childrenAgesInListingUrl:query.childrenAges.map((_,index)=>Number(listing.searchParams.get(`non_adult${index+1}`))),lapInfantsRequested:0,lapInfantsInListingUrl:0,perRoomAllocation:query.rooms===1?'single_room_request':'not_exposed_by_widget'};
 const offers=[];let filterRejected=0,stopFilterRejected=0;
 for(const pkg of packages){
  const hotel=pkg&&data.hotels[pkg.hotelId],itineraryId=pkg?.selectedOptionIds?.itineraryId,itinerary=typeof itineraryId==='string'?data.itineraries[itineraryId]:null,info=pkg?.information,pricing=pkg?.pricing;
  const city=typeof hotel?.destination==='string'?hotel.destination.trim():'';
  const checkIn=isoDate(info?.checkIn),checkOut=isoDate(info?.checkOut),segments=itinerary?.segments;
  const routeSegments=Array.isArray(segments)?segments.filter(segment=>segment?.origin===query.origin&&segment?.destination===query.destinationAirport&&isoDate(segment?.departureDate)===query.date):[];
  const returnSegments=Array.isArray(segments)?segments.filter(segment=>segment?.origin===query.destinationAirport&&segment?.destination===query.origin&&isoDate(segment?.departureDate)===query.returnDate):[];
  const outbound=routeSegments.length===1?routeSegments[0]:null,inbound=returnSegments.length===1?returnSegments[0]:null;
  const hotelDateMatches=outbound&&inbound&&checkIn===isoDate(outbound.arrivalDate)&&checkOut===query.returnDate;
  const star=hotel?.starCategory,partyRows=pricing?.perPaxType;
  const validParty=Array.isArray(partyRows)&&partyRows.length>0&&partyRows.every(row=>Number.isSafeInteger(row?.paxCount)&&row.paxCount>0&&(adultPaxType(row?.paxType)||query.childrenAges.length===1&&childPaxType(row?.paxType))&&cents(row.price)!==null&&cents(row.taxFees)!==null&&cents(row.total)!==null&&cents(row.price)+cents(row.taxFees)===cents(row.total))&&partyRows.filter(row=>adultPaxType(row.paxType)).reduce((sum,row)=>sum+row.paxCount,0)===query.adults&&partyRows.filter(row=>childPaxType(row.paxType)).reduce((sum,row)=>sum+row.paxCount,0)===query.childrenAges.length;
  const groupCents=cents(pricing?.grandTotal),totalCents=cents(pricing?.total),partyTotal=validParty?partyRows.reduce((sum,row)=>sum+cents(row.total),0):null;
  const outboundStops=outbound?.numConnections,inboundStops=inbound?.numConnections;
  const offerValid=typeof pkg?.id==='string'&&pkg.id&&typeof pkg.hotelId==='string'&&typeof itineraryId==='string'&&itinerary?.id===itineraryId&&typeof hotel?.id==='string'&&hotel.id===pkg.hotelId&&hotel.destinationId===requestDestinationId&&typeof hotel.name==='string'&&hotel.name.trim()&&expectedCity&&locationKey(city.split(',')[0])===expectedCity&&Number.isFinite(star)&&star>=4&&star<=5&&info?.origin===query.origin&&info?.destination===query.destinationAirport&&checkIn&&checkOut===query.returnDate&&hotelDateMatches&&outbound?.cabinClass==='Y'&&inbound?.cabinClass==='Y'&&validParty&&groupCents!==null&&groupCents===totalCents&&groupCents===partyTotal&&Number.isInteger(outboundStops)&&outboundStops>=0&&Number.isInteger(inboundStops)&&inboundStops>=0&&typeof info.packageInclusions==='string'&&/flight/i.test(info.packageInclusions);
  if(!offerValid)continue;
  if(query.maxStops!==undefined&&(outboundStops>query.maxStops||inboundStops>query.maxStops)){stopFilterRejected++;continue;}
  if(star<(query.minStars??4)||query.maxPrice!==undefined&&groupCents>Math.round(query.maxPrice*100)){filterRejected++;continue;}
  const describe=segment=>`${segment.origin}–${segment.destination} ${isoDate(segment.departureDate)} ${segment.departureTime??'time unavailable'} to ${isoDate(segment.arrivalDate)} ${segment.arrivalTime??'time unavailable'} · ${segment.numConnections===0?'nonstop':`${segment.numConnections} stop${segment.numConnections===1?'':'s'}`}`;
  const flightSummary=`Departure: ${describe(outbound)}. Return: ${describe(inbound)}.`;
  offers.push({name:hotel.name.trim(),stars:star,price:groupCents/100,currency:'CAD',currencyEvidenceUrl:'https://vacations.aircanada.com/en/terms-conditions',provider:'Air Canada Vacations',source:'Air Canada Vacations packages-search/search',product:'supplier-package',observedAt,query,occupancyEvidence,propertyCity:city,destinationMatch:{status:'provider-listed city matches selected destination',city,evidence:'Structured package hotel destination field and selected provider destination ID'},hotelStay:{checkIn,checkOut},mealPlan:info.mealPlanName??null,taxText:'Structured provider group estimate includes the returned package tax/fee total; local charges may still apply.',cancellationText:typeof info.refundable==='boolean'?info.refundable?'Refundable status reported by provider':'Provider reports non-refundable':null,flightSummary,flightStops:{outbound:outboundStops,inbound:inboundStops},packageEvidence:{responsePackageId:pkg.id,hotelId:pkg.hotelId,itineraryId,paxRows:partyRows.map(row=>({count:row.paxCount,type:row.paxType})),groupTotalCents:groupCents,adultCount:query.adults,childrenAges:[...query.childrenAges],rooms:query.rooms,requestOrigin:query.origin,requestDestination:query.destinationAirport,requestDestinationId,departureDate:query.date,returnDate:query.returnDate,outboundArrivalDate:isoDate(outbound.arrivalDate)},bookingStatus:'Observed estimated package total; final availability, room assignment and local charges unconfirmed',sourceUrl:listing.href});
 }
 const received=packages.length,coverage={mode:'structured_widget_response',returnedPackages:received,totalAvailable:meta.totalAvailable,responseOffset:meta.currentStart,responseLimit:20,resultLimit:20,moreAvailable:meta.currentEnd+1<meta.totalAvailable,pagesExpanded:0};
 return {status:'observed',query,offers,received,rejected:received-offers.length,filterRejected,stopFilterRejected,unknownStops:0,coverage,sourceEvidence:{mode:'structured_widget_response',endpoint:PACKAGE_API,method:'GET',status:200,responseBytes,observedAt,request:{origin:query.origin,destination:query.destinationAirport,destinationId:requestDestinationId,departureDate:query.date,returnDate:query.returnDate,adults:query.adults,childrenAges:[...query.childrenAges],rooms:query.rooms,cabin:'economy',offset:0,limit:20},response:{returnedPackages:received,totalAvailable:meta.totalAvailable},packageLinks:offers.map(offer=>({packageId:offer.packageEvidence.responsePackageId,hotelId:offer.packageEvidence.hotelId,itineraryId:offer.packageEvidence.itineraryId,destinationId:offer.packageEvidence.requestDestinationId,totalCents:offer.packageEvidence.groupTotalCents})),currency:'CAD',currencyEvidence:'Official provider terms page; no contrary currency indicator in the response.'}};
}

export async function normalizeVacationListing(html,context){
 const {query,listingUrl,observedAt,currencyTermsText}=context;
 rejectUnsupportedTravelerFields({...query,infants:undefined});
 const url=new URL(listingUrl);
 if(url.origin!=='https://vacations.aircanada.com'||url.pathname!=='/en/packages/product-listing')throw Error('Expected the actual provider listing URL.');
 const requestedInfants=query.infants??[];
 if(!Array.isArray(requestedInfants)||requestedInfants.length>query.adults||requestedInfants.length>0&&requestedInfants.some(infant=>!infant||Object.keys(infant).length!==3||!['seating','departureAge','returnAge'].every(key=>Object.hasOwn(infant,key))||infant.seating!=='lap'||![0,1].includes(infant.departureAge)||![0,1].includes(infant.returnAge))||! /^[A-Z]{3}$/.test(query.destinationAirport||'')||!Array.isArray(query.childrenAges)||query.childrenAges.length>8||query.childrenAges.some(age=>!Number.isInteger(age)||age<2||age>17)||!Number.isInteger(query.rooms)||query.rooms<1||query.adults+query.childrenAges.length+requestedInfants.length>9||(query.childrenAges.length||requestedInfants.length)&&query.rooms!==1)throw Error('Supply the destination airport, exact supported party ages, and provider-supported room count.');
 const display=d=>d.split('-').reverse().join('/');
 const providerInfants=['nb_infant','nb_infants','infants'].flatMap(key=>url.searchParams.getAll(key));
 const childAgesFromUrl=[...url.searchParams.entries()].filter(([key])=>/^non_adult\d+$/.test(key)).sort(([a],[b])=>Number(a.slice(9))-Number(b.slice(9))).map(([,value])=>/^\d+$/.test(value)?Number(value):NaN);
 const roomParty=url.searchParams.get('r0');
 const matchesRoomParty=()=>{
  if(!query.childrenAges.length)return true;
  if(typeof roomParty!=='string'||!roomParty)return false;
  let adults=0;const children=[];
  for(const part of roomParty.split(',')){
   const match=/^(\d+)-(adult|child)-(\d+)$/.exec(part);
   if(!match)return false;
   const count=Number(match[1]),kind=match[2],age=Number(match[3]);
   if(!Number.isInteger(count)||count<1)return false;
   if(kind==='adult'){if(age!==0)return false;adults+=count;}
   else {if(age<2||age>17)return false;for(let i=0;i<count;i++)children.push(age);}
  }
  return adults===query.adults&&children.length===query.childrenAges.length&&children.every((age,index)=>age===query.childrenAges[index]);
 };
 const providerInfantCount=providerInfants.length===1&&/^\d+$/.test(providerInfants[0])?Number(providerInfants[0]):providerInfants.length===0?0:NaN;
 if(url.searchParams.get('departureLocation')!==query.origin||url.searchParams.get('arrivalLocationName')!==query.destinationLabel||url.searchParams.get('departingDateTime')!==display(query.date)||url.searchParams.get('returnDateTime')!==display(query.returnDate)||Number(url.searchParams.get('nb_adult'))!==query.adults||Number(url.searchParams.get('numberOfRooms'))!==query.rooms||Number(url.searchParams.get('nb_child'))!==query.childrenAges.length||providerInfantCount!==requestedInfants.length||childAgesFromUrl.length!==query.childrenAges.length||childAgesFromUrl.some((age,index)=>age!==query.childrenAges[index])||!matchesRoomParty()||!Number.isInteger(query.adults)||query.adults<1||!Number.isFinite(Date.parse(observedAt)))throw Error('Provider listing does not match the requested party and dates.');
 if(!/All prices are in Canadian currency, unless otherwise indicated/i.test(currencyTermsText||''))return {status:'currency_unverified',offers:[]};
 const occupancyEvidence={status:'listing_parameters_match',adultsRequested:query.adults,adultsInListingUrl:Number(url.searchParams.get('nb_adult')),roomsRequested:query.rooms,roomsInListingUrl:Number(url.searchParams.get('numberOfRooms')),childrenAgesRequested:[...query.childrenAges],childrenAgesInListingUrl:[...childAgesFromUrl],lapInfantsRequested:requestedInfants.length,lapInfantsInListingUrl:providerInfantCount,perRoomAllocation:query.rooms===1?'single_room_request':'not_exposed_by_widget'};
 const doc=parse(html),cards=doc.querySelectorAll('.hotel-item');
 const raw=await inspectVacationCards(html),offers=[];let filterRejected=0,stopFilterRejected=0,unknownStops=0;
 const money=text=>/^\$\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})$/.test(text?.trim()||'')?Number(text.replace(/[$,\s]/g,'')):NaN;
 const locationKey=value=>typeof value==='string'?value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
 const expectedCity=locationKey(query.destinationLabel.split(',')[0]);
 const dateText=d=>new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 for(let i=0;i<raw.observations.length;i++){
  const row=raw.observations[i],card=cards[i],id=card?.querySelector('.flight-details-link')?.getAttribute('aria-controls');
  const panel=id?doc.getElementById(id):null;
  if(!panel||/\b(?:USD|EUR|GBP|US\$)\b/i.test(card.textContent))continue;
  const outbound=panel.querySelector('.accordion-content.outbound'),inbound=panel.querySelector('.accordion-content.inbound');
  const text=n=>n?.textContent.trim();
  if(text(outbound?.querySelector('.city.destination .code'))!==query.destinationAirport||text(inbound?.querySelector('.city.origin .code'))!==query.destinationAirport||text(outbound?.querySelector('.city.origin .code'))!==query.origin||text(inbound?.querySelector('.city.destination .code'))!==query.origin||text(outbound?.querySelector('.datetime.origin .date'))!==dateText(query.date)||text(inbound?.querySelector('.datetime.origin .date'))!==dateText(query.returnDate))continue;
  const stars=Number.parseFloat(row.stars),price=money(row.totalText);
  const flightSummary=text(panel.querySelector('.sr-only'))||'';
  const readStops=direction=>{
   const match=new RegExp(`${direction}\\s+flight\\s+summary\\s*:\\s*(nonstop|(?:[1-9]\\d*)\\s+stops?)\\b`,'i').exec(flightSummary);
   if(!match)return null;
   return /^nonstop$/i.test(match[1])?0:Number(/^\d+/u.exec(match[1])?.[0]);
  };
  const outboundStops=readStops('Departure'),inboundStops=readStops('Return');
  const propertyCity=typeof row.city==='string'?row.city.trim():'';
  const listedCity=locationKey(propertyCity.split(',')[0]);
  if(!row.name||!expectedCity||!listedCity||listedCity!==expectedCity||!Number.isFinite(stars)||stars<4||stars>5||!Number.isFinite(price)||price<=0||!row.inclusions?.includes('Flight + Hotel'))continue;
  if(query.maxStops!==undefined){
   if(outboundStops===null||inboundStops===null){unknownStops++;continue;}
   if(outboundStops>query.maxStops||inboundStops>query.maxStops){stopFilterRejected++;continue;}
  }
  if(stars<(query.minStars ?? 4)||query.maxPrice!==undefined&&price>query.maxPrice){filterRejected++;continue;}
  offers.push({name:row.name,stars,price,currency:'CAD',currencyEvidenceUrl:'https://vacations.aircanada.com/en/terms-conditions',provider:'Air Canada Vacations',source:'Air Canada Vacations via api-anything',product:'supplier-package',observedAt,query,occupancyEvidence,propertyCity,destinationMatch:{status:'provider-listed city matches selected destination',city:propertyCity,evidence:'Hotel card city label'},mealPlan:row.mealPlan,taxText:row.taxText,cancellationText:row.cancellationText||null,flightSummary,flightStops:{outbound:outboundStops,inbound:inboundStops},bookingStatus:'Observed estimated package total; final availability, exact property address and local charges unconfirmed',sourceUrl:listingUrl});
 }
 return {status:'observed',offers,received:raw.observations.length,rejected:raw.observations.length-offers.length,filterRejected,stopFilterRejected,unknownStops};
}
