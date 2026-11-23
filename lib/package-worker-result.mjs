import {validateVacationQuery} from './vacation-query.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {vacationListingRoomAllocations} from './vacation-room-allocation.mjs';

const exact=(a,b)=>{
 if(Object.is(a,b))return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>exact(value,b[index]));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=Object.keys(a).sort(),other=Object.keys(b).sort();
  return keys.length===other.length&&keys.every((key,index)=>key===other[index]&&exact(a[key],b[key]));
 }
 return false;
};
const normalize=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const validObservedAt=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const displayDate=value=>value.split('-').reverse().join('/');
const amountCents=value=>Number.isFinite(value)&&value>0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6?Math.round(value*100):null;
const adultPaxType=value=>typeof value==='string'&&(/^(adult|adt)$/i.test(value)||/^a$/i.test(value));
const childPaxType=value=>typeof value==='string'&&(/^(child|chd)$/i.test(value)||/^c$/i.test(value));

function providerListingMatches(value,query,structured){
 let url;try{url=new URL(value);}catch{return false;}
 const infants=query.infants?.length??0,ages=[...url.searchParams.entries()].filter(([key])=>/^non_adult\d+$/.test(key)).sort(([a],[b])=>Number(a.slice(9))-Number(b.slice(9))).map(([,age])=>/^\d+$/.test(age)?Number(age):NaN);
 const countValues=['nb_infant','nb_infants','infants'].flatMap(key=>url.searchParams.getAll(key));
 const infantCount=countValues.length===0?0:countValues.length===1&&/^\d+$/.test(countValues[0])?Number(countValues[0]):NaN;
 if(url.origin!=='https://vacations.aircanada.com'||url.pathname!=='/en/packages/product-listing'||url.searchParams.get('departureLocation')!==query.origin||url.searchParams.get('arrivalLocationName')!==query.destinationLabel||url.searchParams.get('departingDateTime')!==displayDate(query.date)||url.searchParams.get('returnDateTime')!==displayDate(query.returnDate)||url.searchParams.get('nb_adult')!==String(query.adults)||url.searchParams.get('numberOfRooms')!==String(query.rooms)||url.searchParams.get('nb_child')!==String(query.childrenAges.length)||infantCount!==infants||ages.length!==query.childrenAges.length||ages.some((age,index)=>age!==query.childrenAges[index]))return false;
 if(structured&&(query.childrenAges.length||query.rooms>1)){
  const allocations=vacationListingRoomAllocations(value,query.rooms);if(!allocations)return false;
  if(allocations.reduce((sum,room)=>sum+room.adults,0)!==query.adults)return false;
  if(query.rooms>1&&allocations.some(room=>room.childrenAges.length))return false;
  if(query.rooms===1&&(allocations[0].adults!==query.adults||!exact(allocations[0].childrenAges,query.childrenAges)))return false;
 }
 return true;
}

function occupancyMatches(evidence,query,sourceUrl,structured){
 const expectedRooms=query.rooms===1?[{adults:query.adults,childrenAges:[...query.childrenAges]}]:structured?vacationListingRoomAllocations(sourceUrl,query.rooms):null;
 return evidence?.status==='listing_parameters_match'&&evidence.adultsRequested===query.adults&&evidence.adultsInListingUrl===query.adults&&evidence.roomsRequested===query.rooms&&evidence.roomsInListingUrl===query.rooms&&exact(evidence.childrenAgesRequested,query.childrenAges)&&exact(evidence.childrenAgesInListingUrl,query.childrenAges)&&evidence.lapInfantsRequested===(query.infants?.length??0)&&evidence.lapInfantsInListingUrl===(query.infants?.length??0)&&evidence.perRoomAllocation===(query.rooms===1?'single_room_request':structured?'provider_listing_verified':'not_exposed_by_widget')&&(!structured||expectedRooms&&exact(evidence.roomAllocations,expectedRooms));
}

