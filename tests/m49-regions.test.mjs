import test from 'node:test';
import assert from 'node:assert/strict';
import {m49PolicyFor,parseM49Catalog,selectM49Areas,M49_POLICY_VERSION} from '../lib/m49-regions.mjs';
import {lookupRegion} from '../lib/regions.mjs';

const area=(m49Code,iso2,regionCode,subregionCode,intermediateCode,name)=>({m49Code,iso2,regionCode,subregionCode,intermediateCode,name});
const samples=[
 area('840','US','019','021',null,'United States of America'),area('124','CA','019','021',null,'Canada'),area('304','GL','019','021',null,'Greenland'),area('666','PM','019','419','029','Saint Pierre and Miquelon'),
 area('484','MX','019','419','013','Mexico'),area('320','GT','019','419','013','Guatemala'),area('076','BR','019','419','005','Brazil'),area('818','EG','002','015',null,'Egypt'),area('682','SA','142','145',null,'Saudi Arabia'),
 area('504','MA','002','015',null,'Morocco'),area('566','NG','002','202',null,'Nigeria'),area('710','ZA','002','202','018','South Africa'),
 area('156','CN','142','030',null,'China'),area('356','IN','142','034',null,'India'),area('360','ID','142','035',null,'Indonesia'),area('398','KZ','142','143',null,'Kazakhstan'),
 area('826','GB','150','154',null,'United Kingdom'),area('643','RU','150','151',null,'Russian Federation'),
 area('036','AU','009','053',null,'Australia'),area('554','NZ','009','053',null,'New Zealand'),area('598','PG','009','054',null,'Papua New Guinea'),area('242','FJ','009','054',null,'Fiji'),area('583','FM','009','057',null,'Micronesia'),area('882','WS','009','061',null,'Samoa'),
 area('196','CY','142','145',null,'Cyprus'),area('368','IQ','142','145',null,'Iraq'),area('376','IL','142','145',null,'Israel'),area('400','JO','142','145',null,'Jordan'),area('422','LB','142','145',null,'Lebanon'),area('275','PS','142','145',null,'State of Palestine'),area('760','SY','142','145',null,'Syrian Arab Republic'),area('792','TR','142','145',null,'Türkiye'),area('364','IR','142','034',null,'Iran'),area('031','AZ','142','145',null,'Azerbaijan'),area('051','AM','142','145',null,'Armenia'),area('268','GE','142','145',null,'Georgia'),area('048','BH','142','145',null,'Bahrain'),area('414','KW','142','145',null,'Kuwait'),area('512','OM','142','145',null,'Oman'),area('634','QA','142','145',null,'Qatar'),area('784','AE','142','145',null,'United Arab Emirates'),area('887','YE','142','145',null,'Yemen'),
];

test('UN M49 parser extracts hierarchy and country/area ISO codes from the English table',()=>{
 const html='<table id="downloadTableEN"><tr><td>Global</td></tr><tr><td>001</td><td>World</td><td>019</td><td>Americas</td><td>419</td><td>Latin America and the Caribbean</td><td>013</td><td>Central America</td><td>México</td><td>484</td><td>MX</td><td>MEX</td></tr></table>';
 const catalog=parseM49Catalog(html,{minimumRecords:1});assert.deepEqual(catalog,[{regionCode:'019',regionName:'Americas',subregionCode:'419',subregionName:'Latin America and the Caribbean',intermediateCode:'013',intermediateName:'Central America',name:'México',m49Code:'484',iso2:'MX',iso3:'MEX'}]);
});

test('named M49 unions cover the audited policy, including the Middle East composites',()=>{
 const north=selectM49Areas(samples,m49PolicyFor('North America').scope);assert.deepEqual(north.map(x=>x.m49Code),['840','124','304','666','484','320']);
 const greenland=selectM49Areas(samples,m49PolicyFor('Greenland & St. Pierre').scope);assert.deepEqual(greenland.map(x=>x.m49Code),['304','666']);
 assert.match(m49PolicyFor('Gulf States').note,/Gulf Cooperation Council/);
 const middleEast=selectM49Areas(samples,m49PolicyFor('Middle East').scope).map(x=>x.iso2).sort();assert.ok(middleEast.includes('EG'));assert.ok(middleEast.includes('IR'));assert.ok(middleEast.includes('TR'));assert.ok(middleEast.includes('CY'));
 const levant=selectM49Areas(samples,m49PolicyFor('Levant & Beyond').scope).map(x=>x.iso2).sort();assert.deepEqual(levant,['CY','EG','IL','IQ','JO','LB','PS','SY','TR']);
 assert.match(m49PolicyFor('Middle East').note,/plus Egypt and Iran/);assert.match(m49PolicyFor('Levant & Beyond').note,/Gulf states and Iran are excluded/);assert.equal(m49PolicyFor('Levant and Beyond'),m49PolicyFor('Levant & Beyond'));assert.equal(M49_POLICY_VERSION,'UNSD-M49-2026-10+TH-2026-11.1');
});

