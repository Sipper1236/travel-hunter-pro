import {setTimeout as delay} from 'node:timers/promises';
import {startJob,jobAction} from './browser-jobs.mjs';
import {validateStay} from './booking-browser.mjs';
import {resolveHotelDestination} from './hotel-destination.mjs';
import {searchOfficialStays} from './official-hotel-search.mjs';
import {searchBooking as searchBookingDemand} from './booking.mjs';
import {bookingPropertyKey,normalizeLocation} from './hotel-identity.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

async function runBookingSession(query,{signal,onProgress=()=>{},nextInteraction=()=>null,onInteractionResult=()=>{},start=startJob,act=jobAction,destination,destinationWarning}={}) {
  const session=await start(query,{destination,destinationWarning});let snapshot,nextPoll=0;
  const publish=()=>onProgress({...snapshot.progress,stage:snapshot.challenge?'hotel_verification':snapshot.progress?.stage || 'searching_hotels',challenge:snapshot.challenge?{...snapshot.challenge,capturedAt:Date.now()}:null});
  try {
    while(!signal?.aborted){
      const command=nextInteraction();
      if(command){
        try{snapshot=await act({id:session.id,action:command.input.kind==='refresh'?'poll':'input',...command.input});publish();onInteractionResult({id:command.id});}
        catch(error){onInteractionResult({id:command.id,error:error.message});}
        nextPoll=Date.now()+(snapshot?.challenge?10000:1000);
      }else if(Date.now()>=nextPoll){snapshot=await act({id:session.id,action:'poll'});publish();nextPoll=Date.now()+(snapshot.challenge?10000:1000);}
      if(snapshot?.status==='complete')return snapshot.result;
      if(snapshot?.status==='error')throw Object.assign(Error(snapshot.message || 'Hotel source failed.'),{sourceStatus:snapshot.sourceStatus,retryAt:snapshot.retryAt});
      if(snapshot?.status==='cancelled')throw Error('Hotel search cancelled.');
      await delay(200,undefined,{signal});
    }
    signal?.throwIfAborted();
  }finally{await act({id:session.id,action:'cancel'}).catch(()=>{});}
}

