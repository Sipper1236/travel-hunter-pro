import test from 'node:test';
import assert from 'node:assert/strict';
import {readHotelLocation,verifyHotelLocation} from '../lib/hotel-location.mjs';
import {resolveHotelDestination} from '../lib/hotel-destination.mjs';
import {validateStay} from '../lib/booking-browser.mjs';
const offer={name:'Test Hotel',url:'https://www.booking.com/hotel/es/test.en-gb.html?sid=private'};
const destination={city:'Barcelona',cityId:'Q1492',countryCode:'ES',countryName:'Spain',airport:'BCN',cityUrl:'https://www.wikidata.org/wiki/Q1492'};
const node=(change={})=>({'@type':'Hotel',name:offer.name,url:offer.url,address:{addressLocality:'Barcelona',addressCountry:'ES'},...change});
const html=nodes=>`<script type="application/ld+json">${JSON.stringify({'@graph':nodes})}</script>`;
const read=nodes=>readHotelLocation(html(nodes),{offer,destination,pageUrl:offer.url});
test('property identity and structured address establish a city-country-airport link',()=>{
 const result=read([node()]);assert.equal(result.status,'verified');assert.equal(result.cityId,'Q1492');assert.equal(result.airport,'BCN');assert.ok(!result.sourceUrl.includes('sid='));
 assert.equal(read([node({address:{addressLocality:'Barcelona',addressCountry:{name:'Spain'}}})]).status,'verified');
});
test('wrong city/country, hotel identity or conflicting structured addresses stay unverified',()=>{
 for(const change of [{name:'Other Hotel'},{url:'https://www.booking.com/hotel/es/other.html'},{address:{addressLocality:'Madrid',addressCountry:'ES'}},{address:{addressLocality:'Barcelona',addressCountry:'PT'}}])assert.equal(read([node(change)]).status,'unverified');
 assert.equal(read([node(),node({address:{addressLocality:'Madrid',addressCountry:'ES'}})]).status,'unverified');
 assert.equal(readHotelLocation(html([node()]),{offer,destination,pageUrl:'https://www.booking.com/hotel/es/other.html'}).status,'unverified');
 const otherCountry={...offer,url:'https://www.booking.com/hotel/pt/test.html'};
 assert.equal(readHotelLocation(html([node({url:otherCountry.url})]),{offer:otherCountry,destination,pageUrl:otherCountry.url}).status,'unverified');
});
test('property-page refusal stops more location checks and closes the page',async()=>{
 let closed=0;const result=await verifyHotelLocation({newPage:async()=>({goto:async()=>({status:()=>403}),close:async()=>closed++})},offer,destination);
 assert.equal(result.stopChecking,true);assert.equal(closed,1);
});
test('airport city disambiguation requires a verified selection',async()=>{
 const cities=[{id:'Q1492',label:'Barcelona',countryCode:'ES',countryName:'Spain',url:destination.cityUrl},{id:'Q123',label:'Other city',countryCode:'ES',countryName:'Spain'}];
 await assert.rejects(resolveHotelDestination({city:'BCN',destinationAirport:'BCN'},{citiesForAirport:async()=>cities}),error=>error.cityChoices.length===2);
 const resolved=await resolveHotelDestination({city:'BCN',destinationAirport:'BCN',cityId:'Q1492'},{citiesForAirport:async()=>cities});assert.equal(resolved.city,'Barcelona');assert.equal(resolved.airport,'BCN');
});
test('typing another city cannot authorize matching to the selected arrival airport',async()=>{
 await assert.rejects(resolveHotelDestination({city:'London',destinationAirport:'BCN'},{citiesForAirport:async()=>[{id:'Q1492',countryCode:'ES'}],cityLookup:async()=>({cityId:'Q84',countryCode:'GB'})}),/not verified/);
 const raw={city:'Barcelona',checkin:'2099-04-15',checkout:'2099-04-20',adults:1,destinationAirport:'BCN',destination:{cityId:'forged'}};
 assert.equal(validateStay(raw).destination,undefined);
});
