import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 let memberChecks=0;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname!=='/api/member-offers')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  if(++memberChecks>1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({limitation:'The source could not be refreshed. No discount was applied.',sources:[{id:'ama',name:'AMA Alberta hotel member information',status:'unverified',url:'https://ama.ab.ca/articles/find-your-home-away-from-home',reason:'The expected source information was not found. Check the provider directly.'},{id:'costco',name:'Costco Travel Canada',status:'rate_limited',url:'https://www.costcotravel.ca/info/terms-and-conditions',reason:'The provider is rate limiting requests. Wait before checking this source again.',retryAt:new Date(Date.now()+60000).toISOString()}]})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({limitation:'Membership, card eligibility and a comparable trip-specific rate have not been verified. No discount has been applied.',sources:[
   {id:'caa',name:'CAA Atlantic hotel benefits',status:'information_observed',url:'https://atlantic.caa.ca/travel/hotels-and-vacation-rentals',termsUrl:'https://atlantic.caa.ca/terms-conditions-membership',termsLabel:'CAA membership terms',termsStatus:'membership_terms_observed',termsDetail:'Only active eligible members may access personal benefits.',detail:'CAA hotel savings were observed. Exact rate eligibility is not verified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaQuebec',name:'CAA-Québec hotel savings',status:'information_observed',url:'https://www.caaquebec.com/en/member-benefits/rabais-dollars-caa/savings-for-your-next-vacation',detail:'Public partner information only. Individual membership and property/date rate remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaSCO',name:'CAA South Central Ontario hotel benefits',status:'information_observed',url:'https://www.caasco.com/travel/hotels',detail:'Public partner information only. Individual membership and property/date rate remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaNorthEast',name:'CAA North & East Ontario hotel benefits',status:'information_observed',url:'https://caaneo.ca/travel/hotels/',detail:'Public hotel partner information only. Membership and property/date rate remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaSaskatchewan',name:'CAA Saskatchewan Choice Hotels member information',status:'information_observed',url:'https://magazine.caask.ca/fall-2025/caa-travel-choice-hotels',detail:'Dated public information; current offer and personal/property/date eligibility remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaManitoba',name:'CAA Manitoba hotel benefits',status:'information_observed',url:'https://www.caamanitoba.com/travel/search/hotels',detail:'Public partner information only. Individual membership and property/date rate remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'caaNiagara',name:'CAA Niagara / Choice Hotels',status:'information_observed',url:'https://info.caaniagara.ca/choice-hotels',detail:'Public partner information only. Individual membership and property/date rate remain unverified.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'bcaa',name:'BCAA hotel partner offers',status:'unverified',url:'https://portal.caarewards.ca/bcaa/search?offer_category=7',reason:'The expected source information was not found. Check the provider directly.'},
   {id:'ama',name:'AMA Alberta hotel member information',status:'unverified',url:'https://ama.ab.ca/articles/find-your-home-away-from-home',reason:'The expected source information was not found. Check the provider directly.'},
   {id:'costco',name:'Costco Travel Canada',status:'information_observed',url:'https://www.costcotravel.ca/info/terms-and-conditions',detail:'Canadian membership is required. Executive reward is earned after qualifying travel and is not an immediate price reduction.',eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'costcoDeals',name:'Costco Travel Canada current deal listings',status:'information_observed',url:'https://www.costcotravel.ca/Travel-Offers/Spotlight?localeCode=en_CA',detail:'Only official deal cards with a valid future “Book by” date are listed. This is a public listing observation, not a traveler-specific price, membership verification, package quote, or proof of eligibility.',coverage:{currentDatedOffers:1,expiredDatedOffers:2,displayLimit:20,omittedCurrentDatedOffers:0},offers:[{title:'Montreal: DoubleTree by Hilton Montreal Limited-Time Package Book by 11/15/26 Included Extras Valued at CA $ 135',url:'https://www.costcotravel.ca/vacation-packages/offers/CANYULDOUBLETREE20261015LT',bookBy:'2026-11-15',offerType:'package_listing'}],eligibility:'unverified',observedAt:new Date().toISOString()},
   {id:'visa',name:'Visa Infinite / Booking.com',status:'information_observed',url:'https://www.visa.ca/en_CA/pay-with-visa/cards/credit-cards/infinite.html',termsUrl:'https://www.visa.ca/en_CA/pay-with-visa/cards/credit-cards/infinite/terms-and-conditions.html',termsLabel:'Visa general program terms',termsStatus:'general_terms_observed',termsDetail:'Canadian-issued eligible cards are required; offers cannot be combined. Booking-specific conditions remain unverified.',detail:'Up to 8% in future Booking.com Travel Credits; this is not an immediate price discount.',eligibility:'unverified',observedAt:new Date().toISOString()},
  ]})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.getByLabel('CAA Atlantic', {exact:true}).check();await page.getByLabel('CAA-Québec', {exact:true}).check();await page.getByLabel('CAA South Central Ontario', {exact:true}).check();await page.getByLabel('CAA North & East Ontario', {exact:true}).check();await page.getByLabel('CAA Saskatchewan', {exact:true}).check();await page.getByLabel('CAA Manitoba', {exact:true}).check();await page.getByLabel('CAA Niagara', {exact:true}).check();await page.getByLabel('BCAA British Columbia and Yukon').check();await page.getByLabel('AMA Alberta').check();await page.getByLabel('Costco Canada membership terms').check();await page.getByLabel('Costco Travel current dated deal listings').check();await page.getByLabel('Visa Infinite / Booking.com').check();
 const response=page.waitForResponse(value=>value.request().method()==='POST'&&new URL(value.url()).pathname==='/api/member-offers');
 await page.getByRole('button',{name:'Check selected sources'}).click();
 assert.equal((await response).status(),200);
 const panel=page.locator('section.search').filter({hasText:'Check member travel sources'});
 await panel.getByText(/membership terms observed/).waitFor();
 await panel.getByText(/general terms observed/).waitFor();
 await panel.getByRole('link',{name:'Visa general program terms ↗'}).waitFor();
 await panel.getByRole('link',{name:'CAA membership terms ↗'}).waitFor();
 await panel.getByText(/Executive reward is earned after qualifying travel/).waitFor();
 await panel.getByText(/CAA South Central Ontario hotel benefits/).waitFor();
 await panel.getByText(/CAA North & East Ontario hotel benefits/).waitFor();
 await panel.getByText(/CAA Saskatchewan Choice Hotels member information/).waitFor();
 await panel.getByText(/BCAA hotel partner offers/).waitFor();
 await panel.getByText(/AMA Alberta hotel member information/).waitFor();
 await panel.getByRole('link',{name:/Montreal: DoubleTree by Hilton Montreal Limited-Time Package/}).waitFor();
 assert.match(await panel.innerText(),/1 current dated listings; 2 expired listings excluded/);
 assert.match(await panel.innerText(),/Booking deadline 2026-11-15/);
 assert.match(await panel.innerText(),/Booking-specific conditions remain unverified/);
 assert.match(await panel.innerText(),/No discount has been applied/);
 for(const label of ['CAA Atlantic','CAA-Québec','CAA South Central Ontario','CAA North & East Ontario','CAA Saskatchewan','CAA Manitoba','CAA Niagara','BCAA British Columbia and Yukon','Costco Travel current dated deal listings','Visa Infinite / Booking.com'])await page.getByLabel(label,{exact:true}).uncheck();
 const throttled=page.waitForResponse(value=>value.request().method()==='POST'&&new URL(value.url()).pathname==='/api/member-offers');
 await page.getByRole('button',{name:'Check selected sources'}).click();assert.equal((await throttled).status(),200);
 await panel.getByText(/Status: unverified/).waitFor();
 assert.match(await panel.innerText(),/expected source information was not found/i);
 await panel.getByText(/Status: rate limited/).waitFor();await panel.getByText(/retry after/).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ui:'member-offers-and-costco-deals',sources:['caa','caaQuebec','caaSCO','caaNorthEast','caaSaskatchewan','caaManitoba','caaNiagara','bcaa','ama','costco','costcoDeals','visa'],bcaaStatus:'unverified',costcoTermsStatus:'information_observed',costcoDatedListingRendered:true,termsStatuses:['membership_terms_observed','general_terms_observed'],discountApplied:false,providerRequestsIntercepted:true,pageErrors:errors.length}));
}finally{await browser.close();}
