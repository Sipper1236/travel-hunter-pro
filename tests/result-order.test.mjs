import test from 'node:test';
import assert from 'node:assert/strict';
import {flightDisplayItems} from '../lib/result-order.mjs';

test('unified results honor the saved query sort and put unknown timings last',()=>{
 const result={offers:[{price:100,durationMinutes:500,departureTime:'12:00'},{price:200,durationMinutes:100,departureTime:'08:00',inbound:{durationMinutes:100}}],priceObservations:[{price:50}]};
 const prices=sort=>flightDisplayItems({...result,query:{filters:{sort}}}).map(item=>item.price);
 assert.deepEqual(prices('price'),[50,100,200]);assert.deepEqual(prices('price_high'),[200,100,50]);assert.deepEqual(prices('duration'),[200,100,50]);assert.deepEqual(prices('departure'),[200,100,50]);assert.equal(result.offers[0].price,100);
});
