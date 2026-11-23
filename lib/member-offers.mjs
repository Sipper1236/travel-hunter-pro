import {parse} from 'node-html-parser';
import {fetchPublic} from './public-fetch.mjs';
import {fetchSource} from './source-fetch.mjs';
import {getJobStore} from './job-store.mjs';

const sources={
 caa:{name:'CAA Atlantic hotel benefits',url:'https://atlantic.caa.ca/travel/hotels-and-vacation-rentals',termsUrl:'https://atlantic.caa.ca/terms-conditions-membership',termsLabel:'CAA membership terms',match:/Save 5% to 10%[\s\S]*Choice Hotels/i,termsMatch:/Permanent residents of the four \(4\) Atlantic provinces(?:\s*\([^)]*\))? are eligible to apply[\s\S]*CAA membership is personal and only members may access the benefits/i,termsObservedStatus:'membership_terms_observed',termsDetail:'CAA Atlantic states that permanent residents of New Brunswick, Nova Scotia, Prince Edward Island and Newfoundland & Labrador may apply, and membership benefits are personal to active members. This does not verify this traveler’s membership or a property/date-specific hotel rate.',detail:'CAA Atlantic advertises 5–10% savings at listed hotel chains, 15% at Rodd Hotels, and other regional offers. The exact property/date/rate terms must be checked with CAA or the hotel. No discount was applied.'},
 caaQuebec:{name:'CAA-Québec hotel savings',url:'https://www.caaquebec.com/en/member-benefits/rabais-dollars-caa/savings-for-your-next-vacation',match:/Marriott[\s\S]{0,90}5% off[\s\S]*Hyatt[\s\S]{0,90}10% off[\s\S]*Choice Hotels[\s\S]{0,90}10% off and more[\s\S]*Hilton Hotels[\s\S]{0,90}5% off or more/i,detail:'CAA-Québec publicly lists partner hotel savings. The source does not verify this traveler’s membership or a participating property, date, room, or rate. Check exact terms with CAA-Québec or the hotel; no discount was applied.'},
 caaSCO:{name:'CAA South Central Ontario hotel benefits',url:'https://www.caasco.com/travel/hotels',match:/^(?=[\s\S]*Exclusive hotel savings and benefits for CAA Members)(?=[\s\S]*Hilton Hotels & Resorts)(?=[\s\S]*Hyatt Hotels)(?=[\s\S]*Choice Hotels)(?=[\s\S]*SAVE 10% or more)/i,detail:'CAA South Central Ontario publicly lists example AAA/CAA hotel rates, including Hilton, Hyatt, Marriott, and Choice. Offers are subject to change and participating-property restrictions. Membership and a property/date-specific rate remain unverified; no discount was applied.'},
 caaSaskatchewan:{name:'CAA Saskatchewan Choice Hotels member information',url:'https://magazine.caask.ca/fall-2025/caa-travel-choice-hotels',match:/Exclusive CAA Member Savings[\s\S]*up to 10% off at participating Choice Hotels[\s\S]*membership card at check-in/i,detail:'CAA Saskatchewan’s Fall 2025 magazine page describes up to 10% off at participating Choice Hotels and says to present a membership card at check-in. This dated public information does not establish that the offer is still current, this traveler’s membership, a participating property, or a comparable property/date rate. No discount was applied.'},
 caaNorthEast:{name:'CAA North & East Ontario hotel benefits',url:'https://caaneo.ca/travel/hotels/',match:/^(?=[\s\S]*CAA Members save up to 10% or more)(?=[\s\S]*Choice Hotels)(?=[\s\S]*Marriott Bonvoy)(?=[\s\S]*Hilton)(?=[\s\S]*Hyatt)/i,detail:'CAA North & East Ontario publicly lists hotel savings at Choice Hotels, Marriott Bonvoy, Hilton and Hyatt. This public program information does not verify this traveler’s membership, the selected property/date/room or a comparable current rate. No discount was applied.'},
 caaManitoba:{name:'CAA Manitoba hotel benefits',url:'https://www.caamanitoba.com/travel/search/hotels',match:/^(?=[\s\S]*CAA Member hotel offers)(?=[\s\S]*SAVE 10% or more)(?=[\s\S]*Choice Privileges)(?=[\s\S]*Hyatt)/i,detail:'CAA Manitoba publicly lists partner hotel savings and availability/room-type restrictions. This does not verify this traveler’s membership or a participating property/date/rate. Check exact terms with CAA Manitoba or the hotel; no discount was applied.'},
 caaNiagara:{name:'CAA Niagara / Choice Hotels',url:'https://info.caaniagara.ca/choice-hotels',match:/CAA Member Benefits[\s\S]*Save 10% or more[\s\S]*booking AAA\/CAA rates/i,detail:'CAA Niagara publicly advertises 10% or more at Choice Hotels on AAA/CAA rates. This does not verify this traveler’s membership, the selected property/date/rate, or applicable Choice terms. No discount was applied.'},
 bcaa:{name:'BCAA hotel partner offers',url:'https://portal.caarewards.ca/bcaa/search?offer_category=7',match:/^(?=[\s\S]*Choice Hotels)(?=[\s\S]*10% or more)(?=[\s\S]*BCAA)/i,detail:'BCAA’s public Rewards hotel-category page lists partner offers, including hotel-brand offers. It does not verify this traveler’s membership or eligibility, or the selected property, dates, room, or comparable rate. Confirm the exact terms directly with BCAA or the hotel; no discount was applied.'},
 costco:{name:'Costco Travel Canada',url:'https://www.costcotravel.ca/info/terms-and-conditions',match:/(?=[\s\S]*Only Costco Wholesale Members residing in Canada may purchase travel services)(?=[\s\S]*2% REWARDS FOR EXECUTIVE MEMBERS)/i,detail:'Costco Travel requires a Canadian Costco member who resides in Canada. Its 2% Executive Member Reward (up to CA$1,250) is earned after qualifying travel and excludes taxes, fees and listed extras; it is not a reduction to the observed booking price. Check the exact offer and terms.'},
 costcoDeals:{name:'Costco Travel Canada current deal listings',url:'https://www.costcotravel.ca/Travel-Offers/Spotlight?localeCode=en_CA',detail:'Only official deal cards with a valid future “Book by” date are listed. This is a public listing observation, not a traveler-specific price, membership verification, package quote, or proof of eligibility. Open the offer and recheck the exact trip with Costco Travel.'},
 visa:{name:'Visa Infinite / Booking.com',url:'https://www.visa.ca/en_CA/pay-with-visa/cards/credit-cards/infinite.html',termsUrl:'https://www.visa.ca/en_CA/pay-with-visa/cards/credit-cards/infinite/terms-and-conditions.html',termsLabel:'Visa general program terms',match:/free Booking\.com account[\s\S]{0,250}up to 8% \(up to \$230 USD\) in Travel Credits for future stays/i,termsMatch:/eligible Visa Infinite[\s\S]{0,220}valid Canadian issued[\s\S]{0,300}discounts cannot be combined with any other offer or discount/i,termsObservedStatus:'general_terms_observed',termsDetail:'Visa’s general terms require an eligible Visa Infinite or Visa Infinite+ card issued in Canada, allow benefits to change without notice, and state discounts cannot be combined. The linked page does not establish the Booking.com offer’s full booking-specific terms, this traveler’s eligibility, or whether a particular property qualifies.',detail:'Visa advertises up to 8% (maximum USD 230) in Travel Credits for future stays on qualifying Booking.com accommodations after free account signup and payment with an eligible Visa Infinite card. The source describes a future credit, not an immediate price discount; nothing is applied.'},
 ama:{name:'AMA Alberta hotel member information',url:'https://ama.ab.ca/articles/find-your-home-away-from-home',match:/^(?=[\s\S]*For AMA Members Only)(?=[\s\S]*save 5% or more and earn Marriott Bonvoy points)(?=[\s\S]*save up to 5% and earn Honors points)(?=[\s\S]*save up to 10% and earn World of Hyatt points)/i,detail:'AMA’s public member article lists special Marriott, Hilton and Hyatt member rates and hotel loyalty points. It is general program information, not a current property/date/room quote, and does not verify this traveler’s membership or a comparable total. No discount was applied.'},
};

