import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteFreshness,QUOTE_MAX_AGE_MS} from '../lib/quote-freshness.mjs';
import {flightOfferError} from '../lib/flight-offer.mjs';

const now = Date.parse('2026-10-29T12:00:00Z');
const at = delta => new Date(now + delta).toISOString();
test('application age limit expires observations without inventing provider expiry',()=>{
 assert.equal(quoteFreshness({observedAt:at(-QUOTE_MAX_AGE_MS+1)},now).status,'fresh');
 assert.equal(quoteFreshness({observedAt:at(-QUOTE_MAX_AGE_MS)},now).status,'stale');
 assert.equal(quoteFreshness({observedAt:at(121000)},now).status,'future');
 assert.equal(quoteFreshness({observedAt:null},now).status,'unknown');
 assert.equal(quoteFreshness({observedAt:'2026-02-30T12:00:00Z'},now).status,'unknown');
});
test('earlier provider expiry wins and malformed expiry cannot authorize a quote',()=>{
 const offer={observedAt:at(-60000)};
 assert.equal(quoteFreshness({...offer,expiresAt:at(-1)},now).status,'stale');
 assert.equal(quoteFreshness({...offer,expiresAt:'invalid'},now).status,'unknown');
 assert.equal(quoteFreshness({...offer,expiresAt:at(-120000)},now).status,'unknown');
 assert.equal(quoteFreshness({...offer,expiresAt:at(60000)},now).usableUntil,now+60000);
});
test('flight gate excludes an otherwise valid historical quote',()=>{
 const query={origin:'YHZ',destination:'YUL',date:'2099-04-15',cabin:'economy'};
 const offer={price:300,currency:'CAD',provider:'Observed provider',source:'Observed provider',travelers:'1 adult',bookingStatus:'Unconfirmed',fees:'Unknown',observedAt:at(-QUOTE_MAX_AGE_MS),cabin:'economy',airlines:['Airline'],from:'YHZ',to:'YUL',departureDate:query.date,arrivalDate:query.date,departureTime:'09:00',arrivalTime:'12:00',durationMinutes:180,via:[],segments:[{from:'YHZ',to:'YUL',flightNumber:'EA123',carrierCode:'EA',departureAt:`${query.date}T09:00:00Z`,arrivalAt:`${query.date}T12:00:00Z`}]};
 assert.equal(flightOfferError(offer,query,{now}),'quote_freshness');
 assert.equal(flightOfferError({...offer,observedAt:at(-1000)},query,{now}),null);
 const fresh={...offer,observedAt:at(-1000)};
 assert.equal(flightOfferError({...fresh,segments:undefined},query,{now}),'segments');
 assert.equal(flightOfferError({...fresh,segments:[]},query,{now}),'segments');
 assert.equal(flightOfferError({...fresh,provider:undefined},query,{now}),'provenance');
});
