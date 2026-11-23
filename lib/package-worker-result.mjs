import {validateVacationQuery} from './vacation-query.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

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

function providerListingMatches(value,query){
 let url;try{url=new URL(value);}catch{return false;}
 const infants=query.infants?.length??0,ages=[...url.searchParams.entries()].filter(([key])=>/^non_adult\d+$/.test(key)).sort(([a],[b])=>Number(a.slice(9))-Number(b.slice(9))).map(([,age])=>/^\d+$/.test(age)?Number(age):NaN);
 const countValues=['nb_infant','nb_infants','infants'].flatMap(key=>url.searchParams.getAll(key));
 const infantCount=countValues.length===0?0:countValues.length===1&&/^\d+$/.test(countValues[0])?Number(countValues[0]):NaN;
 if(url.origin!=='https://vacations.aircanada.com'||url.pathname!=='/en/packages/product-listing'||url.searchParams.get('departureLocation')!==query.origin||url.searchParams.get('arrivalLocationName')!==query.destinationLabel||url.searchParams.get('departingDateTime')!==displayDate(query.date)||url.searchParams.get('returnDateTime')!==displayDate(query.returnDate)||url.searchParams.get('nb_adult')!==String(query.adults)||url.searchParams.get('numberOfRooms')!==String(query.rooms)||url.searchParams.get('nb_child')!==String(query.childrenAges.length)||infantCount!==infants||ages.length!==query.childrenAges.length||ages.some((age,index)=>age!==query.childrenAges[index]))return false;
 if(query.childrenAges.length){
  const room=url.searchParams.get('r0');if(!room)return false;
  let adults=0;const children=[];
  for(const part of room.split(',')){const match=/^(\d+)-(adult|child)-(\d+)$/.exec(part);if(!match)return false;const count=Number(match[1]),age=Number(match[3]);if(count<1)return false;if(match[2]==='adult'){if(age!==0)return false;adults+=count;}else{if(age<2||age>17)return false;for(let index=0;index<count;index++)children.push(age);}}
  if(adults!==query.adults||!exact(children,query.childrenAges))return false;
 }
 return true;
}

