import {discoverOfficialHotels,inspectOfficialHotel,readOfficialWebsite} from './official-hotels.mjs';
import {searchReservit} from './reservit.mjs';
import {sourceFailure,SOURCE_STOP_STATUSES} from './source-errors.mjs';

export async function searchOfficialStays(query,{destination,signal,onProgress=()=>{},discover=discoverOfficialHotels,read=readOfficialWebsite,quote=searchReservit}={}){
  if(!destination)throw Error('A verified city/country is required for official hotel searches.');
  const input={...query,destination},offers=[],sourceResults=[];
  if(query.rooms!==1&&!query.roomAllocations)return {offers:[],query:input,received:0,rejected:0,sourceResults:[{provider:'Official hotel / Reservit',status:'unsupported',reason:'Enter a validated allocation for every room.'}],limitation:'No official rates were requested without room allocations.'};
  const listing=query.officialUrl?{candidates:[{website:query.officialUrl}],coverage:{source:'User-selected property website',discovered:1,checkedLimit:1}}:await discover(destination,{limit:query.officialLimit ?? 5,signal});
  const summarize=()=>({offers:[...offers],query:input,received:sourceResults.length,rejected:sourceResults.filter(row=>!['observed','no_matching_observation'].includes(row.status)).length,sourceResults:[...sourceResults],discoveryCoverage:listing.coverage,limitation:'Official-site observations from supported Reservit booking links only. Directory candidates and search limits are disclosed; unsupported websites are not priced. Direct totals may exclude taxes and do not identify a specific room/rate. Recheck prices, occupancy, cancellation terms and final availability on the property booking page.'});
  for(const candidate of listing.candidates){
    signal?.throwIfAborted();onProgress({stage:'checking_official_hotel_sites',hotelsChecked:sourceResults.length,hotelsPlanned:listing.candidates.length});
    try{
      const response=await read(candidate.website,{signal}),html=await response.text();signal?.throwIfAborted();
      const property=inspectOfficialHotel(html,{pageUrl:response.url || candidate.website,candidate,destination,minStars:query.minStars});
      const result=await quote(input,property,{signal});signal?.throwIfAborted();offers.push(...result.offers);sourceResults.push({provider:'Official hotel / Reservit',name:property.name,status:result.status,observations:result.offers.length,rateRequests:result.requests});
    }catch(error){
      signal?.throwIfAborted();const failure=sourceFailure('Official hotel website',error);sourceResults.push({...failure,name:candidate.name ?? new URL(candidate.website).hostname});
      if(SOURCE_STOP_STATUSES.includes(failure.status))break;
    }
    onProgress({stage:'checking_official_hotel_sites',hotelsChecked:sourceResults.length,hotelsPlanned:listing.candidates.length,partialResult:summarize()});
  }
  return summarize();
}