const cadCents=value=>{
 const match=/^CAD\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)$/.exec(String(value??'').trim());if(!match)return null;
 const amount=Number(match[1].replaceAll(',','')),cents=Math.round(amount*100);
 return Number.isSafeInteger(cents)&&cents>0&&Math.abs(amount*100-cents)<1e-6?cents:null;
};
const sameAges=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort((x,y)=>x-y).every((age,index)=>age===[...b].sort((x,y)=>x-y)[index]);
function verifiedRoomOffer(offer,query,destination){
 const key=bookingPropertyKey(offer?.url),stay=offer?.stay,proof=offer?.locationEvidence;
 const occupancy=offer?.occupancyEvidence;
 if(offer?.source==='Booking.com via api-anything'&&(!occupancy||occupancy.status!=='provider_count_match'||occupancy.adultsMatched!==true||occupancy.nightsMatched!==true||occupancy.childrenCountMatched!==true||occupancy.roomsMatched!==true||occupancy.individualAgesEchoed!==false||!sameAges(occupancy.requestedAdultAges,query.adultAges)||!sameAges(occupancy.requestedChildrenAges,query.childrenAges)))return null;
 if(!key||offer.currency!=='CAD'||!Number.isInteger(offer.stars)||offer.stars<query.minStars||offer.stars>5||quoteFreshness(offer).status!=='fresh'||!stay||stay.checkin!==query.checkin||stay.checkout!==query.checkout||stay.nights!==(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000||stay.rooms!==1||stay.adults!==query.adults||!sameAges(stay.adultAges,query.adultAges)||!sameAges(stay.childrenAges,query.childrenAges)||cadCents(offer.priceText)===null||!proof||proof.status!=='verified'||quoteFreshness(proof).status!=='fresh'||proof.propertyKey!==key||normalizeLocation(proof.hotelName)!==normalizeLocation(offer.name)||normalizeLocation(proof.city)!==normalizeLocation(destination.city)||proof.cityId!==destination.cityId||proof.countryCode!==destination.countryCode)return null;
 if(query.destinationAirport&&proof.airport!==query.destinationAirport)return null;
 return {key,cents:cadCents(offer.priceText)};
}
function combinedBookingRooms(query,destination,roomResults){
 const indexed=roomResults.map(({query:roomQuery,result,error,sourceStatus})=>{
   const properties=new Map();
   for(const offer of result?.offers??[]){const verified=verifiedRoomOffer(offer,roomQuery,destination);if(verified&&!properties.has(verified.key))properties.set(verified.key,{offer,...verified});}
   return {query:roomQuery,result,error,sourceStatus,properties};
 });
 let common=new Set(indexed[0]?.properties.keys()??[]);for(const room of indexed.slice(1))common=new Set([...common].filter(key=>room.properties.has(key)));
 const completeRoomSet=indexed.length===query.rooms&&indexed.every(room=>room.result);
 const offers=[];
 for(const key of completeRoomSet?common:[]){
  const matches=indexed.map(room=>room.properties.get(key)),cents=matches.reduce((sum,item)=>sum+item.cents,0);
  if(!Number.isSafeInteger(cents)||cents<=0)continue;
  const first=matches[0].offer,roomQuotes=matches.map(({offer},index)=>({room:index+1,priceText:offer.priceText,taxText:offer.taxText??'Taxes and fees not provided.',cancellationText:offer.cancellationText??null,url:offer.url,observedAt:offer.observedAt,adultAges:[...query.roomAllocations[index].adultAges],childrenAges:[...query.roomAllocations[index].childrenAges],occupancyEvidence:offer.occupancyEvidence??null,propertyKey:key}));
  const observedAt=new Date(Math.min(...roomQuotes.map(room=>Date.parse(room.observedAt)))).toISOString(),terms=new Set(roomQuotes.map(room=>room.cancellationText));
  offers.push({...first,priceText:`CAD ${(cents/100).toFixed(2)}`,observedAt,stayText:`${(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000} nights · ${query.rooms} separately quoted rooms · ${query.adults} adults · ${query.childrenAges.length} children/youths`,stay:{checkin:query.checkin,checkout:query.checkout,nights:(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000,rooms:query.rooms,adults:query.adults,adultAges:[...query.adultAges],childrenAges:[...query.childrenAges],roomAllocations:query.roomAllocations.map(room=>({adultAges:[...room.adultAges],childrenAges:[...room.childrenAges]}))},roomQuotes,occupancyEvidence:{status:'separate_room_count_matches',individualAgesEchoed:false,rooms:roomQuotes.map(({room,occupancyEvidence})=>({room,...occupancyEvidence}))},taxText:`Separate Booking.com room observations: ${roomQuotes.map(room=>`room ${room.room}: ${String(room.taxText).replace(/[.]+$/,'')}`).join(' | ')}. This sum is not an all-in checkout total.`,cancellationText:terms.size===1?roomQuotes[0].cancellationText:'Room cancellation terms vary; review each room rate.',bookingStatus:'Each Booking.com room search matched its requested guest counts and property, but the listing did not echo individual ages. The combined displayed-price sum is an estimate; simultaneous room availability, room type equivalence and final charges are unverified.',provider:'booking'});
 }
 const completed=indexed.filter(room=>room.result).length;
 const failed=indexed.length-completed,notAttempted=Math.max(0,query.rooms-indexed.length);
 const sourceResults=Array.from({length:query.rooms},(_,index)=>{
  const room=indexed[index];
  if(!room)return {provider:'Booking.com browser search',room:index+1,status:'not_searched',observations:0,acceptedForSameProperty:0,reason:'An earlier room search failed; this room was not queried.'};
  return {provider:'Booking.com browser search',room:index+1,status:room.result?'observed':room.sourceStatus||'error',observations:room.result?.offers?.length??0,acceptedForSameProperty:room.properties.size,...(room.sourceStatus?{sourceStatus:room.sourceStatus}:{}),...(!room.result?{reason:room.error||'The room search did not complete; no inventory conclusion was made.',...(room.retryAt?{retryAt:room.retryAt}:{})}:{})};
 });
 return {offers,coverage:{scope:'separate_room_queries',roomsRequested:query.rooms,roomsObserved:completed,roomSearchesPlanned:query.rooms,roomSearchesAttempted:indexed.length,roomSearchesCompleted:completed,roomSearchesFailed:failed,roomSearchesNotAttempted:notAttempted,commonPropertyCount:completeRoomSet?common.size:0,partialCommonPropertyCount:completeRoomSet?undefined:common.size,simultaneousAvailabilityVerified:false},sourceResults,received:indexed.reduce((sum,room)=>sum+(room.result?.received??0),0),rejected:indexed.reduce((sum,room)=>sum+(room.result?.rejected??0),0)};
}

async function searchBookingHotel(input,options={}) {
  let query=validateStay(input);const {signal,onProgress=()=>{},resolveDestination=resolveHotelDestination,preResolvedDestination}=options;signal?.throwIfAborted();
  let destination=preResolvedDestination ?? null,destinationWarning=null;
  if(!destination){
    onProgress({stage:'resolving_hotel_destination'});
    try{destination=await resolveDestination(query);}
    catch(error){if(error.cityChoices)throw error;destinationWarning=error.message;}
    signal?.throwIfAborted();
  }
  if(!destination)return {offers:[],query,received:0,rejected:0,coverage:{scope:query.rooms>1?'separate_room_queries':'single_room_query',roomsRequested:query.rooms,roomsObserved:0,commonPropertyCount:0,simultaneousAvailabilityVerified:false},sourceResults:[{provider:'Booking.com browser search',status:'unverified_destination',reason:destinationWarning??'The destination city could not be verified.'}],limitation:`No Booking.com request was made because the typed destination could not be resolved to a verified city${destinationWarning?`: ${destinationWarning}`:'.'}`};
  query={...query,city:destination.city,cityId:destination.cityId};
  if(query.rooms===1){
    const result=await runBookingSession(query,{...options,destination,destinationWarning}),offers=Array.isArray(result?.offers)?result.offers:[],observations=Number.isSafeInteger(result?.received)&&result.received>=0?result.received:offers.length,rejected=Number.isSafeInteger(result?.rejected)&&result.rejected>=0?result.rejected:0;
    return {...(result??{}),query:{...query,destination},sourceResults:result?.sourceResults??[{provider:'Booking.com browser search',status:offers.length?'observed':'no_matching_observation',observations,accepted:offers.length,rejected,...(!offers.length?{reason:'The captured search page yielded no offers accepted by the current property, stay, occupancy, and price checks; this is not a conclusion that the property has no inventory.'}:{})}],coverage:result?.coverage??{scope:'visible_first_page',listingsObserved:observations,accepted:offers.length,rejected,furtherPagesSearched:false,inventoryCompleteness:'partial'}};
  }
  const roomResults=[];
  for(let index=0;index<query.roomAllocations.length;index++){
    signal?.throwIfAborted();const allocation=query.roomAllocations[index],{roomAllocations,...base}=query;
    const roomQuery=validateStay({...base,rooms:1,adults:allocation.adultAges.length,adultAges:[...allocation.adultAges],childrenAges:[...allocation.childrenAges]});
    try{
      const result=await runBookingSession(roomQuery,{...options,destination,destinationWarning,roomIndex:index+1,roomCount:query.rooms,onProgress:progress=>onProgress({...progress,roomIndex:index+1,roomCount:query.rooms})});
      roomResults.push({query:roomQuery,result});
    }catch(error){
      if(signal?.aborted)throw signal.reason??error;
      roomResults.push({query:roomQuery,result:null,error:error.message,sourceStatus:error.sourceStatus,retryAt:error.retryAt});
      break;
    }
    const partial=combinedBookingRooms(query,destination,roomResults);
    onProgress({stage:'searching_hotel_rooms',roomIndex:index+1,roomCount:query.rooms,partialResult:{...partial,query,destination,limitation:`Observed ${index+1} of ${query.rooms} assigned rooms. A combined property price requires a fresh matching observation for every room.`}});
  }
  const combined=combinedBookingRooms(query,destination,roomResults);
  const complete=roomResults.length===query.rooms&&roomResults.every(room=>room.result);
  return {...combined,status:complete?'complete':'partial',query:{...query,destination},limitation:`Each room was searched independently using its exact traveler ages and joined by verified Booking.com property identity and matching stay dates. ${roomResults.length} of ${query.rooms} room searches were attempted; ${combined.coverage.roomSearchesCompleted} returned observations, ${combined.coverage.roomSearchesFailed} failed, and ${combined.coverage.roomSearchesNotAttempted} were not searched. ${combined.coverage.commonPropertyCount} common properties matched. The combined prices are sums of separately observed displayed room prices; simultaneous inventory, room category equivalence, taxes and mandatory charges, and checkout totals remain unverified. Recheck every room on Booking.com.`};
}

export async function searchHotel(input,options={}){
  const query=validateStay(input),selection=query.hotelSource ?? 'booking';
  if(selection==='booking')return searchBookingHotel(query,options);
  const {signal,onProgress=()=>{},resolveDestination=resolveHotelDestination,officialSearch=searchOfficialStays}=options;
  signal?.throwIfAborted();onProgress({stage:'resolving_official_hotel_city'});
  let destination=null,official;
  try{destination=await resolveDestination(query);}
  catch(error){signal?.throwIfAborted();if(error.cityChoices)throw error;official={offers:[],query:{...query,...(destination?{destination}:{})},received:0,rejected:0,sourceResults:[{provider:'Official hotel websites',status:error.sourceStatus||'error',reason:error.message}],limitation:'Official hotel source could not complete this query; no direct price was inferred.'};}
  if(selection==='booking-demand'){
    if(!destination)throw Error('A verified destination city is required for Booking.com Demand API search.');
    signal?.throwIfAborted();onProgress({stage:'searching_booking_demand_api'});
    const demandQuery={airport:query.destinationAirport??destination?.airport,bookerCountry:'ca',checkin:query.checkin,checkout:query.checkout,adults:query.adults,rooms:query.rooms,childrenAges:query.childrenAges,minStars:query.minStars,...(query.adultAges?{adultAges:query.adultAges}:{}),...(query.roomAllocations?{roomAllocations:query.roomAllocations}:{})};
    const booking=await (options.bookingDemandSearch??searchBookingDemand)(demandQuery,{destination,signal,fetcher:options.bookingFetcher,token:options.bookingToken,affiliateId:options.bookingAffiliateId});
    return {...booking,query:{...query,...(destination?{destination}:{})},received:booking.received??booking.providerResults??0,rejected:booking.rejected??0,sourceResults:booking.sourceResults??[{provider:'Booking.com Demand API',status:booking.status,reason:booking.reason}]};
  }
  if(destination){
    try{official=await officialSearch({...query,city:destination.city,cityId:destination.cityId},{destination,signal,onProgress});}
    catch(error){signal?.throwIfAborted();if(error.cityChoices)throw error;official={offers:[],query:{...query,destination},received:0,rejected:0,sourceResults:[{provider:'Official hotel websites',status:error.sourceStatus||'error',reason:error.message}],limitation:'Official hotel source could not complete this query; no direct price was inferred.'};}
  }
  if(selection==='official')return official;
  if(selection==='both'&&!destination)return {...official,sourceResults:[...(official.sourceResults??[]),{provider:'Booking.com browser search',status:'unverified_destination',reason:'The city could not be verified; the browser source was not queried.'}],limitation:'Neither hotel source was queried because the destination city could not be verified.'};
  onProgress({stage:'searching_booking_com',partialResult:official});
  let booking;
  try{booking=await searchBookingHotel(query,{...options,preResolvedDestination:destination,onProgress:progress=>onProgress({...progress,partialResult:official})});}
  catch(error){signal?.throwIfAborted();booking={offers:[],query,received:0,rejected:0,sourceResults:[{provider:'Booking.com',status:error.sourceStatus||'error',reason:error.message,...(error.retryAt?{retryAt:error.retryAt}:{})}]};}
  return {offers:[...official.offers,...booking.offers],query:{...query,...(destination?{destination}:{})},received:(official.received ?? 0)+(booking.received ?? 0),rejected:(official.rejected ?? 0)+(booking.rejected ?? 0),sourceResults:[...(official.sourceResults ?? []),...(booking.sourceResults ?? [{provider:'Booking.com',status:'complete',observations:booking.offers.length}])],discoveryCoverage:official.discoveryCoverage,limitation:'Independent official-site and Booking.com observations. Sources may cover different properties or room/rate conditions; no automatic best-price, member discount or all-in savings claim is made. Recheck each source before booking.'};
}