function occupancyMatches(evidence,query){
 return evidence?.status==='listing_parameters_match'&&evidence.adultsRequested===query.adults&&evidence.adultsInListingUrl===query.adults&&evidence.roomsRequested===query.rooms&&evidence.roomsInListingUrl===query.rooms&&exact(evidence.childrenAgesRequested,query.childrenAges)&&exact(evidence.childrenAgesInListingUrl,query.childrenAges)&&evidence.lapInfantsRequested===(query.infants?.length??0)&&evidence.lapInfantsInListingUrl===(query.infants?.length??0)&&evidence.perRoomAllocation===(query.rooms===1?'single_room_request':'not_exposed_by_widget');
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
   if(query.childrenAges.length>1||query.infants?.length||query.childrenAges.length&&query.rooms!==1||limit!==20||coverage.resultLimit!==20||coverage.responseLimit!==20||coverage.responseOffset!==0||!Number.isSafeInteger(coverage.returnedPackages)||coverage.returnedPackages<0||coverage.returnedPackages>20||!Number.isSafeInteger(coverage.totalAvailable)||coverage.totalAvailable<coverage.returnedPackages||coverage.moreAvailable!==(coverage.totalAvailable>coverage.returnedPackages)||coverage.pagesExpanded!==0)return 'structured package coverage does not match the supported one-page party query';
   const evidence=result.sourceEvidence,request=evidence?.request,response=evidence?.response;
   if(evidence?.mode!=='structured_widget_response'||evidence.endpoint!=='https://vacations-api.aircanada.com/packages-search/search'||evidence.method!=='GET'||evidence.status!==200||!Number.isSafeInteger(evidence.responseBytes)||evidence.responseBytes<1||evidence.responseBytes>2_000_000||evidence.currency!=='CAD'||!validObservedAt(evidence.observedAt)||!Array.isArray(evidence.packageLinks)||evidence.packageLinks.length!==result.offers.length||new Set(evidence.packageLinks.map(link=>link.packageId)).size!==evidence.packageLinks.length||!request||request.origin!==query.origin||request.destination!==query.destinationAirport||typeof request.destinationId!=='string'||!request.destinationId||request.departureDate!==query.date||request.returnDate!==query.returnDate||request.adults!==query.adults||!exact(request.childrenAges,query.childrenAges)||request.rooms!==query.rooms||request.cabin!=='economy'||request.offset!==0||request.limit!==20||!response||response.returnedPackages!==coverage.returnedPackages||response.totalAvailable!==coverage.totalAvailable||result.received!==coverage.returnedPackages)return 'structured request or response evidence does not match the package query';
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
  if(offer.provider!=='Air Canada Vacations'||offer.source!==(structured?'Air Canada Vacations packages-search/search':'Air Canada Vacations via api-anything')||offer.product!=='supplier-package'||!providerListingMatches(offer.sourceUrl,query))return 'an offer is not tied to the exact Air Canada Vacations listing';
  let currencyEvidence;try{currencyEvidence=new URL(offer.currencyEvidenceUrl);}catch{return 'an offer has no official CAD terms evidence';}
  if(currencyEvidence.origin!=='https://vacations.aircanada.com'||currencyEvidence.pathname!=='/en/terms-conditions')return 'an offer has no official CAD terms evidence';
  if(!occupancyMatches(offer.occupancyEvidence,query))return 'an offer occupancy evidence does not match the submitted party';
  const city=normalize(String(offer.propertyCity??'').split(',')[0]),dest=offer.destinationMatch;
  const expectedDestinationEvidence=structured?'Structured package hotel destination field and selected provider destination ID':'Hotel card city label';
  if(!expectedCity||!city||city!==expectedCity||dest?.status!=='provider-listed city matches selected destination'||normalize(String(dest.city??'').split(',')[0])!==expectedCity||dest.evidence!==expectedDestinationEvidence)return 'an offer property city does not match the selected destination';
  if(structured){
   const evidence=offer.packageEvidence,stay=offer.hotelStay;
   if(!evidence||!day(evidence.outboundArrivalDate)||!stay||stay.checkIn!==evidence.outboundArrivalDate||stay.checkOut!==query.returnDate)return 'an offer has invalid hotel stay dates';
   const link=result.sourceEvidence.packageLinks.find(item=>item.packageId===evidence.responsePackageId);
   if(typeof evidence.responsePackageId!=='string'||!evidence.responsePackageId||typeof evidence.hotelId!=='string'||!evidence.hotelId||typeof evidence.itineraryId!=='string'||!evidence.itineraryId||!exact(evidence.childrenAges,query.childrenAges)||!Array.isArray(evidence.paxRows)||!evidence.paxRows.length||evidence.paxRows.some(row=>!Number.isSafeInteger(row?.count)||row.count<1||!(adultPaxType(row?.type)||query.childrenAges.length===1&&childPaxType(row?.type)))||evidence.paxRows.filter(row=>adultPaxType(row.type)).reduce((sum,row)=>sum+row.count,0)!==query.adults||evidence.paxRows.filter(row=>childPaxType(row.type)).reduce((sum,row)=>sum+row.count,0)!==query.childrenAges.length||evidence.groupTotalCents!==price||evidence.adultCount!==query.adults||evidence.rooms!==query.rooms||evidence.requestOrigin!==query.origin||evidence.requestDestination!==query.destinationAirport||evidence.requestDestinationId!==result.sourceEvidence.request.destinationId||evidence.departureDate!==query.date||evidence.returnDate!==query.returnDate||!link||link.hotelId!==evidence.hotelId||link.itineraryId!==evidence.itineraryId||link.destinationId!==evidence.requestDestinationId||link.totalCents!==evidence.groupTotalCents||offer.observedAt!==result.sourceEvidence.observedAt)return 'an offer has invalid structured package evidence';
  }
  if(query.maxStops!==undefined&&(!Number.isInteger(offer.flightStops?.outbound)||!Number.isInteger(offer.flightStops?.inbound)||offer.flightStops.outbound<0||offer.flightStops.inbound<0||offer.flightStops.outbound>query.maxStops||offer.flightStops.inbound>query.maxStops))return 'an offer does not satisfy the selected flight stop filter';
 }
 return null;
}
