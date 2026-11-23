import {call,saveSite} from 'api-anything';
import {parse} from 'node-html-parser';
import {join} from 'node:path';
// Dedicated app state: no personal browser cookies or catalog publishing.
process.env.API_ANYTHING_HOME=process.env.TRAVEL_API_ANYTHING_HOME||join(process.cwd(),'.cache','api-anything');
const name='travel-hunter-booking';
export function validateStay(q){
 if(!q||typeof q.city!=='string'||!/^\p{L}[\p{L}\p{M} .,'-]{1,79}$/u.test(q.city.trim()))throw Error('Enter a city name.');
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(q.checkin)||!valid(q.checkout)||q.checkin<new Date().toISOString().slice(0,10)||q.checkout<=q.checkin||(Date.parse(q.checkout)-Date.parse(q.checkin))/86400000>90)throw Error('Enter valid stay dates, up to 90 nights.');
 const rooms=q.rooms??1;const childrenAges=q.childrenAges??[];
 if(!Number.isInteger(rooms)||rooms<1||rooms>9)throw Error('Enter 1 to 9 rooms.');
 if(!Array.isArray(childrenAges)||childrenAges.length>8||childrenAges.some(age=>!Number.isInteger(age)||age<0||age>17))throw Error('Supply each child’s actual age, from 0 to 17.');
 if(rooms>1&&!q.roomAllocations)throw Error('Provide exact room allocations for every traveler when searching multiple rooms.');
 if(!Number.isInteger(q.adults)||q.adults<1||q.adults>9)throw Error('Enter 1 to 9 adults. Actual child ages are required.');
 const minStars=q.minStars??4;if(![4,5].includes(minStars))throw Error('Choose a minimum of 4 or 5 stars.');
 if(q.hotelSource!==undefined&&!['booking','booking-demand','official','both'].includes(q.hotelSource))throw Error('Choose Booking.com, Booking.com Demand API, official hotel websites or both.');
 if(q.adultAges!==undefined&&(!Array.isArray(q.adultAges)||q.adultAges.length!==q.adults||q.adultAges.some(age=>!Number.isInteger(age)||age<18||age>120)))throw Error('Enter one actual age from 18 to 120 for every adult.');
 if(['official','both'].includes(q.hotelSource)&&!q.adultAges)throw Error('Official hotel rates require each adult’s actual age.');
 if(q.roomAllocations!==undefined){
  if(!Array.isArray(q.roomAllocations)||q.roomAllocations.length!==rooms||q.roomAllocations.some(room=>!room||!Array.isArray(room.adultAges)||!room.adultAges.length||room.adultAges.some(age=>!Number.isInteger(age)||age<18||age>120)||!Array.isArray(room.childrenAges)||room.childrenAges.some(age=>!Number.isInteger(age)||age<0||age>17)))throw Error('Enter the actual adult and child ages for each room, with at least one adult in every room.');
  const same=(a,b)=>JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y));
  if(!q.adultAges||!same(q.roomAllocations.flatMap(room=>room.adultAges),q.adultAges)||!same(q.roomAllocations.flatMap(room=>room.childrenAges),childrenAges))throw Error('Room allocations must include every traveler exactly once and match the entered ages.');
 }
 if(q.officialLimit!==undefined&&(!Number.isInteger(q.officialLimit)||q.officialLimit<1||q.officialLimit>10))throw Error('Check between 1 and 10 official hotel websites.');
 if(q.officialUrl!==undefined){try{const url=new URL(q.officialUrl);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||q.officialUrl.length>500)throw Error();}catch{throw Error('Enter a public HTTPS property website.');}}
 if(q.destinationAirport!==undefined&&!/^[A-Z]{3}$/.test(q.destinationAirport))throw Error('Select a valid flight arrival airport.');
 if(q.cityId!==undefined&&(typeof q.cityId!=='string'||!/^Q[1-9]\d*$/.test(q.cityId)))throw Error('Select a valid hotel city.');
 return {city:q.city.trim(),checkin:q.checkin,checkout:q.checkout,adults:q.adults,rooms,childrenAges,minStars,...(q.roomAllocations?{roomAllocations:q.roomAllocations.map(room=>({adultAges:[...room.adultAges],childrenAges:[...room.childrenAges]}))}:{}),...(q.destinationAirport?{destinationAirport:q.destinationAirport}:{}),...(q.cityId?{cityId:q.cityId}:{}),...(q.hotelSource?{hotelSource:q.hotelSource}:{}),...(q.adultAges?{adultAges:[...q.adultAges]}:{}),...(q.officialLimit?{officialLimit:q.officialLimit}:{}),...(q.officialUrl?{officialUrl:q.officialUrl}:{})};
}
export function stayUrl(q){const url=new URL('https://www.booking.com/searchresults.en-us.html');url.search=new URLSearchParams({ss:q.city,checkin:q.checkin,checkout:q.checkout,group_adults:String(q.adults),no_rooms:String(q.rooms??1),group_children:String((q.childrenAges??[]).length),selected_currency:'CAD',nflt:q.minStars===5?'class=5':'class=4;class=5'}).toString();for(const age of q.childrenAges??[])url.searchParams.append('age',String(age));return url.toString();}
export async function extractStays(html,query){
 const url=stayUrl(query);const doc=parse(html);
 for(const card of doc.querySelectorAll('[data-testid="property-card"]'))card.setAttribute('data-observed-stars',String(card.querySelector('[data-testid="rating-stars"]')?.childNodes.filter(n=>n.tagName==='SPAN').length||0));
 saveSite({name,displayName:'Booking.com captured search',baseUrl:'https://www.booking.com',operations:[{name:'extractSearch',readOnly:true,minTier:1,params:[],slots:[],volatile:[],request:{method:'GET',url,headers:{}},trigger:{url},response:{format:'html',html:{items:'[data-testid="property-card"]',fields:{name:'[data-testid="title"]',priceText:'[data-testid="price-and-discounted-price"]',taxText:'[data-testid="taxes-and-charges"]',cancellationText:'[data-testid="cancellation-policy"]',stayText:'[data-testid="price-for-x-nights"]',url:'[data-testid="title-link"]@href',stars:'@data-observed-stars'}}}}]});
 const result=await call(name,'extractSearch',{}, {maxTier:1,fetchImpl:async()=>new Response(doc.toString(),{status:200,headers:{'Content-Type':'text/html'}})});
 if(!result.ok||!Array.isArray(result.data))throw Error('The Booking.com result format could not be verified.');
 const nights=(Date.parse(query.checkout)-Date.parse(query.checkin))/86400000;
 const occupancyEvidence=r=>{
   const text=r.stayText||'',children=query.childrenAges??[],rooms=query.rooms??1;
   const adultsMatched=new RegExp(`\\b${query.adults} adults?\\b`).test(text),nightsMatched=new RegExp(`\\b${nights} nights?\\b`).test(text);
   const childrenCountMatched=!children.length||new RegExp(`\\b${children.length} (?:children|child)\\b`).test(text),roomsMatched=rooms===1||new RegExp(`\\b${rooms} rooms?\\b`).test(text);
   return adultsMatched&&nightsMatched&&childrenCountMatched&&roomsMatched?{status:'provider_count_match',adultsMatched,nightsMatched,childrenCountMatched,roomsMatched,individualAgesEchoed:false}:null;
 };
 const offers=result.data.filter(r=>occupancyEvidence(r) && r.name && /CAD\s*[\d,]+/.test(r.priceText||'') && [4,5].includes(Number(r.stars)) && Number(r.stars)>=(query.minStars??4)).flatMap(r=>{
   let link;try{link=new URL(r.url);if(link.protocol!=='https:'||link.hostname!=='www.booking.com'||!link.pathname.startsWith('/hotel/'))return [];}catch{return [];}
   // Strip session tokens from links; preserve only explicit trip fields.
   link.search=new URLSearchParams({checkin:query.checkin,checkout:query.checkout,group_adults:String(query.adults),no_rooms:String(query.rooms??1),group_children:String((query.childrenAges??[]).length),selected_currency:'CAD'}).toString();
   for(const age of query.childrenAges??[])link.searchParams.append('age',String(age));
   return [{name:r.name,stars:Number(r.stars),priceText:r.priceText,taxText:r.taxText||'Taxes and fees not provided',stayText:r.stayText,stay:{checkin:query.checkin,checkout:query.checkout,nights,rooms:query.rooms??1,adults:query.adults,...(query.adultAges?{adultAges:[...query.adultAges]}:{}),childrenAges:[...(query.childrenAges??[])]},occupancyEvidence:{...occupancyEvidence(r),requestedAdultAges:query.adultAges?[...query.adultAges]:null,requestedChildrenAges:[...(query.childrenAges??[])]},cancellationText:r.cancellationText?.trim()||null,url:link.toString(),observedAt:new Date().toISOString(),source:'Booking.com via api-anything',provider:'booking',currency:'CAD'}];
 });
 return {offers,received:result.data.length,rejected:result.data.length-offers.length,query,limitation:'Visible first-page observations only. Tax text is preserved; no calculated all-in total. Recheck availability on Booking.com.'};
}
