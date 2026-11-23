import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuery, searchFlights } from '../lib/search.mjs';
import {SourceRequestError} from '../lib/source-errors.mjs';
const q = { origin:'YHZ', destination:'BCN', date:'2099-04-15', tripType:'one-way', cabin:'economy', adults:1, children:0 };
const fare = { airline:['Example Air'], price:350, from:'YHZ', to:'BCN', departureTime:[9,30], arrivalTime:[10], arrivalDate:[2099,4,16], durationMinutes:550, via:['YUL'] };
test('rejects unsupported passenger and trip parameters instead of mispricing', () => { for (const change of [{adults:2},{children:1},{tripType:'return'},{cabin:'business'},{date:'2099-02-30'}]) assert.throws(() => validateQuery({...q,...change})); });
test('does not promote Google route-level prices without flight-segment evidence', async () => { const result = await searchFlights(q, async (_s, op) => ({ok:true,data:op==='search'?[fare,{...fare,price:undefined}]:[fare]})); assert.equal(result.offers.length,0); assert.equal(result.complete,false); assert.equal(result.sources[0].accepted,0); assert.equal(result.sources[0].received,2); });
test('source block stops requests and never invents an offer', async () => { let count=0; const result=await searchFlights(q,async()=>{count++;return {ok:false,class:'blocked',reason:'blocked'};}); assert.equal(count,1); assert.deepEqual(result.offers,[]); assert.equal(result.complete,false); });

test('API Anything transport wrapping preserves a rate limit and stops later operations',async()=>{
 let operations=0;const result=await searchFlights(q,async(_source,_operation,_input,options)=>{operations++;try{await options.fetchImpl('https://example.com');}catch{}return {ok:false,class:'error',reason:'wrapped transport error'};},{fetchImpl:async()=>{throw new SourceRequestError('limit',{status:'rate_limited',retryAt:Date.now()+60000});}});
 assert.equal(operations,1);assert.equal(result.sources[0].status,'rate_limited');assert.ok(result.sources[0].retryAt);
});

test('region search reports bounded coverage and stops on blocks', async () => {
  const { searchRegion } = await import('../lib/regions.mjs');
  const airports = [{code:'AAA'},{code:'BBB'}];
  let calls=0;
  const result=await searchRegion(q, async()=>({region:{name:'Example'},airports,method:'test',moreAvailable:true}),async input=>{calls++; return {offers:[],sources:[{operation:'search',status:'blocked'}],complete:false};});
  assert.equal(calls,1); assert.equal(result.coverage.checked.length,1); assert.equal(result.complete,false);
});

test('single-region coverage does not mislabel merged airport-directory candidates as Wikidata-only',async()=>{
 const {searchRegion}=await import('../lib/regions.mjs');
 const result=await searchRegion({...q,destination:'Europe',airportLimit:4},async()=>({region:{name:'Europe'},airports:[{code:'YHZ',sources:['OurAirports','Wikidata']}],uncheckedAirports:[{code:'YUL',sources:['OurAirports']}],directorySources:[{source:'OurAirports',status:'available'},{source:'Wikidata',status:'available'}],method:'Merged OurAirports and Wikidata candidates.'}),async()=>({offers:[],sources:[],complete:false}));
 assert.match(result.limitations[0],/selected airport candidates from the resolved location/);
 assert.doesNotMatch(result.limitations[0],/selected Wikidata airports/);
 assert.deepEqual(result.coverage.uncheckedAirports.map(airport=>airport.code),['YUL']);
});

test('region airport selection defaults above three, respects custom count, and rejects unbounded pair budgets',async()=>{
 const {searchRegion,searchRegionPair}=await import('../lib/regions.mjs');let searched=[];
 const airports=Array.from({length:12},(_,i)=>({code:`A${String.fromCharCode(65+i)}A`}));
 const result=await searchRegion({...q,destination:'Europe'},async()=>({region:{name:'Europe'},airports,method:'fixture'}),async input=>{searched.push(input.destination);return {offers:[],sources:[],complete:false};});
 assert.equal(searched.length,10);assert.equal(result.coverage.airportLimit,10);
 searched=[];await searchRegion({...q,destination:'Europe',airportLimit:6},async()=>({region:{name:'Europe'},airports,method:'fixture'}),async input=>{searched.push(input.destination);return {offers:[],sources:[],complete:false};});assert.equal(searched.length,6);
 let resolved=false;await assert.rejects(searchRegionPair({...q,origin:'Europe',destination:'Asia',airportLimit:21},async()=>{resolved=true;return {airports:[]};},async()=>({offers:[],sources:[]})),/between 4 and 20/);assert.equal(resolved,false);
});

