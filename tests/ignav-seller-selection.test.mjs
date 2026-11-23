import test from 'node:test';
import assert from 'node:assert/strict';
import {isExactIgnavSellerQuery,lowestFreshIgnavOffer} from '../lib/ignav-seller-selection.mjs';

const now=Date.parse('2026-11-08T22:30:00.000Z');
const offer=(price,overrides={})=>({provider:'Ignav',currency:'CAD',price,ignavId:`offer-${price}`,observedAt:new Date(now-60_000).toISOString(),...overrides});

const exactSearch=(query={})=>({query:{origin:'YHZ',destination:'LAX',date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',adults:1,children:0,childrenAges:[],cabin:'economy',...query},offers:[offer(1044)]});

test('seller handoff accepts only the exact one-adult query with no other travelers',()=>{
 assert.equal(isExactIgnavSellerQuery(exactSearch().query),true);
 assert.equal(isExactIgnavSellerQuery(exactSearch({children:1,childrenAges:[7]}).query),false);
 assert.equal(isExactIgnavSellerQuery(exactSearch({children:0,childrenAges:[7]}).query),false);
 assert.equal(isExactIgnavSellerQuery(exactSearch({children:undefined,childrenAges:undefined}).query),false);
 assert.equal(isExactIgnavSellerQuery(exactSearch({travelers:[{id:'adult-1',birthDate:'1980-01-01'}]}).query),false);
});

test('seller handoff can target a new exact one-way query without matching the historical round trip',()=>{
 const target={origin:'YHZ',destination:'LAX',date:'2026-12-15',tripType:'one-way',adults:1,children:0,childrenAges:[],cabin:'economy'};
 const query={...target,originType:'place',destinationType:'place',filters:{sort:'price'},returnDate:''};
 assert.equal(isExactIgnavSellerQuery(query,target),true);
 assert.equal(isExactIgnavSellerQuery({...query,date:'2026-12-16'},target),false);
 assert.equal(isExactIgnavSellerQuery({...query,travelers:[{id:'adult-1'}]},target),false);
 assert.equal(isExactIgnavSellerQuery({...query,children:1,childrenAges:[7]},target),false);
});

test('seller handoff selector chooses the cheapest fresh CAD Ignav offer only',()=>{
 const result={offers:[
  offer(800,{provider:'Google Flights'}),
  offer(700,{observedAt:new Date(now-16*60_000).toISOString()}),
  offer(900,{currency:'USD'}),
  offer(950,{ignavId:undefined}),
  offer(1044),
  offer(1100),
 ]};
 assert.equal(lowestFreshIgnavOffer(result,now)?.ignavId,'offer-1044');
});

test('seller handoff selector returns no offer when all matching records are stale or lack valid timestamps',()=>{
 assert.equal(lowestFreshIgnavOffer({offers:[
  offer(700,{observedAt:new Date(now-16*60_000).toISOString()}),
  offer(800,{observedAt:'not-a-timestamp'}),
 ]},now),null);
});
