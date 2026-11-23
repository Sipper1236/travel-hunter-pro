import {bookingPropertyKey,normalizeLocation} from './hotel-identity.mjs';
import {fetchSource} from './source-fetch.mjs';
import {getJobStore} from './job-store.mjs';
import {readBoundedSourceJson} from './source-json.mjs';

const API='https://demandapi.booking.com/3.3';
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const today=()=>new Date().toISOString().slice(0,10);
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort((x,y)=>x-y).every((value,index)=>value===[...b].sort((x,y)=>x-y)[index]);
const validAmount=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6;

export function validateHotelSearch(input,now=today()) {
  if (!input || input.airport!==undefined&&!/^[A-Z]{3}$/.test(input.airport || '')) throw new Error('Provide a three-letter destination airport code.');
  if (!date(input.checkin) || !date(input.checkout) || input.checkin >= input.checkout || input.checkin < now || (Date.parse(input.checkout+'T00:00:00Z')-Date.parse(input.checkin+'T00:00:00Z'))/86400000>90 || (Date.parse(input.checkin+'T00:00:00Z')-Date.parse(now+'T00:00:00Z'))/86400000>500) throw new Error('Provide valid future hotel dates within 500 days and a stay of 1 to 90 nights.');
  if (!Number.isInteger(input.adults) || input.adults < 1 || input.adults > 30 || !Number.isInteger(input.rooms) || input.rooms < 1 || input.rooms > input.adults) throw new Error('Provide a valid adult and room count.');
  if (!Array.isArray(input.childrenAges) || input.childrenAges.length > 20 || input.childrenAges.some(age => !Number.isInteger(age) || age < 0 || age > 17)) throw new Error('Provide the actual age of every child.');
  if(input.minStars!==undefined&&![4,5].includes(input.minStars))throw new Error('Booking.com searches require a minimum of 4 or 5 stars.');
  if (typeof input.bookerCountry !== 'string' || !/^[a-z]{2}$/.test(input.bookerCountry)) throw new Error('Provide the booker country as a two-letter lowercase code.');
  let allocation;
  if (input.roomAllocations !== undefined) {
    if (!Array.isArray(input.roomAllocations) || input.roomAllocations.length !== input.rooms || input.roomAllocations.some(room => !room || !Array.isArray(room.adultAges) || !room.adultAges.length || room.adultAges.some(age => !Number.isInteger(age) || age < 18 || age > 120) || !Array.isArray(room.childrenAges) || room.childrenAges.some(age => !Number.isInteger(age) || age < 0 || age > 17))) {
      throw new Error('Enter the actual adult and child ages for each room, with at least one adult in every room.');
    }
    const adults = input.roomAllocations.flatMap(room => room.adultAges);
    const children = input.roomAllocations.flatMap(room => room.childrenAges);
    if (!same(adults,input.adultAges??adults) || adults.length!==input.adults || !same(children,input.childrenAges)) throw new Error('Room allocations must assign every entered adult and child age exactly once.');
    allocation = input.roomAllocations.map(room => ({number_of_adults:room.adultAges.length,children:[...room.childrenAges]}));
  } else if (input.rooms > 1) {
    throw new Error('Provide an exact adult and child allocation for every room when searching multiple rooms.');
  }
  if(input.adultAges!==undefined&&(!Array.isArray(input.adultAges)||input.adultAges.length!==input.adults||input.adultAges.some(age=>!Number.isInteger(age)||age<18||age>120)))throw new Error('Provide the actual age of every adult.');
  return { ...(input.airport?{airport:input.airport}:{}), booker:{country:input.bookerCountry,platform:'desktop'}, checkin:input.checkin, checkout:input.checkout, currency:'CAD', guests:{number_of_adults:input.adults,number_of_rooms:input.rooms,children:[...input.childrenAges],...(allocation?{allocation}:{})}, extras:['extra_charges','products'], rows:30, rating:{stars:input.minStars===5?[5]:[4,5]} };
}