test('common region aliases use explicit cited scopes instead of generic Wikidata membership',()=>{
 const sameScope=(a,b)=>assert.deepEqual(m49PolicyFor(a).scope,m49PolicyFor(b).scope);
 sameScope('Northern Europe','Northern Europe / Scandinavia');
 sameScope('Southern Europe','Southern Europe / Mediterranean');
 sameScope('Oceania','Oceania / South Pacific');
 sameScope('South Pacific','Oceania / South Pacific');
 sameScope('GCC','Gulf States');sameScope('GCC countries','Gulf States');sameScope('Gulf Cooperation Council','Gulf States');
 const nordic=m49PolicyFor('Scandinavia');
 assert.deepEqual([...nordic.scope.iso2].sort(),['AX','DK','FI','FO','GL','IS','NO','SE']);
 assert.match(nordic.note,/Nordic Council.*eight-entity/);assert.match(nordic.sourceUrl,/norden\.org/);
 const mediterranean=m49PolicyFor('Mediterranean');
 assert.deepEqual([...mediterranean.scope.iso2].sort(),['AL','BA','CY','DZ','EG','ES','FR','GR','HR','IL','IT','LB','LY','MA','MC','ME','MT','SI','SY','TN','TR']);
 assert.match(mediterranean.note,/21 state parties.*not this country list|21 state parties.*country list/i);assert.match(mediterranean.sourceUrl,/unep\.org/);
 assert.match(m49PolicyFor('Pacific Islands').note,/Melanesia, Micronesia and Polynesia/);
});

test('all 28 work.md geographic labels have bounded named policies',()=>{
 const labels=['North America','United States','Canada','Greenland & St. Pierre','Latin America & The Caribbean','Central America & Mexico','South America','The Caribbean','Europe','Western Europe','Eastern Europe','Northern Europe / Scandinavia','Southern Europe / Mediterranean','Middle East','Gulf States','Levant & Beyond','Africa','North Africa','Sub-Saharan Africa','Southern Africa','Asia','East Asia','Southeast Asia','South Asia','Central Asia','Oceania / South Pacific','Australia & New Zealand','Pacific Islands'];
  assert.equal(labels.length,28);for(const label of labels){assert.ok(m49PolicyFor(label),`missing policy for ${label}`);assert.ok(m49PolicyFor(label).scope,`unbounded policy for ${label}`);}
 assert.match(m49PolicyFor('United States').note,/territories are not included/);assert.ok(m49PolicyFor('Gulf States').sourceUrl);
});

test('overlapping region policies preserve their declared M49 area membership',()=>{
 const codes=label=>selectM49Areas(samples,m49PolicyFor(label).scope).map(item=>item.iso2).filter(Boolean).sort();
 assert.deepEqual(codes('North America'),['CA','GL','GT','MX','PM','US']);
 assert.deepEqual(codes('Latin America & The Caribbean'),['BR','GT','MX','PM']);
 assert.deepEqual(codes('Central America & Mexico'),['GT','MX']);
 assert.deepEqual(codes('The Caribbean'),['PM']);
 assert.deepEqual(codes('South America'),['BR']);
 assert.deepEqual(codes('Africa'),['EG','MA','NG','ZA']);
 assert.deepEqual(codes('North Africa'),['EG','MA']);
 assert.deepEqual(codes('Sub-Saharan Africa'),['NG','ZA']);
 assert.deepEqual(codes('Southern Africa'),['ZA']);
 assert.ok(codes('Europe').includes('GB'));assert.ok(!codes('Europe').includes('TR'));
 assert.ok(codes('Asia').includes('TR'));assert.ok(codes('Asia').includes('IR'));assert.ok(!codes('Asia').includes('EG'));
 assert.ok(codes('Middle East').includes('EG'));assert.ok(codes('Middle East').includes('IR'));assert.ok(codes('Middle East').includes('TR'));
 assert.deepEqual(codes('Australia & New Zealand'),['AU','NZ']);
 assert.deepEqual(codes('Pacific Islands'),['FJ','FM','PG','WS']);
 assert.deepEqual(codes('Oceania / South Pacific'),['AU','FJ','FM','NZ','PG','WS']);
});

