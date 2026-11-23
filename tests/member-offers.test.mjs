import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMemberSources} from '../lib/member-offers.mjs';
import {POST} from '../app/api/member-offers/route.js';

test('source checks use only requested primary sources and never infer eligibility or apply a discount',async()=>{
 const called=[];
 const sources=await checkMemberSources({visa:true,costco:false,caa:true},{fetcher:async url=>{called.push(url);if(url.endsWith('terms-and-conditions.html'))return new Response('<p>eligible Visa Infinite cardholder with a valid Canadian issued Visa Infinite card. Discounts cannot be combined with any other offer or discount.</p>');if(url.endsWith('terms-conditions-membership'))return new Response('<p>Permanent residents of the four (4) Atlantic provinces are eligible to apply for membership in CAA. CAA membership is personal and only members may access the benefits, services and discounts that are included.</p>');return new Response(url.includes('visa.ca')?'<p>free Booking.com account on qualifying accommodations purchased with an eligible Visa Infinite card get up to 8% (up to $230 USD) in Travel Credits for future stays</p>':'<p>Save 5% to 10% at Choice Hotels.</p>');}});
 assert.equal(called.length,4);assert.ok(sources.every(source=>source.status==='information_observed'&&source.eligibility==='unverified'));
 assert.equal(sources.find(source=>source.id==='visa').termsStatus,'general_terms_observed');
 assert.equal(sources.find(source=>source.id==='visa').termsLabel,'Visa general program terms');
 assert.equal(sources.find(source=>source.id==='caa').termsStatus,'membership_terms_observed');
 assert.equal(sources.find(source=>source.id==='caa').termsLabel,'CAA membership terms');
 assert.match(sources.find(source=>source.id==='visa').detail,/not an immediate price discount/);
 assert.match(sources.find(source=>source.id==='visa').termsDetail,/not be combined/i);
 assert.match(sources.find(source=>source.id==='caa').termsDetail,/personal to active members/i);
 assert.equal(sources.find(source=>source.id==='visa').termsUrl,'https://www.visa.ca/en_CA/pay-with-visa/cards/credit-cards/infinite/terms-and-conditions.html');
 assert.match(sources.find(source=>source.id==='caa').termsDetail,/New Brunswick, Nova Scotia, Prince Edward Island and Newfoundland/);
 assert.ok(sources.every(source=>!('discount' in source)&&!('price' in source)));
});
test('changed or unavailable source information is never presented as verified',async()=>{
 const changed=await checkMemberSources({visa:true},{fetcher:async()=>new Response('<p>Offer has changed</p>')});assert.equal(changed[0].status,'unverified');
 const failed=await checkMemberSources({costco:true},{fetcher:async()=>{throw Error('offline');}});assert.equal(failed[0].status,'unavailable');
 const redirected=await checkMemberSources({visa:true},{fetcher:async()=>({ok:true,url:'https://other.example/offer',text:async()=>'<p>Booking.com eligible Visa Infinite card Travel Credits</p>'})});assert.equal(redirected[0].status,'unavailable');
 await assert.rejects(checkMemberSources({visa:true,card:'123'}),/Choose/);await assert.rejects(checkMemberSources({visa:false}),/at least one/);
});
test('Costco and Visa source summaries preserve member and future-credit restrictions',async()=>{
 const costco=await checkMemberSources({costco:true},{fetcher:async()=>new Response('Only Costco Wholesale Members residing in Canada may purchase travel services. 2% REWARDS FOR EXECUTIVE MEMBERS.')});
 assert.match(costco[0].detail,/earned after qualifying travel/);assert.match(costco[0].detail,/not a reduction/);
 const visa=await checkMemberSources({visa:true},{fetcher:async()=>new Response('Free Booking.com account; up to 8% (up to $230 USD) in Travel Credits for future stays.')});
 assert.equal(visa[0].status,'information_observed');assert.match(visa[0].detail,/USD 230/);assert.match(visa[0].detail,/future credit/);
});
test('Costco dated public deal cards require official URLs, valid future deadlines and observed membership caveats',async()=>{
 const requested=[],now=Date.parse('2026-11-09T12:00:00Z'),html=`<h2>This Week's Hot Deals</h2>
  <a href="/vacation-packages/offers/CANYULDOUBLETREE20261015LT">Montreal: DoubleTree by Hilton Montreal Limited-Time Package Book by 11/15/26 Included Extras Valued at CA $ 135</a>
  <a href="/cruise-travel-offers/20261016cvir">Exclusive Launch Deal Virgin Voyages US $ 50 - US $ 200 Shipboard Credit Digital Costco Shop Card with Every Sailing Book by 11/25/26</a>
  <a href="/vacation-packages/offers/expired">Toronto package Book by 11/08/26</a>
  <a href="https://evil.example/vacation-packages/offers/forged">Fake package Book by 11/20/26</a>
  <a href="/vacation-packages/offers/invalid">Invalid deadline Book by 02/30/27</a>`;
 const [result]=await checkMemberSources({costcoDeals:true},{now:()=>now,fetcher:async url=>{requested.push(url);return new Response(html);}});
 assert.deepEqual(requested,['https://www.costcotravel.ca/Travel-Offers/Spotlight?localeCode=en_CA']);
 assert.equal(result.status,'information_observed');assert.equal(result.eligibility,'unverified');assert.equal(result.observedAt,new Date(now).toISOString());
 assert.deepEqual(result.coverage,{currentDatedOffers:2,expiredDatedOffers:1,displayLimit:20,omittedCurrentDatedOffers:0});
 assert.deepEqual(result.offers,[{title:'Montreal: DoubleTree by Hilton Montreal Limited-Time Package Book by 11/15/26 Included Extras Valued at CA $ 135',url:'https://www.costcotravel.ca/vacation-packages/offers/CANYULDOUBLETREE20261015LT',bookBy:'2026-11-15',offerType:'package_listing'},{title:'Exclusive Launch Deal Virgin Voyages US $ 50 - US $ 200 Shipboard Credit Digital Costco Shop Card with Every Sailing Book by 11/25/26',url:'https://www.costcotravel.ca/cruise-travel-offers/20261016cvir',bookBy:'2026-11-25',offerType:'cruise_listing'}]);
 assert.match(result.detail,/not a traveler-specific price/i);assert.ok(!('discount'in result)&&!('price'in result));
});
test('Costco deal listing is unverified when its section changes or all dated offers are expired',async()=>{
 const now=Date.parse('2026-11-09T12:00:00Z');
 const changed=await checkMemberSources({costcoDeals:true},{now:()=>now,fetcher:async()=>new Response('<h2>New page</h2>')});
 assert.equal(changed[0].status,'unverified');assert.match(changed[0].reason,/current-deals section/i);
 const expired=await checkMemberSources({costcoDeals:true},{now:()=>now,fetcher:async()=>new Response('<h2>This Week’s Hot Deals</h2><a href="/vacation-packages/offers/old">Old package Book by 11/08/26</a>')});
 assert.equal(expired[0].status,'unverified');assert.equal(expired[0].coverage.expiredDatedOffers,1);assert.equal(expired[0].eligibility,'unverified');assert.match(expired[0].reason,/expired dated listing was excluded/i);
});
test('offer information can be observed while linked terms remain explicitly unverified',async()=>{
 const result=await checkMemberSources({visa:true},{fetcher:async url=>{if(url.includes('terms-and-conditions'))throw Error('terms unavailable');return new Response('Free Booking.com account; up to 8% (up to $230 USD) in Travel Credits for future stays.');}});
 assert.equal(result[0].status,'information_observed');assert.equal(result[0].termsStatus,'unverified');assert.equal(result[0].eligibility,'unverified');assert.match(result[0].termsDetail,/could not be checked/i);
});
test('opted-in Canadian CAA club pages are checked independently and retain membership/rate caveats',async()=>{
 const requested=[];
 const responses=new Map([
  ['https://www.caaquebec.com/en/member-benefits/rabais-dollars-caa/savings-for-your-next-vacation','<p>Marriott 5% off Hyatt 10% off Choice Hotels 10% off and more Hilton Hotels 5% off or more</p>'],
  ['https://www.caasco.com/travel/hotels','<p>Exclusive hotel savings and benefits for CAA Members Members save up to 10% Hilton Hotels & Resorts Hyatt Hotels Marriott Choice Hotels SAVE 10% or more</p>'],
  ['https://www.caamanitoba.com/travel/search/hotels','<p>CAA Member hotel offers SAVE 10% or more Choice Privileges Members save up to 10% Hilton Hyatt</p>'],
  ['https://info.caaniagara.ca/choice-hotels','<p>CAA Member Benefits Save 10% or more when booking AAA/CAA rates</p>'],
 ]);
 const result=await checkMemberSources({caa:false,caaQuebec:true,caaSCO:true,caaManitoba:true,caaNiagara:true},{fetcher:async url=>{requested.push(url);return new Response(responses.get(url)??'');}});
 assert.deepEqual(requested,[...responses.keys()]);assert.equal(result.length,4);
 assert.ok(result.every(source=>source.status==='information_observed'&&source.eligibility==='unverified'&&!source.termsUrl),JSON.stringify(result));
 assert.equal(result.find(source=>source.id==='caaNiagara').name,'CAA Niagara / Choice Hotels');
 assert.match(result.find(source=>source.id==='caaQuebec').detail,/does not verify this traveler’s membership/i);
 assert.ok(result.every(source=>!('discount' in source)&&!('price' in source)));
});
test('CAA North & East Ontario public hotel page is distinct and never implies this traveler qualifies',async()=>{
 const requested=[];
 const result=await checkMemberSources({caaNorthEast:true},{fetcher:async url=>{requested.push(url);return new Response('<p>CAA Members save up to 10% or more on hotels booked online. Choice Hotels, Marriott Bonvoy, Hilton and Hyatt participate. Membership benefits are subject to conditions.</p>');}});
 assert.deepEqual(requested,['https://caaneo.ca/travel/hotels/']);
 assert.equal(result.length,1);assert.equal(result[0].id,'caaNorthEast');assert.equal(result[0].status,'information_observed');assert.equal(result[0].eligibility,'unverified');
 assert.equal(result[0].termsUrl,undefined);assert.match(result[0].detail,/does not verify this traveler’s membership/i);assert.ok(!('discount' in result[0])&&!('price' in result[0]));
});
test('CAA Saskatchewan dated public offer information never implies it is current or applies a discount',async()=>{
 const requested=[];
 const result=await checkMemberSources({caaSaskatchewan:true},{fetcher:async url=>{requested.push(url);return new Response('<p>Exclusive CAA Member Savings. Enjoy up to 10% off at participating Choice Hotels. Simply show your membership card at check-in.</p>');}});
 assert.deepEqual(requested,['https://magazine.caask.ca/fall-2025/caa-travel-choice-hotels']);
 assert.equal(result.length,1);assert.equal(result[0].id,'caaSaskatchewan');assert.equal(result[0].status,'information_observed');assert.equal(result[0].eligibility,'unverified');
 assert.match(result[0].detail,/Fall 2025/);assert.match(result[0].detail,/does not establish that the offer is still current/i);assert.ok(!('discount' in result[0])&&!('price' in result[0]));
});
test('AMA Alberta member hotel article requires distinct program evidence and does not infer user eligibility',async()=>{
 const requested=[];
 const result=await checkMemberSources({ama:true},{fetcher:async url=>{requested.push(url);return new Response('<p>For AMA Members Only. Save 5% or more and earn Marriott Bonvoy points. For AMA Members Only. Save up to 5% and earn Honors points. For AMA Members Only. Save up to 10% and earn World of Hyatt points.</p>');}});
 assert.deepEqual(requested,['https://ama.ab.ca/articles/find-your-home-away-from-home']);assert.equal(result.length,1);assert.equal(result[0].id,'ama');assert.equal(result[0].status,'information_observed');assert.equal(result[0].eligibility,'unverified');
 assert.match(result[0].detail,/not a current property\/date\/room quote/i);assert.match(result[0].detail,/does not verify this traveler’s membership/i);assert.ok(!('discount' in result[0])&&!('price' in result[0]));
});
test('BCAA official hotel-category source is selectable and keeps member and rate eligibility unverified',async()=>{
 const requested=[];
 const result=await checkMemberSources({bcaa:true},{fetcher:async url=>{requested.push(url);return new Response('<p>26 Offers. Choice Hotels Members save 10% or more and earn Choice Privileges points on AAA/CAA rates. Hilton Hotels save up to 10%. BCAA serves members in British Columbia and Yukon.</p>');}});
 assert.deepEqual(requested,['https://portal.caarewards.ca/bcaa/search?offer_category=7']);assert.equal(result.length,1);assert.equal(result[0].id,'bcaa');assert.equal(result[0].status,'information_observed');assert.equal(result[0].eligibility,'unverified');
 assert.match(result[0].detail,/does not verify this traveler’s membership/i);assert.match(result[0].detail,/property, dates, room, or comparable rate/i);assert.ok(!('discount' in result[0])&&!('price' in result[0]));
});
test('BCAA JavaScript shell is not mistaken for observed hotel offers',async()=>{
 const result=await checkMemberSources({bcaa:true},{fetcher:async()=>new Response('<!DOCTYPE html><p>http://prod-memberloyaltyplatform-cus.azurewebsites.net/bcaa/search?offer_category=7</p>')});
 assert.equal(result[0].status,'unverified');assert.match(result[0].reason,/expected source information was not found/i);assert.equal(result[0].eligibility,undefined);
});
test('live member-page reads share provider pacing across selected CAA clubs',async()=>{
 let now=10_000;const nextAllowed=new Map(),times=[];
 const policy={reserveSource(provider,gapMs){const next=nextAllowed.get(provider)??now;if(next>now)return {waitMs:next-now};nextAllowed.set(provider,now+gapMs);return {waitMs:0};},deferSource(){}};
 const body='<p>Marriott 5% off Hyatt 10% off Choice Hotels 10% off and more Hilton Hotels 5% off or more Exclusive hotel savings and benefits for CAA Members Hilton Hotels & Resorts Hyatt Hotels Choice Hotels SAVE 10% or more CAA Member hotel offers Choice Privileges Members save up to 10% Hyatt</p>';
 const result=await checkMemberSources({caaQuebec:true,caaSCO:true,caaManitoba:true},{policy,now:()=>now,sleep:async ms=>{now+=ms;},fetcher:async()=>{times.push(now);return new Response(body);}});
 assert.equal(result.length,3);assert.ok(result.every(source=>source.status==='information_observed'));
 assert.ok(times[1]-times[0]>=1000&&times[2]-times[1]>=1000,JSON.stringify(times));
});
test('member-source 429 cooldown is shared and exposed without retrying the source',async()=>{
 let now=1000,calls=0,blockedUntil=0,blockedStatus;
 const policy={reserveSource(_provider,gapMs){if(blockedUntil>now)return {blockedUntil,status:blockedStatus};return {waitMs:0};},deferSource(_provider,until,status){blockedUntil=until;blockedStatus=status;}};
 const options={policy,now:()=>now,sleep:async ms=>{now+=ms;},fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'60'}});}};
 const first=await checkMemberSources({costco:true},options);assert.equal(first[0].status,'rate_limited');assert.equal(first[0].retryAt,new Date(61000).toISOString());
 const second=await checkMemberSources({costco:true},options);assert.equal(second[0].status,'rate_limited');assert.equal(second[0].retryAt,new Date(61000).toISOString());assert.equal(calls,1);
});
test('member endpoint rejects nonlocal requests and invalid input without source access',async()=>{
 const denied=await POST(new Request('http://example.com/api/member-offers',{method:'POST',body:'{}'}));assert.equal(denied.status,403);
 const invalid=await POST(new Request('http://localhost:3000/api/member-offers',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000'},body:'{"visa":false}'}));assert.equal(invalid.status,400);
});