const apiHeaders=(token,affiliateId)=>({'Authorization':`Bearer ${token}`,'X-Affiliate-Id':affiliateId,'Content-Type':'application/json'});
async function post(path,body,{token,affiliateId,fetcher,signal,policy,sleep}){
  let response;
  try{response=await fetchSource('Booking.com Demand API',`${API}/${path}`,{method:'POST',headers:apiHeaders(token,affiliateId),body:JSON.stringify(body),...(signal?{signal}:{})},{fetcher,policy,sleep,timeoutMs:20000,retrySafe:false});}
  catch(error){if(signal?.aborted)throw signal.reason??error;const status=error?.sourceStatus??error?.status??'error';return {error:{status,reason:status==='rate_limited'?'Booking.com is rate-limiting requests.':status==='blocked'||status==='auth'||status==='access_denied'?'Booking.com denied this request.':status==='invalid_response'?'Booking.com returned an oversized or invalid response.':'Booking.com request failed or timed out.',...(error?.retryAt?{retryAt:new Date(error.retryAt).toISOString()}:{})}};}
  if(!response.ok)return {error:{status:response.status===401||response.status===403?'access_denied':response.status===429?'rate_limited':'error',reason:`Booking.com returned HTTP ${response.status}.`}};
  let data;try{data=await readBoundedSourceJson(response,{provider:'Booking.com Demand API',maxBytes:2_000_000});}catch{return {error:{status:'invalid_response',reason:'Booking.com returned an oversized or invalid response.'}};}
  if(!data||!Array.isArray(data.data))return {error:{status:'error',reason:'Booking.com returned an unexpected response.'}};
  return {data};
}
function cityIdFromAutocomplete(data,destination){
  const matches=data.filter(item=>item?.type==='city'&&Number.isSafeInteger(item.id)&&normalizeLocation(item.name)===normalizeLocation(destination.city));
  if(matches.length!==1)return null;
  return matches[0].id;
}
function bookingUrl(value,query){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.hostname!=='www.booking.com'||url.username||url.password||!/^\/hotel\/[a-z]{2}\/[a-z0-9-]+(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html$/i.test(url.pathname)||!bookingPropertyKey(url.toString()))return null;
    url.search=new URLSearchParams({checkin:query.checkin,checkout:query.checkout,group_adults:String(query.adults),no_rooms:String(query.rooms),group_children:String(query.childrenAges.length),selected_currency:'CAD'}).toString();
    for(const age of query.childrenAges)url.searchParams.append('age',String(age));
    return url.toString();
  }catch{return null;}
}
const localName=value=>typeof value==='string'?value:typeof value==='object'&&value?value['en-ca']||value['en-gb']||value['en-us']||Object.values(value).find(item=>typeof item==='string')||null:null;
function allocationMatches(products,query){
  if(!Array.isArray(products)||products.length!==query.rooms)return false;
  const requested=query.guests.allocation?.map(room=>({adults:room.number_of_adults,children:room.children}));
  if(!requested){return query.rooms===1&&products.length===1&&products[0].number_of_adults===query.adults&&same(products[0].children??[],query.childrenAges);}
  const observed=products.map(product=>({adults:product.number_of_adults,children:product.children}));
  const signature=room=>`${room.adults}:${[...room.children].sort((a,b)=>a-b).join(',')}`;
  return observed.every(room=>Number.isInteger(room.adults)&&Array.isArray(room.children))&&JSON.stringify(requested.map(signature).sort())===JSON.stringify(observed.map(signature).sort());
}
function extraChargeText(price,products=[]){
  const charges=price?.extra_charges;
  if(!charges||typeof charges!=='object'||Array.isArray(charges))return null;
  const amount=(value)=>typeof value==='number'&&Number.isFinite(value)?value:Array.isArray(value)?value.reduce((sum,item)=>sum+(typeof item?.total_amount==='number'?item.total_amount:NaN),0):null;
  const chargeDetails=(category,value)=>{
    if(typeof value==='number'&&Number.isFinite(value))return `${category} aggregate: CAD ${value.toFixed(2)} (charge types not supplied).`;
    if(!Array.isArray(value))return `${category} charge details were not supplied.`;
    if(!value.length)return `${category}: none reported.`;
    const entries=value.map(item=>{
      const id=Number.isInteger(item?.charge)?`charge ID ${item.charge}`:'charge ID unavailable';
      const mode=typeof item?.mode==='string'?`, ${item.mode.replaceAll('_',' ')}`:'';
      const condition=category==='Conditional'&&Number.isInteger(item?.condition)?`, condition ${item.condition}`:'';
      const total=typeof item?.total_amount==='number'&&Number.isFinite(item.total_amount)?`CAD ${item.total_amount.toFixed(2)}`:'amount unavailable';
      const unit=typeof item?.unit_amount==='number'&&Number.isFinite(item.unit_amount)?` (unit amount CAD ${item.unit_amount.toFixed(2)})`:'';
      const online=typeof item?.chargeable_online==='boolean'?`; provider marks chargeable online ${item.chargeable_online?'yes':'no'}`:'';
      return `${id}${mode}${condition}: ${total}${unit}${online}`;
    });
    return `${category}: ${entries.join('; ')}.`;
  };
  const conditionalAmount=value=>{
    if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return value;
    if(!Array.isArray(value))return null;
    let total=0;
    for(const item of value){if(!Number.isFinite(item?.total_amount)||item.total_amount<0)return null;total+=item.total_amount;}
    return Number.isFinite(total)?total:null;
  };
  const included=amount(charges.included),excluded=amount(charges.excluded);
  let conditional=charges.conditional===undefined?null:conditionalAmount(charges.conditional);
  if(charges.conditional===undefined&&products.length&&products.every(product=>Array.isArray(product?.price?.extra_charges?.conditional))){
    const perProduct=products.map(product=>conditionalAmount(product.price.extra_charges.conditional));
    if(perProduct.every(Number.isFinite))conditional=perProduct.reduce((sum,value)=>sum+value,0);
  }
  if([included,excluded].some(value=>value===null||!Number.isFinite(value)))return null;
  const conditionalText=conditional===null?'Conditional or incalculable charges may apply; this response did not provide their complete amounts.':conditional>0?`Conditional charges totalling CAD ${conditional.toFixed(2)} may apply, depending on their stated conditions.`:'No conditional charges were listed in the search response; recheck property charges before booking.';
  const productsExposeConditional=products.length>0&&products.every(product=>Array.isArray(product?.price?.extra_charges?.conditional));
  const conditionalDetails=charges.conditional===undefined?(productsExposeConditional?products.flatMap(product=>product.price.extra_charges.conditional):null):charges.conditional;
  return `Booking.com display price: CAD ${price.book.toFixed(2)}; expected total: CAD ${price.total.toFixed(2)} (included charges CAD ${included.toFixed(2)}, excluded/non-conditional charges CAD ${excluded.toFixed(2)}). ${chargeDetails('Included',charges.included)} ${chargeDetails('Excluded',charges.excluded)} ${chargeDetails('Conditional',conditionalDetails)} ${conditionalText}`;
}
function cancellationText(products){
  const policies=products.map(product=>product?.policies?.cancellation);
  if(!policies.length||policies.some(policy=>!policy?.type))return null;
  const values=policies.map(policy=>`${policy.type}:${policy.free_cancellation_until??''}`);
  if(new Set(values).size!==1)return 'Cancellation terms vary by room or rate; review the selected products on Booking.com.';
  const policy=policies[0];
  if(policy.free_cancellation_until)return `Free cancellation until ${policy.free_cancellation_until} (Booking.com search observation).`;
  return policy.type==='non_refundable'?'Non-refundable rate (Booking.com search observation).':'Cancellation policy: '+policy.type.replaceAll('_',' ')+' (confirm on Booking.com).';
}
function normalizeOffer(row,detail,query,destination,observedAt){
  if(!detail||detail.id!==row.id||detail.accommodation_status&&detail.accommodation_status!=='open')return null;
  const propertyCity=detail.location?.city,propertyCountry=String(detail.location?.country||'').toLowerCase();
  if(propertyCity!==destination.bookingCityId||propertyCountry!==destination.countryCode.toLowerCase())return null;
  const name=localName(detail.name),stars=detail.rating?.stars,starsType=detail.rating?.stars_type;
  if(!name||!Number.isInteger(stars)||stars<(query.minStars??4)||stars>5||starsType!=='official')return null;
  const url=bookingUrl(detail.url?.web||detail.url||row.url,query);
  if(!url)return null;
  if(row.currency!=='CAD'||!validAmount(row.price?.book)||!validAmount(row.price?.total)||row.price.total<row.price.book)return null;
  if(!extraChargeText(row.price,row.products))return null;
  if(!allocationMatches(row.products,query))return null;
  const productTotals=row.products.map(product=>product.price?.total),productTotalsCents=productTotals.map(value=>Math.round(value*100)),expectedTotalCents=Math.round(row.price.total*100),productSumCents=productTotalsCents.reduce((sum,value)=>sum+value,0);
  if(productTotals.some(value=>!validAmount(value))||Math.abs(productSumCents-expectedTotalCents)>1)return null;
  const nights=(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000;
  const propertyKey=bookingPropertyKey(url);
  if(!propertyKey)return null;
  const stay={checkin:query.checkin,checkout:query.checkout,nights,rooms:query.rooms,adults:query.adults,childrenAges:[...query.childrenAges],...(query.adultAges?{adultAges:[...query.adultAges]}:{}),...(query.roomAllocations?{roomAllocations:query.roomAllocations.map(room=>({adultAges:[...room.adultAges],childrenAges:[...room.childrenAges]}))}:{})};
  const occupancyEvidence={status:'provider_product_allocation_match',roomsRequested:query.rooms,requestedRoomAllocations:(query.roomAllocations??[{adultAges:query.adultAges??[],childrenAges:query.childrenAges}]).map(room=>({adultAges:[...room.adultAges],childrenAges:[...room.childrenAges]})),observedRoomProducts:row.products.map(product=>({adults:product.number_of_adults,childrenAges:[...product.children]})),adultCountsEchoed:true,adultAgesEchoed:false,childAgesEchoed:true,productsMatchedRequestedAllocations:true,productTotalsCents,expectedTotalCents,productTotalsMatchExpectedTotal:productSumCents===expectedTotalCents,expectedTotalIncludesNonConditionalCharges:true};
  return {name,stars,starRatingType:starsType,priceText:`CAD ${row.price.total.toFixed(2)}`,displayPriceText:`CAD ${row.price.book.toFixed(2)}`,taxText:extraChargeText(row.price,row.products),stayText:`${nights} nights · ${query.rooms} room${query.rooms===1?'':'s'} · ${query.adults} adults${query.childrenAges.length?` · ${query.childrenAges.length} children/youths`:''}`,stay,occupancyEvidence,cancellationText:cancellationText(row.products),bookingStatus:'Booking.com Demand API returned matching room products and an expected-total observation in one search response. Seller recheck required; conditional charges may apply. No booking was made.',url,observedAt,source:'Booking.com Demand API',provider:'booking',currency:'CAD',locationEvidence:{status:'verified',city:destination.city,countryCode:destination.countryCode,cityId:destination.cityId,bookingCityId:destination.bookingCityId,airport:destination.airport??query.airport,hotelName:name,propertyKey,sourceUrl:url,cityUrl:destination.cityUrl,observedAt,method:'Booking.com Demand API property details returned the selected Booking.com city ID and country'}};
}

export async function searchBooking(input,{token=process.env.BOOKING_API_TOKEN,affiliateId=process.env.BOOKING_AFFILIATE_ID,fetcher=fetch,destination:providedDestination,now=Date.now(),signal,policy,sleep}={}){
  const request=validateHotelSearch(input);
  if(!token||!affiliateId||!/^[1-9]\d*$/.test(String(affiliateId)))return {status:'unavailable',source:'Booking.com Demand API',reason:'Booking.com partner access is not configured.',offers:[]};
  const destination=providedDestination;
  if(!destination||typeof destination.city!=='string'||!destination.city||!/^[A-Z]{2}$/.test(destination.countryCode||''))return {status:'incomplete',source:'Booking.com Demand API',reason:'A verified city and country are required before matching Booking.com inventory.',offers:[]};
  const requestOptions={token,affiliateId,fetcher,signal,policy:policy??(fetcher===fetch?getJobStore():undefined),sleep};
  const autocomplete=await post('common/autocomplete',{query:destination.city,country:destination.countryCode.toLowerCase(),language:'en-ca',filters:{types:['city']}},requestOptions);
  if(autocomplete.error)return {status:autocomplete.error.status,source:'Booking.com Demand API',reason:autocomplete.error.reason,...(autocomplete.error.retryAt?{retryAt:autocomplete.error.retryAt}:{}),offers:[]};
  const bookingCityId=cityIdFromAutocomplete(autocomplete.data.data,destination);
  if(bookingCityId===null)return {status:'incomplete',source:'Booking.com Demand API',reason:'Booking.com did not return one exact city match in the verified country; no destination ID was guessed.',offers:[]};
  const resolved={...destination,bookingCityId};
  const {airport:_airport,...cityRequest}=request;
  const search=await post('accommodations/search',{...cityRequest,city:bookingCityId},requestOptions);
  if(search.error)return {status:search.error.status,source:'Booking.com Demand API',reason:search.error.reason,...(search.error.retryAt?{retryAt:search.error.retryAt}:{}),offers:[]};
  const rows=search.data.data.filter(row=>Number.isSafeInteger(row?.id)).slice(0,30);
  if(!rows.length)return {status:'complete',source:'Booking.com Demand API',reason:'No candidate properties were returned for this exact request.',providerResults:0,offers:[],coverage:{limit:30,moreAvailable:Boolean(search.data.metadata?.next_page)}};
  const details=await post('accommodations/details',{accommodations:rows.map(row=>row.id),extras:['policies'],languages:['en-ca']},requestOptions);
  if(details.error)return {status:details.error.status,source:'Booking.com Demand API',reason:`Search observed ${rows.length} properties, but property details could not be verified: ${details.error.reason}`,...(details.error.retryAt?{retryAt:details.error.retryAt}:{}),providerResults:rows.length,offers:[]};
  const detailsById=new Map(details.data.data.map(item=>[item?.id,item]));
  const observedAt=new Date(now).toISOString();
  const offers=rows.map(row=>normalizeOffer(row,detailsById.get(row.id),{...input,guests:request.guests},resolved,observedAt)).filter(Boolean);
  return {status:'complete',source:'Booking.com Demand API',offers,received:rows.length,rejected:rows.length-offers.length,query:{...input,destination:resolved},sourceResults:[{provider:'Booking.com Demand API',status:'observed',requestCount:3,propertiesReceived:rows.length,accepted:offers.length,rejected:rows.length-offers.length}],coverage:{limit:30,moreAvailable:Boolean(search.data.metadata?.next_page)},limitation:'Booking.com Demand API search observation. Booking.com may return partial inventory; this page checked at most 30 properties and did not follow pagination. Candidates missing exact destination/property/star/room/product/price/charge evidence were withheld. Prices are current observations, not seller-verified or final; recheck the selected room, conditions and expected total on Booking.com before booking. Conditional charges may apply.'};
}
