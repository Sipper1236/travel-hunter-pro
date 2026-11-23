import test from 'node:test';
import assert from 'node:assert/strict';
import {searchAirCanada} from '../lib/air-canada.mjs';
import {searchExpedia} from '../lib/expedia.mjs';
import {searchIgnav} from '../lib/ignav.mjs';
import {searchOmkarExpedia} from '../lib/omkar-expedia.mjs';
import {searchSkyscanner} from '../lib/skyscanner.mjs';

const query={origin:'YHZ',destination:'BCN',date:'2099-04-15',adults:1,children:0,childrenAges:[],cabin:'economy'};
const oversized=async()=>new Response('{}',{headers:{'content-length':'10000001'}});
const invalidResponse=error=>error?.sourceStatus==='invalid_response';

test('structured flight adapters stop oversized decoded JSON/XML responses before parsing',async()=>{
 await assert.rejects(searchIgnav(query,{apiKey:'test',fetcher:oversized}),invalidResponse);
 await assert.rejects(searchExpedia(query,{apiKey:'test',authorization:'test',fetcher:oversized}),invalidResponse);
 await assert.rejects(searchOmkarExpedia(query,{apiKey:'test',fetcher:oversized}),invalidResponse);
 await assert.rejects(searchSkyscanner(query,{apiKey:'test',loadTimezones:async()=>({byCode:new Map([['YHZ',{}],['BCN',{}]])}),fetcher:oversized}),invalidResponse);
 await assert.rejects(searchAirCanada(query,{apiKey:'test',sellerId:'seller',iataNumber:'12345678',agencyId:'agency',fetcher:oversized}),invalidResponse);
});