test('continental Europe uses M49 country scope before applying airport geography and popularity exclusions',async()=>{
 const catalog=[
  area('826','GB','150','154',null,'United Kingdom'),area('250','FR','150','155',null,'France'),
  area('528','NL','150','155',null,'Netherlands'),area('276','DE','150','155',null,'Germany'),
  area('643','RU','150','151',null,'Russian Federation'),area('792','TR','142','145',null,'Türkiye'),
 ];
 const qids={GB:'Q145',FR:'Q142',NL:'Q55',DE:'Q183',RU:'Q159'};let airportQuery='';const queries=[];
 const binding=(code,country,passengers,coord)=>({airport:{value:`https://www.wikidata.org/entity/Q${code}`},airportLabel:{value:`Airport ${code}`},code:{value:code},countryLabel:{value:country},coord:{value:coord},passengers:{value:String(passengers)}});
 const fetchJson=async url=>{
  const query=new URL(url).searchParams.get('query');queries.push(query);
  if(query.includes('?iso')){const isos=[...query.matchAll(/"([A-Z]{2})"/g)].map(([,iso])=>iso);return {results:{bindings:isos.filter(iso=>qids[iso]).map(iso=>({country:{value:`https://www.wikidata.org/entity/${qids[iso]}`},countryLabel:{value:iso},iso:{value:iso}}))}};}
  airportQuery=query;
  return {results:{bindings:[
   binding('LHR','United Kingdom',1000,'Point(-0.45 51.47)'),binding('CDG','France',900,'Point(2.55 49.01)'),
   binding('AMS','Netherlands',800,'Point(4.76 52.31)'),binding('FRA','Germany',700,'Point(8.56 50.03)'),
   binding('SVO','Russian Federation',650,'Point(37.41 55.97)'),binding('UFA','Russian Federation',600,'Point(56.07 54.56)'),binding('UNK','France',50,null),
  ]}};
 };
 const result=await lookupRegion('Europe',fetchJson,{fetchM49Catalog:async()=>catalog});
 assert.equal(queries.length,2);
 assert.match(queries[0],/"GB"/);assert.match(queries[0],/"RU"/);assert.doesNotMatch(queries[0],/"TR"/);
 assert.match(airportQuery,/wd:Q145/);assert.match(airportQuery,/wd:Q159/);assert.match(airportQuery,/wdt:P31\/wdt:P279\* wd:Q1248784/);
 assert.deepEqual(result.excludedAirports.map(({code})=>code),['LHR','CDG','AMS']);
 assert.deepEqual(result.airports.map(({code})=>code),['FRA','SVO']);
 assert.equal(result.airports.some(({code})=>code==='UFA'),false);
 assert.equal(result.geographicExcludedAirportCount,1);assert.deepEqual(result.geographicExcludedAirports.map(({code})=>code),['UFA']);
 assert.equal(result.geographyUnknownAirportCount,1);assert.deepEqual(result.geographyUnknownAirports.map(({code})=>code),['UNK']);
 assert.equal(result.region.policyVersion,`${M49_POLICY_VERSION}+airport-box-v1`);
 assert.match(result.method,/UNSD-M49/);assert.match(result.method,/coordinate box/);
});

test('Europe excludes only traffic-ranked airports and preserves airports with unknown popularity',async()=>{
 const catalog=[area('826','GB','150','154',null,'United Kingdom'),area('250','FR','150','155',null,'France'),area('528','NL','150','155',null,'Netherlands'),area('276','DE','150','155',null,'Germany')],qids={GB:'Q145',FR:'Q142',NL:'Q55',DE:'Q183'};
 const binding=(code,country,passengers)=>({airport:{value:`https://www.wikidata.org/entity/Q${code}`},airportLabel:{value:`Airport ${code}`},code:{value:code},countryLabel:{value:country},coord:{value:'Point(5 50)'},...(passengers===undefined?{}:{passengers:{value:String(passengers)}})});
 const fetchJson=async url=>{const query=new URL(url).searchParams.get('query');if(query.includes('?iso')){const isos=[...query.matchAll(/"([A-Z]{2})"/g)].map(([,iso])=>iso);return {results:{bindings:isos.filter(iso=>qids[iso]).map(iso=>({country:{value:`https://www.wikidata.org/entity/${qids[iso]}`},countryLabel:{value:iso},iso:{value:iso}}))}};}return {results:{bindings:[binding('LHR','United Kingdom',1000),binding('AMS','Netherlands'),binding('CDG','France'),binding('FRA','Germany')]}};};
 const result=await lookupRegion('Europe',fetchJson,{fetchM49Catalog:async()=>catalog});
 assert.deepEqual(result.excludedAirports.map(({code})=>code),['LHR']);assert.deepEqual(result.airports.map(({code})=>code),['AMS','CDG','FRA']);
 assert.equal(result.popularityExclusionLimit,3);assert.equal(result.popularityRankedCandidates,1);assert.equal(result.popularityExclusionShortfall,2);
 assert.match(result.method,/unknown-traffic airports are retained/i);
});