/** Public source observations only; no membership, card or rate eligibility is inferred. */
export async function checkMemberSources(selection,{fetcher,policy,signal,now,sleep}={}) {
 if(!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(key=>!Object.hasOwn(sources,key))||Object.values(selection).some(value=>typeof value!=='boolean'))throw Error('Choose the member sources to check.');
 const requested=Object.keys(sources).filter(key=>selection[key]===true);
 if(!requested.length)throw Error('Choose at least one member source to check.');
 return Promise.all(requested.map(async key=>{
  const source=sources[key];
  try {
   const response=await requestMemberSource(key,source.url,{fetcher,policy,signal,now,sleep});
   if(!response.ok)throw Error(`Source returned HTTP ${response.status}.`);
   if(response.url&&new URL(response.url).hostname!==new URL(source.url).hostname)throw Error('Source redirected to a different host.');
   const html=await response.text();signal?.throwIfAborted();
   const text=plainText(html);
   if(key==='costcoDeals'){
    const observedNow=typeof now==='function'?now():now??Date.now(),parsed=parseCostcoDeals(html,observedNow);
    if(!/This Week['’]s Hot Deals/i.test(text))return {id:key,name:source.name,status:'unverified',url:source.url,reason:'The expected current-deals section was not found. Check Costco Travel directly.'};
    if(!parsed.current.length)return {id:key,name:source.name,status:'unverified',url:source.url,reason:`No deal card with a valid future booking deadline was confirmed${parsed.expired?`; ${parsed.expired} expired dated listing${parsed.expired===1?' was':'s were'} excluded`:''}.`,coverage:{currentDatedOffers:0,expiredDatedOffers:parsed.expired,displayLimit:parsed.limit},eligibility:'unverified'};
    return {id:key,name:source.name,status:'information_observed',url:source.url,observedAt:new Date(observedNow).toISOString(),offers:parsed.current,coverage:{currentDatedOffers:parsed.current.length,expiredDatedOffers:parsed.expired,displayLimit:parsed.limit,omittedCurrentDatedOffers:parsed.omitted},eligibility:'unverified',detail:source.detail};
   }
   if(!source.match.test(text))return {id:key,name:source.name,status:'unverified',url:source.url,reason:'The expected source information was not found. Check the provider directly.'};
   let termsStatus='not_checked',termsDetail;
   if(source.termsUrl){
    try{
     const termsResponse=await requestMemberSource(key,source.termsUrl,{fetcher,policy,signal,now,sleep});
     if(!termsResponse.ok||termsResponse.url&&new URL(termsResponse.url).hostname!==new URL(source.termsUrl).hostname)throw Error('Terms source unavailable or redirected.');
     const termsText=plainText(await termsResponse.text());signal?.throwIfAborted();
     if(!source.termsMatch?.test(termsText))throw Error('Expected terms markers were not found.');
     termsStatus=source.termsObservedStatus;termsDetail=source.termsDetail;
    }catch{signal?.throwIfAborted();termsStatus='unverified';termsDetail='The linked terms page could not be checked or the expected terms were not found. Confirm the current terms directly; no eligibility or discount is assumed.';}
   }
   return {id:key,name:source.name,status:'information_observed',url:source.url,...(source.termsUrl?{termsUrl:source.termsUrl,termsLabel:source.termsLabel,termsStatus,termsDetail}:{}),observedAt:new Date().toISOString(),detail:source.detail,eligibility:'unverified'};
  } catch(error) {
   signal?.throwIfAborted();
   const retryAt=Number.isFinite(error?.retryAt)?new Date(error.retryAt).toISOString():undefined;
   if(error?.sourceStatus==='rate_limited')return {id:key,name:source.name,status:'rate_limited',url:source.url,reason:'The provider is rate limiting requests. Wait before checking this source again.',...(retryAt?{retryAt}:{})};
   if(error?.sourceStatus==='blocked')return {id:key,name:source.name,status:'blocked',url:source.url,reason:'The provider declined this public page request. Check the source directly.',...(retryAt?{retryAt}:{})};
   return {id:key,name:source.name,status:'unavailable',url:source.url,reason:'The source could not be checked. Try again or check the provider directly.',...(retryAt?{retryAt}:{})};
  }
 }));
}

function memberProvider(key){return key.startsWith('caa')?'CAA public member-benefit pages':key==='bcaa'?'BCAA public member-benefit portal':key==='ama'?'AMA Alberta public member-benefit page':key.startsWith('costco')?'Costco Travel public pages':'Visa Infinite member page';}
async function requestMemberSource(key,url,{fetcher,policy,signal,now,sleep}){
 const client=fetcher??fetchPublic;
 return fetchSource(memberProvider(key),url,{...(signal?{signal}:{})},{
  fetcher:(target,init)=>client(target,{signal:init.signal}),
  policy:policy??(fetcher?null:getJobStore()),
  retrySafe:true,timeoutMs:20000,...(now?{now}:{}),...(sleep?{sleep}:{})
 });
}

function plainText(html){const document=parse(html);document.querySelectorAll('script,style,noscript').forEach(node=>node.remove());return document.text.replace(/\s+/g,' ').trim();}

function parseCostcoDeals(html,now,limit=20){
 const document=parse(html);document.querySelectorAll('script,style,noscript').forEach(node=>node.remove());
 const today=new Date(now),todayUtc=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()),byUrl=new Map();let expired=0;
 for(const anchor of document.querySelectorAll('a[href]')){
  const title=anchor.text.replace(/\s+/g,' ').trim(),deadline=/\bBook by\s+(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/i.exec(title),href=anchor.getAttribute('href');
  if(!deadline||!href||!title)continue;
  let url,month=Number(deadline[1]),day=Number(deadline[2]),year=Number(deadline[3]);if(year<100)year+=year<70?2000:1900;
  const deadlineUtc=Date.UTC(year,month-1,day);
  if(!Number.isFinite(deadlineUtc)||new Date(deadlineUtc).getUTCFullYear()!==year||new Date(deadlineUtc).getUTCMonth()!==month-1||new Date(deadlineUtc).getUTCDate()!==day)continue;
  try{url=new URL(href,'https://www.costcotravel.ca');}catch{continue;}
  if(url.protocol!=='https:'||url.hostname!=='www.costcotravel.ca'||!['/vacation-packages/offers/','/cruise-travel-offers/'].some(prefix=>url.pathname.startsWith(prefix)))continue;
  if(deadlineUtc<todayUtc){expired++;continue;}
  const bookBy=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const offerType=url.pathname.startsWith('/cruise-travel-offers/')?'cruise_listing':/hotel.only/i.test(title)?'hotel_only':'package_listing';
  byUrl.set(url.href,{title:title.slice(0,300),url:url.href,bookBy,offerType});
 }
 const offers=[...byUrl.values()].sort((a,b)=>a.bookBy.localeCompare(b.bookBy)||a.title.localeCompare(b.title));
 return {current:offers.slice(0,limit),omitted:Math.max(0,offers.length-limit),expired,limit};
}
