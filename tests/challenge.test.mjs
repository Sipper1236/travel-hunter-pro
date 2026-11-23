import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {challengeFrame,challengeInput} from '../lib/challenge.mjs';
import {extractStays} from '../lib/booking-browser.mjs';
import {localRequest} from '../lib/browser-jobs.mjs';
test('shows only challenge crop, relays human click in original page, rejects stale/outside input',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 try{const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});await page.setContent(`<p>Private provider content outside the challenge</p><div id="captcha-container" style="width:300px;height:150px;background:white"><button onclick="window.completed=true;document.querySelector('#captcha-container').remove()">Complete test challenge</button></div>`);
 const frame=await challengeFrame(page);assert.equal(frame.box.width,300);assert.equal(frame.box.height,150);
 await assert.rejects(challengeInput(page,frame,{frameId:'old',kind:'click',x:1,y:1}));
 await assert.rejects(challengeInput(page,frame,{frameId:frame.id,kind:'click',x:400,y:1}));
 const button=await page.locator('button').boundingBox();await challengeInput(page,frame,{frameId:frame.id,kind:'click',x:button.x-frame.box.x+5,y:button.y-frame.box.y+5});
 assert.equal(await page.evaluate(()=>window.completed),true);assert.equal(await challengeFrame(page),null);
 }finally{await browser.close();}
});
test('api-anything extracts observed CAD cards and rejects missing stars or wrong occupancy',async()=>{
 const card=(stars,stay)=>`<div data-testid="property-card"><div data-testid="title">Test Hotel</div><div data-testid="rating-stars">${'<span></span>'.repeat(stars)}</div><div data-testid="price-and-discounted-price">CAD 900</div><div data-testid="taxes-and-charges">+CAD 100 taxes</div><div data-testid="price-for-x-nights">${stay}</div><a data-testid="title-link" href="https://www.booking.com/hotel/test.html?sid=private">Open</a></div>`;
 const r=await extractStays(card(4,'5 nights, 1 adult')+card(0,'5 nights, 1 adult')+card(5,'5 nights, 2 adults'),{city:'Test City',checkin:'2027-04-15',checkout:'2027-04-20',adults:1});
 assert.equal(r.offers.length,1);assert.equal(r.rejected,2);assert.ok(!r.offers[0].url.includes('sid='));assert.equal(r.offers[0].taxText,'+CAD 100 taxes');
 assert.deepEqual(r.offers[0].occupancyEvidence,{status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false,requestedAdultAges:null,requestedChildrenAges:[]});
});
test('browser endpoints reject cross-origin and remote hosts',()=>{const req=(host,origin)=>new Request('http://localhost/api/browser-jobs',{headers:{host,origin}});assert.equal(localRequest(req('localhost:3000','http://localhost:3000')),true);assert.equal(localRequest(req('localhost:3000','https://evil.example')),false);assert.equal(localRequest(req('evil.example','http://evil.example')),false);});

test('5-star-only search excludes four-star observations',async()=>{
 const card=stars=>`<div data-testid="property-card"><div data-testid="title">Hotel ${stars}</div><div data-testid="rating-stars">${'<span></span>'.repeat(stars)}</div><div data-testid="price-and-discounted-price">CAD 100</div><div data-testid="price-for-x-nights">5 nights, 1 adult</div><a data-testid="title-link" href="https://www.booking.com/hotel/test.html">Hotel</a></div>`;
 const result=await extractStays(card(4)+card(5),{city:'Test City',checkin:'2027-04-15',checkout:'2027-04-20',adults:1,minStars:5});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].stars,5);assert.equal(result.rejected,1);
});

test('hotel requests preserve actual ages and rooms and reject invalid occupancy',async()=>{
 const {validateStay,stayUrl}=await import('../lib/booking-browser.mjs');
 const base={city:'Barcelona',checkin:'2099-04-15',checkout:'2099-04-20',adults:2,adultAges:[35,39],rooms:2,roomAllocations:[{adultAges:[35],childrenAges:[0]},{adultAges:[39],childrenAges:[15]}],childrenAges:[0,15],minStars:5};
 const q=validateStay(base),u=new URL(stayUrl(q));
 assert.equal(u.searchParams.get('no_rooms'),'2');assert.equal(u.searchParams.get('group_children'),'2');assert.deepEqual(u.searchParams.getAll('age'),['0','15']);assert.equal(u.searchParams.get('nflt'),'class=5');
 for(const childrenAges of [[null],[18],[-1],[2.5]])assert.throws(()=>validateStay({...base,childrenAges}));
 assert.throws(()=>validateStay({...base,rooms:0}));
});

test('hotel extraction preserves observed cancellation terms and structured stay without guessing missing terms',async()=>{
 const card=policy=>`<div data-testid="property-card"><div data-testid="title">Hotel</div><div data-testid="rating-stars">${'<span></span>'.repeat(4)}</div><div data-testid="price-and-discounted-price">CAD 500</div><div data-testid="price-for-x-nights">5 nights, 1 adult</div>${policy?'<div data-testid="cancellation-policy">Non-refundable</div>':''}<a data-testid="title-link" href="https://www.booking.com/hotel/test.html">Hotel</a></div>`;
 const query={city:'Test City',checkin:'2027-04-15',checkout:'2027-04-20',adults:1};
 const result=await extractStays(card(true)+card(false),query);
 assert.equal(result.offers[0].cancellationText,'Non-refundable');assert.equal(result.offers[1].cancellationText,null);
 assert.deepEqual(result.offers[0].stay,{checkin:query.checkin,checkout:query.checkout,nights:5,rooms:1,adults:1,childrenAges:[]});
 assert.equal(result.offers[0].occupancyEvidence.individualAgesEchoed,false);
});