function structuredPagesError(result,query,now){
 const coverage=result.coverage,limit=query.maxResults??20,evidence=result.sourceEvidence,request=evidence?.request,response=evidence?.response,offsets=coverage?.pageOffsets,pages=response?.pages;
 if(query.childrenAges.length>3||query.infants?.length||query.childrenAges.length&&query.rooms!==1)return 'structured package coverage does not match the supported one-page party query';
 if(![20,40].includes(limit)||coverage?.resultLimit!==limit||coverage.responseLimit!==20||coverage.responseOffset!==0||!Number.isSafeInteger(coverage.returnedPackages)||coverage.returnedPackages<0||coverage.returnedPackages>limit||!Number.isSafeInteger(coverage.totalAvailable)||coverage.totalAvailable<coverage.returnedPackages||coverage.moreAvailable!==(coverage.totalAvailable>coverage.returnedPackages)||!Array.isArray(offsets)||offsets.length<1||offsets.length>limit/20||offsets.some((offset,index)=>offset!==index*20)||coverage.pagesExpanded!==offsets.length-1||coverage.responsePages!==offsets.length||coverage.listingCardsRendered!==coverage.returnedPackages||!Array.isArray(coverage.pageRanges)||coverage.pageRanges.length!==offsets.length)return 'structured package coverage does not match the requested page budget';
 if(limit===40&&offsets.length===1&&coverage.moreAvailable)return 'structured package coverage is incomplete; the second page was not observed';
 if(evidence?.mode!=='structured_widget_response'||evidence.endpoint!=='https://vacations-api.aircanada.com/packages-search/search'||evidence.method!=='GET'||evidence.status!==200||!Number.isSafeInteger(evidence.responseBytes)||evidence.responseBytes<1||evidence.responseBytes>4_000_000||evidence.currency!=='CAD'||!validObservedAt(evidence.observedAt)||!Array.isArray(evidence.packageLinks)||evidence.packageLinks.length!==result.offers.length||!request||request.origin!==query.origin||request.destination!==query.destinationAirport||typeof request.destinationId!=='string'||!request.destinationId||request.departureDate!==query.date||request.returnDate!==query.returnDate||request.adults!==query.adults||!exact(request.childrenAges,query.childrenAges)||request.rooms!==query.rooms||request.cabin!=='economy'||request.offset!==0||request.limit!==20||!Array.isArray(request.pages)||!exact(request.pages,offsets.map(offset=>({offset,limit:20})))||!response||response.returnedPackages!==coverage.returnedPackages||response.totalAvailable!==coverage.totalAvailable||response.currentStart!==0||result.received!==coverage.returnedPackages||!Array.isArray(pages)||pages.length!==offsets.length)return 'structured request or response evidence does not match the package query';
 const allIds=new Set(),byOffset=new Map();let returned=0,responseBytes=0,lastEnd=null;
 for(let index=0;index<pages.length;index++){
  const page=pages[index],offset=offsets[index],expectedEnd=offset+Math.max(0,(page?.returnedPackages??0)-1);
  if(!page||page.offset!==offset||page.limit!==20||!Number.isSafeInteger(page.returnedPackages)||page.returnedPackages<0||page.returnedPackages>20||!Number.isSafeInteger(page.totalAvailable)||page.totalAvailable!==coverage.totalAvailable||page.totalAvailable<offset+page.returnedPackages||page.currentStart!==offset||page.currentEnd!==expectedEnd||!validObservedAt(page.observedAt)||Date.parse(page.observedAt)>now||!Number.isSafeInteger(page.responseBytes)||page.responseBytes<1||page.responseBytes>2_000_000||!Array.isArray(page.packageIds)||page.packageIds.length!==page.returnedPackages||!exact(coverage.pageRanges[index],{offset,currentStart:offset,currentEnd:expectedEnd}))return 'structured page evidence has an invalid offset, count, timestamp, or result range';
  if(index>0&&(pages[index-1].totalAvailable<=pages[index-1].currentEnd+1||pages[index-1].returnedPackages!==20||page.returnedPackages===0))return 'structured pages do not follow provider-reported available results';
  const pageIds=new Set();
  for(const id of page.packageIds){if(id!==null&&(typeof id!=='string'||!id.trim()||pageIds.has(id)||allIds.has(id)))return 'structured pages contain a duplicate package identity';if(id!==null){pageIds.add(id);allIds.add(id);}}
  byOffset.set(offset,page);returned+=page.returnedPackages;responseBytes+=page.responseBytes;lastEnd=page.currentEnd;
 }
 if(returned!==coverage.returnedPackages||responseBytes!==evidence.responseBytes||response.currentEnd!==lastEnd||evidence.observedAt!==pages.at(-1).observedAt)return 'structured response evidence totals do not reconcile with the page records';
 if(new Set(evidence.packageLinks.map(link=>link.packageId)).size!==evidence.packageLinks.length)return 'structured package evidence contains duplicate package links';
 for(const offer of result.offers){
  const pageOffset=offer?.packageEvidence?.pageOffset,page=byOffset.get(pageOffset),link=evidence.packageLinks.find(item=>item.packageId===offer?.packageEvidence?.responsePackageId);
  if(!page||!link||link.pageOffset!==pageOffset||link.observedAt!==offer.observedAt||page.observedAt!==offer.observedAt||!page.packageIds.includes(offer.packageEvidence.responsePackageId))return 'structured package evidence does not match its observed page';
 }
 return null;
}