test('region search respects airport budget, uses requested source and filters aggregated results',async()=>{
 const {searchRegion}=await import('../lib/regions.mjs');
 const airports=['AAA','BBB','CCC','DDD','EEE','FFF'].map(code=>({code}));let calls=[];
 const r=await searchRegion({...q,destination:'Europe',source:'ignav',airportLimit:5,filters:{maxStops:0}},async()=>({region:{name:'Europe'},airports,method:'test',moreAvailable:false}),async input=>{calls.push(input);return {offers:[{price:100,currency:'CAD',via:input.destination==='BBB'?['YUL']:[]}],sources:[{provider:'Ignav',status:'ok'}],complete:false};});
 assert.equal(calls.length,5);assert.ok(calls.every(x=>x.source==='ignav'));assert.equal(r.offers.length,4);assert.equal(r.coverage.moreAvailable,true);assert.equal(r.coverage.checked.length,5);assert.equal(r.filterCoverage.stops,1);
});

test('single-region and region-pair provider requests preserve user flight filters',async()=>{
 const {searchRegion,searchRegionPair}=await import('../lib/regions.mjs');
 const filters={maxPrice:500,maxStops:1};
 const coverage=name=>({region:{name},airports:(name==='North'?['AAA','BBB']:['CCC','DDD']).map(code=>({code})),method:'fixture',moreAvailable:false});
 const requests=[];
 await searchRegion({...q,destination:'Europe',filters,airportLimit:4},async()=>coverage('Europe'),async input=>{requests.push(input);return {offers:[],sources:[],complete:false};});
 await searchRegionPair({...q,origin:'North',destination:'South',filters,airportLimit:4},async name=>coverage(name),async input=>{requests.push(input);return {offers:[],sources:[],complete:false};});
 assert.equal(requests.length,6);
 assert.ok(requests.every(input=>JSON.stringify(input.filters)===JSON.stringify(filters)));
});

test('origin region search substitutes each bounded candidate while preserving destination', async()=>{
 const {searchRegion}=await import('../lib/regions.mjs');
 const airports=[{code:'AAA'},{code:'BBB'},{code:'CCC'}];let calls=[];
 const result=await searchRegion({...q,origin:'Example region',airportLimit:4},async()=>({region:{name:'Example region'},airports,method:'test',moreAvailable:false}),async input=>{calls.push(input);return {offers:[],sources:[{provider:'Example',status:'ok'}],complete:false};},'origin');
 assert.deepEqual(calls.map(input=>input.origin),['AAA','BBB','CCC']);
 assert.ok(calls.every(input=>input.destination==='BCN'));
 assert.equal(result.coverage.side,'origin');
 assert.equal(result.query.origin,'Example region');
});

test('region pair search checks the bounded Cartesian airport set and reports coverage', async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');
 const areas={North:{region:{name:'North'},airports:[{code:'AAA'},{code:'BBB'}],method:'origin evidence',moreAvailable:true},South:{region:{name:'South'},airports:[{code:'CCC'},{code:'DDD'}],method:'destination evidence',moreAvailable:false}};
 const calls=[];
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>areas[name],async input=>{calls.push([input.origin,input.destination]);return {offers:[{price:100,currency:'CAD'}],sources:[{provider:'Example',status:'ok'}],complete:false};});
 assert.deepEqual(calls,[['AAA','CCC'],['AAA','DDD'],['BBB','CCC'],['BBB','DDD']]);
 assert.equal(result.coverage.side,'both');assert.equal(result.coverage.pairsPlanned,4);assert.equal(result.coverage.pairsChecked,4);
 assert.equal(result.coverage.origin.moreAvailable,true);assert.equal(result.offers.length,4);
});

test('adult one-way region searches start a later pair while an earlier pair is still pending',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');let releaseSlow,resolveThird;const thirdStarted=new Promise(resolve=>{resolveThird=resolve;}),slow=new Promise(resolve=>{releaseSlow=resolve;});
 const airports={North:{airports:[{code:'AAA'},{code:'BBB'}]},South:{airports:[{code:'CCC'},{code:'DDD'}]}};
 const pending=searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>({region:{name},...airports[name],method:'fixture'}),async input=>{
  if(input.origin==='AAA'&&input.destination==='CCC')return slow;
  if(input.origin==='AAA'&&input.destination==='DDD')return {offers:[],sources:[{provider:'Example',status:'ok'}],complete:false};
  if(input.origin==='BBB'&&input.destination==='CCC')resolveThird();
  return {offers:[],sources:[{provider:'Example',status:'ok'}],complete:false};
 },{allowParallelPairs:true});
 try{
  await Promise.race([thirdStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('third route waited for the first route')),500))]);
 }finally{releaseSlow({offers:[],sources:[{provider:'Example',status:'ok'}],complete:false});}
 const result=await pending;assert.equal(result.coverage.pairConcurrency,2);assert.equal(result.coverage.pairsChecked,4);assert.deepEqual(result.coverage.checked.map(pair=>[pair.origin.code,pair.destination.code]),[['AAA','CCC'],['AAA','DDD'],['BBB','CCC'],['BBB','DDD']]);
});