test('M49 resolver queries exactly selected ISO countries and discloses scope policy and unresolved areas',async()=>{
 const calls=[];const isoQids={US:'Q30',CA:'Q16',GL:'Q223',PM:'Q34617'};
 const fetchJson=async url=>{const query=new URL(url).searchParams.get('query');calls.push(query);if(query.includes('?iso'))return {results:{bindings:Object.entries(isoQids).map(([iso,id])=>({country:{value:`https://www.wikidata.org/entity/${id}`},countryLabel:{value:iso},iso:{value:iso}}))}};return {results:{bindings:[{airport:{value:'https://www.wikidata.org/entity/Q1'},airportLabel:{value:'Example Airport'},code:{value:'AAA'},countryLabel:{value:'United States'}}]}};};
 const result=await lookupRegion('North America',fetchJson,{fetchM49Catalog:async()=>samples});
 assert.equal(calls.length,2);assert.match(calls[0],/"US"/);assert.match(calls[0],/"CA"/);assert.match(calls[0],/"GL"/);assert.match(calls[0],/"PM"/);assert.doesNotMatch(calls[0],/"EG"/);assert.match(calls[1],/VALUES \?country \{ wd:Q30 wd:Q16 wd:Q223 wd:Q34617 \}/);
 assert.equal(result.region.policyVersion,M49_POLICY_VERSION);assert.equal(result.countries.length,4);assert.equal(result.airports[0].code,'AAA');assert.match(result.method,/UNSD-M49/);
});

test('Middle East and Levant policies query exactly their declared countries',async()=>{
 const queried=[];const fetchJson=async url=>{const query=url.searchParams.get('query');if(query.includes('?iso')){const isos=[...query.matchAll(/"([A-Z]{2})"/g)].map(([,iso])=>iso);queried.push(isos);return {results:{bindings:isos.map((iso,index)=>({country:{value:`https://www.wikidata.org/entity/Q${1000+index}`},countryLabel:{value:iso},iso:{value:iso}}))}};}return {results:{bindings:[]}};};
 for(const [label,expected] of [['Middle East',['AM','AZ','BH','CY','EG','GE','IL','IQ','IR','JO','KW','LB','OM','PS','QA','SA','SY','TR','AE','YE']],['Levant & Beyond',['CY','EG','IL','IQ','JO','LB','PS','SY','TR']]]){
  const result=await lookupRegion(label,fetchJson,{fetchM49Catalog:async()=>samples});assert.equal(result.region.name,label);assert.deepEqual(queried.at(-1).sort(),expected.sort());assert.match(result.region.policyNote,/Travel Hunter convention/);
 }
});

test('colloquial Scandinavian and Mediterranean names query only their explicit documented ISO sets',async()=>{
 const calls=[];
 const fetchJson=async url=>{
  const query=url.searchParams.get('query');
  if(query.includes('?iso')){const isos=[...query.matchAll(/"([A-Z]{2})"/g)].map(([,iso])=>iso);calls.push(isos);return {results:{bindings:isos.map((iso,index)=>({country:{value:`https://www.wikidata.org/entity/Q${2000+index}`},countryLabel:{value:iso},iso:{value:iso}}))}};}
  return {results:{bindings:[]}};
 };
 for(const [name,expected] of [['Scandinavia',['AX','DK','FI','FO','GL','IS','NO','SE']],['Mediterranean',['AL','BA','CY','DZ','EG','ES','FR','GR','HR','IL','IT','LB','LY','MA','MC','ME','MT','SI','SY','TN','TR']]]){
  const catalog=[...samples,...expected.map((iso,index)=>area(String(900+index),iso,'000',null,null,iso))];
  const result=await lookupRegion(name,fetchJson,{fetchM49Catalog:async()=>catalog});
  assert.deepEqual(calls.at(-1).sort(),expected.sort());
  assert.equal(result.region.name,name);assert.match(result.region.policyVersion,/TH-2026-11\.1/);
  assert.match(result.region.policyNote,/Travel Hunter convention/);
  assert.match(result.method,/Explicit ISO country\/area membership/);
 }
});

test('M49 lookup discloses a saturated upstream airport batch even when rows are rejected',async()=>{
 const fetchJson=async url=>url.searchParams.get('query').includes('?iso')
  ? {results:{bindings:[{country:{value:'https://www.wikidata.org/entity/Q16'},countryLabel:{value:'Canada'},iso:{value:'CA'}}]}}
  : {results:{bindings:Array.from({length:5000},()=>({code:{value:'invalid'}}))}};
 const result=await lookupRegion('Canada',fetchJson,{fetchM49Catalog:async()=>samples});
 assert.deepEqual(result.airports,[]);
 assert.equal(result.moreAvailable,true);
 assert.equal(result.airportQueryTruncated,true);
 assert.match(result.method,/Additional airports may be omitted/);
});