/** Validate ACV package observations before the durable worker stores them. */
export function packageWorkerResultError(result,input,now=Date.now()){
 let query;try{query=validateVacationQuery(input);}catch{return 'submitted package query is invalid';}
 if(!result||typeof result!=='object'||!Array.isArray(result.offers))return 'result has no offers list';
 if(result.status!=='observed'&&result.status!=='currency_unverified')return 'result has an unknown provider status';
 if(!result.query||!exact(result.query,query))return 'result query changed the submitted package constraints';
 if(result.status==='currency_unverified')return result.offers.length?'unpriced currency evidence contains package offers':null;
 if(!result.coverage)return 'observed result has no coverage';
 const structured=result.coverage.mode==='structured_widget_response';
 if(result.coverage){
  const coverage=result.coverage,limit=query.maxResults??20;
  if(structured){
   const error=structuredPagesError(result,query,now);if(error)return error;
  }else{
   const planned=Math.min(coverage.visibleCards,limit);
   if(coverage.resultLimit!==limit||coverage.flightPanelLimit!==limit||!Number.isSafeInteger(coverage.visibleCards)||coverage.visibleCards<0||coverage.visibleCards>limit||coverage.flightPanelsAttempted!==planned||coverage.flightPanelsAttempted<0||typeof coverage.moreAvailable!=='boolean'||typeof coverage.pageLoadStopped!=='boolean'||!Number.isSafeInteger(coverage.pagesExpanded)||coverage.pagesExpanded<0||coverage.pagesExpanded>Math.floor(limit/20)-1)return 'result package coverage does not match the selected inspection budget';
  }
 }
 if(!Number.isSafeInteger(result.received)||result.received<0||!Number.isSafeInteger(result.rejected)||result.rejected<0||result.received!==result.offers.length+result.rejected)return 'result offer counts do not reconcile with inspected package cards';
 if(result.offers.length===0)return null;
 if(result.status!=='observed'||!result.query||!result.coverage)return 'priced package offers lack an observed result envelope';
 if(!structured&&result.offers.length>result.coverage.flightPanelsAttempted)return 'result offers exceed inspected package panels';
 const expectedCity=normalize(query.destinationLabel.split(',')[0]);
 for(const offer of result.offers){
  if(!offer||typeof offer!=='object')return 'result contains an invalid package offer';
  if(!offer.query||!exact(offer.query,query))return 'an offer changed the submitted package query';
  if(typeof offer.name!=='string'||!offer.name.trim()||!Number.isFinite(offer.stars)||offer.stars<(query.minStars??4)||offer.stars>5)return 'an offer has invalid property/star evidence';
  const price=amountCents(offer.price);if(price===null||offer.currency!=='CAD')return 'an offer has no positive exact-cent CAD total';
  if(query.maxPrice!==undefined&&price>Math.round(query.maxPrice*100))return 'an offer exceeds the submitted CAD budget';
  if(quoteFreshness(offer,now).status!=='fresh')return 'an offer price observation is stale or invalid';
  if(offer.provider!=='Air Canada Vacations'||offer.source!==(structured?'Air Canada Vacations packages-search/search':'Air Canada Vacations via api-anything')||offer.product!=='supplier-package'||!providerListingMatches(offer.sourceUrl,query,structured))return 'an offer is not tied to the exact Air Canada Vacations listing';
  let currencyEvidence;try{currencyEvidence=new URL(offer.currencyEvidenceUrl);}catch{return 'an offer has no official CAD terms evidence';}
  if(currencyEvidence.origin!=='https://vacations.aircanada.com'||currencyEvidence.pathname!=='/en/terms-conditions')return 'an offer has no official CAD terms evidence';
  if(!occupancyMatches(offer.occupancyEvidence,query,offer.sourceUrl,structured))return 'an offer occupancy evidence does not match the submitted party';
  const city=normalize(String(offer.propertyCity??'').split(',')[0]),dest=offer.destinationMatch;
  const expectedDestinationEvidence=structured?'Structured package hotel destination field and selected provider destination ID':'Hotel card city label';
  if(!expectedCity||!city||city!==expectedCity||dest?.status!=='provider-listed city matches selected destination'||normalize(String(dest.city??'').split(',')[0])!==expectedCity||dest.evidence!==expectedDestinationEvidence)return 'an offer property city does not match the selected destination';
  if(structured){
   const evidence=offer.packageEvidence,stay=offer.hotelStay;
   if(!evidence||!day(evidence.outboundArrivalDate)||!stay||stay.checkIn!==evidence.outboundArrivalDate||stay.checkOut!==query.returnDate)return 'an offer has invalid hotel stay dates';
   const link=result.sourceEvidence.packageLinks.find(item=>item.packageId===evidence.responsePackageId);
   if(typeof evidence.responsePackageId!=='string'||!evidence.responsePackageId||typeof evidence.hotelId!=='string'||!evidence.hotelId||typeof evidence.itineraryId!=='string'||!evidence.itineraryId||!exact(evidence.childrenAges,query.childrenAges)||!exact(evidence.roomAllocations,offer.occupancyEvidence?.roomAllocations)||!Array.isArray(evidence.paxRows)||!evidence.paxRows.length||evidence.paxRows.some(row=>!Number.isSafeInteger(row?.count)||row.count<1||!(adultPaxType(row?.type)||query.childrenAges.length>0&&childPaxType(row?.type)))||evidence.paxRows.filter(row=>adultPaxType(row.type)).reduce((sum,row)=>sum+row.count,0)!==query.adults||evidence.paxRows.filter(row=>childPaxType(row.type)).reduce((sum,row)=>sum+row.count,0)!==query.childrenAges.length||evidence.groupTotalCents!==price||evidence.adultCount!==query.adults||evidence.rooms!==query.rooms||evidence.requestOrigin!==query.origin||evidence.requestDestination!==query.destinationAirport||evidence.requestDestinationId!==result.sourceEvidence.request.destinationId||evidence.departureDate!==query.date||evidence.returnDate!==query.returnDate||!link||link.pageOffset!==evidence.pageOffset||link.observedAt!==offer.observedAt||link.hotelId!==evidence.hotelId||link.itineraryId!==evidence.itineraryId||link.destinationId!==evidence.requestDestinationId||link.totalCents!==evidence.groupTotalCents)return 'an offer has invalid structured package evidence';
  }
  if(query.maxStops!==undefined&&(!Number.isInteger(offer.flightStops?.outbound)||!Number.isInteger(offer.flightStops?.inbound)||offer.flightStops.outbound<0||offer.flightStops.inbound<0||offer.flightStops.outbound>query.maxStops||offer.flightStops.inbound>query.maxStops))return 'an offer does not satisfy the selected flight stop filter';
 }
 return null;
}