test('family region pair searches stay sequential to avoid overlapping browser-backed Matrix sessions',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');let active=0,maxActive=0;
 const airports={North:{airports:[{code:'AAA'},{code:'BBB'}]},South:{airports:[{code:'CCC'},{code:'DDD'}]}};
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4,children:1,childrenAges:[7]},async name=>({region:{name},...airports[name],method:'fixture'}),async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(resolve=>setTimeout(resolve,1));active--;return {offers:[],sources:[{provider:'Example',status:'ok'}],complete:false};},{allowParallelPairs:true});
 assert.equal(maxActive,1);assert.equal(result.coverage.pairConcurrency,1);assert.equal(result.coverage.pairsChecked,4);
});

test('region pair search stops on provider blocks and reports partial coverage',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');let calls=0;
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>({region:{name},airports:[{code:name==='North'?'AAA':'BBB'},{code:name==='North'?'CCC':'DDD'}],method:'test',moreAvailable:false}),async()=>{calls++;return {offers:[],sources:[{provider:'Example',status:'blocked'}],complete:false};},{allowParallelPairs:true});
 assert.equal(calls,2);assert.equal(result.coverage.pairConcurrency,2);assert.equal(result.coverage.pairsPlanned,4);assert.equal(result.coverage.pairsChecked,2);assert.equal(result.coverage.stoppedBySource,true);
 assert.deepEqual(result.coverage.uncheckedPairs.map(p=>[p.origin.code,p.destination.code]),[['CCC','BBB'],['CCC','DDD']]);
});

test('region coverage records resolved airports excluded by the cap',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>({region:{name},airports:(name==='North'?['AAA','BBB','CCC','DDD']:['EEE']).map(code=>({code})),method:'test',moreAvailable:true}),async()=>({offers:[],sources:[{provider:'Example',status:'ok'}],complete:false}));
 assert.deepEqual(result.coverage.origin.uncheckedAirports.map(a=>a.code),[]);
 assert.deepEqual(result.coverage.uncheckedPairs,[]);
 assert.equal(result.coverage.origin.moreAvailable,true);
});

test('region coverage reports resolver-cap airports alongside airports omitted by search budget',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>({region:{name},airports:(name==='North'?['AAA','BBB','CCC','DDD']:['EEE','FFF','GGG','HHH']).map(code=>({code})),uncheckedAirports:[{code:name==='North'?'JJJ':'KKK'}],moreAvailable:true,countries:[{name:'Example',iso:'EX'}],countriesMoreAvailable:true,method:'test'}),async()=>({offers:[],sources:[{provider:'Example',status:'ok'}],complete:false}));
 assert.deepEqual(result.coverage.origin.uncheckedAirports.map(a=>a.code),['JJJ']);
 assert.deepEqual(result.coverage.destination.uncheckedAirports.map(a=>a.code),['KKK']);
 assert.equal(result.coverage.origin.countriesMoreAvailable,true);
 assert.equal(result.coverage.pairsPlanned,16);
 assert.equal(result.coverage.uncheckedAirportPairs.length,9);
 assert.ok(result.coverage.uncheckedAirportPairs.some(pair=>pair.origin.code==='JJJ'&&pair.destination.code==='KKK'));
});

test('large outside-limit airport-pair coverage uses complete code sets and an exact bounded count',async()=>{
 const {searchRegionPair}=await import('../lib/regions.mjs');
 const origins=Array.from({length:40},(_,index)=>`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`);
 const destinations=Array.from({length:40},(_,index)=>`B${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`);
 const result=await searchRegionPair({...q,origin:'North',destination:'South',airportLimit:4},async name=>({region:{name},airports:(name==='North'?origins:destinations).map(code=>({code})),uncheckedAirports:[],moreAvailable:true,method:'bounded test directory'}),async()=>({offers:[],sources:[{provider:'Example',status:'ok'}],complete:false}));
 assert.equal(result.coverage.pairsPlanned,16);assert.equal(result.coverage.pairsChecked,16);
 assert.equal(result.coverage.outsideSelectedPairCoverage.knownOriginAirportCount,40);assert.equal(result.coverage.outsideSelectedPairCoverage.knownDestinationAirportCount,40);
 assert.equal(result.coverage.outsideSelectedPairCoverage.knownAirportPairs,1600);assert.equal(result.coverage.outsideSelectedPairCoverage.selectedAirportPairs,16);
 assert.equal(result.coverage.outsideSelectedPairCoverage.outsideSelectedPairs,1584);assert.equal(result.coverage.outsideSelectedPairCoverage.enumeratedPairs,0);
 assert.equal(result.coverage.uncheckedAirportPairs.length,0,'large products are summarized instead of creating thousands of duplicate pair objects');
 assert.equal(result.coverage.origin.uncheckedAirports.length,36);assert.equal(result.coverage.destination.uncheckedAirports.length,36);
 assert.equal(result.coverage.outsideSelectedPairCoverage.resolverMayHaveMore,true);
});

