import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDestination} from '../lib/destination.mjs';
const lookup = search => async () => Response.json({search});
test('detects airports and exact city or region names',async()=>{
 assert.equal((await detectDestination('BCN',{fetcher:lookup([{label:'Barcelona Airport',description:'airport in Spain',match:{type:'alias',text:'BCN'}}])})).type,'place');
 assert.equal((await detectDestination('Barcelona',{fetcher:lookup([{label:'Barcelona',description:'city in Spain'},{label:'Barcelona',description:'municipality of the Philippines in the province of Sorsogon'}])})).type,'place');
 assert.equal((await detectDestination('USA',{fetcher:lookup([{label:'United States',description:'country in North America',match:{type:'alias',text:'USA'}}])})).canonicalName,'United States');
 assert.equal((await detectDestination('Europe',{fetcher:lookup([{label:'Europe',description:'terrestrial continent in Eurasia'},{label:'Europe',description:'Swedish rock band'}])})).type,'region');
});
test('resolves explicit region conventions locally before external classification',async()=>{
 for(const name of ['Europe','Scandinavia','Nordic countries','Mediterranean','South Pacific','Gulf Cooperation Council']){
  let calls=0;
  const result=await detectDestination(name,{fetcher:async()=>{calls++;throw Error('must not fetch');}});
  assert.equal(result.type,'region',name);assert.equal(result.canonicalName,name);assert.equal(calls,0,name);
  assert.match(result.policyVersion,/^UNSD-M49-/);assert.ok(result.source);assert.equal(result.model,'not-used');
 }
 assert.match((await detectDestination('Scandinavia')).policyNote,/Nordic Council/);
 assert.match((await detectDestination('Mediterranean')).policyNote,/Barcelona Convention/);
});
test('automatic classification preserves the GCC IATA airport code, while the full council name resolves as a region',async()=>{
 let calls=0;
 const airport=await detectDestination('GCC',{fetcher:async()=>{calls++;throw Error('IATA code should resolve locally');}});
 assert.equal(airport.type,'place');assert.equal(airport.kind,'airport');assert.equal(calls,0);
 assert.equal((await detectDestination('Gulf Cooperation Council')).type,'region');
});
test('handles ambiguous names and lookup outages without silently choosing',async()=>{
 assert.equal((await detectDestination('Georgia',{fetcher:lookup([{label:'Georgia',description:'country in the Caucasus'},{label:'Georgia',description:'state of the United States'}])})).type,'region');
 assert.equal((await detectDestination('Victoria',{fetcher:lookup([{label:'Victoria',description:'city in Canada'},{label:'Victoria',description:'region in Australia'}])})).type,'ambiguous');
 assert.equal((await detectDestination('Victoria',{fetcher:async()=>{throw Error('offline')}})).type,'unknown');
});
test('uses local decision subtype and abstains on conflict',async()=>{
 const options={fetcher:lookup([{label:'Barcelona',description:'city in Spain'}]),classifier:async()=>[{choice:'city',answer_confidence:0.98}]};
 const r=await detectDestination('Barcelona',options);assert.equal(r.type,'place');assert.equal(r.kind,'city');assert.equal(r.model,'laya-local');
 const conflict=await detectDestination('Barcelona',{...options,classifier:async()=>[{choice:'country',answer_confidence:0.98}]});assert.equal(conflict.type,'ambiguous');
});
test('airport code classification prioritizes the airport over a city alias',async()=>{
 let prompt;
 const r=await detectDestination('BCN',{fetcher:lookup([{label:'Barcelona',description:'city in Spain',match:{type:'alias',text:'BCN'}},{label:'Barcelona Airport',description:'international airport in Spain',match:{type:'alias',text:'BCN'}}]),classifier:async descriptions=>{prompt=descriptions;return [{choice:'airport',answer_confidence:0.97}];}});
 assert.match(prompt[0],/Airport/);assert.equal(r.kind,'airport');
});