test('Europe resolver returns popularity-ranked continental airports from a bounded query',async()=>{
 const {lookupRegion,searchRegion}=await import('../lib/regions.mjs');let airportQuery;let calls=0;
 const catalog=[{m49Code:'250',iso2:'FR',regionCode:'150',subregionCode:'155',intermediateCode:null,name:'France'},{m49Code:'276',iso2:'DE',regionCode:'150',subregionCode:'155',intermediateCode:null,name:'Germany'},{m49Code:'724',iso2:'ES',regionCode:'150',subregionCode:'039',intermediateCode:null,name:'Spain'},{m49Code:'380',iso2:'IT',regionCode:'150',subregionCode:'039',intermediateCode:null,name:'Italy'},{m49Code:'643',iso2:'RU',regionCode:'150',subregionCode:'151',intermediateCode:null,name:'Russian Federation'}],qids={FR:'Q142',DE:'Q183',ES:'Q29',IT:'Q38',RU:'Q159'};
 const rows=[
  ['AAA','Airport A','France','FR','Q1','300','Point(2 48)'],
  ['BBB','Airport B','Germany','DE','Q2','250','Point(13 52)'],
  ['CCC','Airport C','Spain','ES','Q3','200','Point(-3 40)'],
  ['DDD','Airport D','Italy','IT','Q4','120','Point(12 42)'],
  ['GGG','Airport G','France','FR','Q7','110','Point(3 49)'],
  ['HHH','Airport H','Germany','DE','Q8','100','Point(10 51)'],
  ['III','Airport I','Spain','ES','Q9','90','Point(-4 41)'],
  ['JJJ','Airport J','Italy','IT','Q10','80','Point(11 43)'],
  ['EEE','Far eastern airport','Russia','RU','Q5','999','Point(46 50)'],
  ['FFF','Southern airport','Spain','ES','Q6','999','Point(0 20)'],
  ['BBB','Airport B','Germany','DE','Q2','240','Point(13 52)'],
 ].map(([code,airportName,country,iso,id,passengers,coord])=>({airport:{value:`http://www.wikidata.org/entity/${id}`},airportLabel:{value:airportName},code:{value:code},country:{value:'http://www.wikidata.org/entity/Q999'},countryLabel:{value:country},iso:{value:iso},coord:{value:coord},passengers:{value:passengers}}));
 const result=await lookupRegion('Europe',async url=>{calls++;const query=new URL(url).searchParams.get('query');if(query.includes('?iso')){const isos=[...query.matchAll(/"([A-Z]{2})"/g)].map(([,iso])=>iso);return {results:{bindings:isos.filter(iso=>qids[iso]).map(iso=>({country:{value:`https://www.wikidata.org/entity/${qids[iso]}`},countryLabel:{value:iso},iso:{value:iso}}))}};}airportQuery=query;return {results:{bindings:rows}};},{fetchM49Catalog:async()=>catalog});
 assert.equal(calls,2);assert.equal(result.airports.length,5);assert.deepEqual(result.excludedAirports.map(({code})=>code),['AAA','BBB','CCC']);assert.deepEqual(result.airports.map(({code,passengers})=>[code,passengers]),[['DDD',120],['GGG',110],['HHH',100],['III',90],['JJJ',80]]);assert.equal(result.countries.length,5);assert.equal(result.moreAvailable,false);
 const searched=[];await searchRegion({...q,destination:'Europe',airportLimit:4},async()=>result,async input=>{searched.push(input.destination);return {offers:[],sources:[],complete:false};});assert.deepEqual(searched,['DDD','GGG','HHH','III']);
 assert.match(airportQuery,/wd:Q142/);assert.match(airportQuery,/wd:Q159/);assert.match(airportQuery,/P3872/);assert.match(airportQuery,/GROUP BY/);assert.match(airportQuery,/LIMIT 5000/);
});
