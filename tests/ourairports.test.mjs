import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAirportCsv,mergeAirportSources} from '../lib/ourairports.mjs';
test('OurAirports parser handles quoted names and rejects closed, unscheduled and malformed records',()=>{
 const header='ident,name,iata_code,iso_country,latitude_deg,longitude_deg,scheduled_service,type\n';
 const airports=parseAirportCsv(header+'TEST,"Name, with ""quotes""",AAA,CA,44,-63,yes,large_airport\nC,Closed,BBB,CA,44,-63,yes,closed\nU,Unscheduled,CCC,CA,44,-63,no,small_airport\nX,Invalid,DDD,CA,999,-63,yes,medium_airport\n');
 assert.equal(airports.length,1);assert.equal(airports[0].name,'Name, with "quotes"');assert.equal(airports[0].iso,'CA');
 assert.throws(()=>parseAirportCsv('broken'),/schema/);
});
test('dual directories retain distinct candidates, merge duplicate codes and allow either source to fail',()=>{
 const primary={airports:[{code:'AAA',name:'Our A',type:'large_airport'},{code:'BBB',name:'Our B'}],method:'M49'};
 const secondary={airports:[{code:'AAA',name:'Wiki A',passengers:200},{code:'CCC',name:'Wiki C',passengers:100}],method:'Wiki'};
 const merged=mergeAirportSources(primary,secondary);assert.deepEqual(merged.airports.map(a=>a.code),['AAA','CCC','BBB']);assert.deepEqual(merged.airports[0].sources,['OurAirports','Wikidata']);
 assert.equal(mergeAirportSources(primary,null).directorySources[1].status,'unavailable');assert.equal(mergeAirportSources(null,secondary).airports.length,2);assert.throws(()=>mergeAirportSources(null,null),/Neither/);
});
test('dual-directory merge cannot reintroduce Europe traffic exclusions from OurAirports',()=>{
 const primary={airports:['IST','LHR','CDG','AMS'].map((code,index)=>({code,name:code,type:'large_airport'})),method:'OurAirports'};
 const secondary={airports:[{code:'AMS',passengers:300},{code:'MAD',passengers:200},{code:'FRA',passengers:100}],excludedAirports:['IST','LHR','CDG'].map(code=>({code})),geographicExcludedAirportCount:1,geographicExcludedAirports:[{code:'UFA'}],method:'Wikidata'};
 const merged=mergeAirportSources(primary,secondary,{strictPopularity:true});
 assert.deepEqual(merged.airports.map(airport=>airport.code),['AMS','MAD','FRA']);
 assert.deepEqual(merged.excludedAirports.map(airport=>airport.code),['IST','LHR','CDG']);
 assert.equal(merged.geographicExcludedAirportCount,1);assert.deepEqual(merged.geographicExcludedAirports.map(airport=>airport.code),['UFA']);
});
test('Europe puts airports without passenger evidence after popularity-ranked airports',()=>{
 const primary={airports:[{code:'AAA',name:'Size-large airport',type:'large_airport'},{code:'IST',name:'Top candidate',type:'large_airport'}],method:'OurAirports'};
 const secondary={airports:[{code:'BBB',name:'Measured passenger rank 4',passengers:100}],excludedAirports:[{code:'IST'}],method:'Wikidata'};
 const merged=mergeAirportSources(primary,secondary,{strictPopularity:true});
 assert.deepEqual(merged.airports.map(airport=>airport.code),['BBB','AAA']);
 assert.match(merged.method,/candidates without traffic data follow alphabetically and are not described as popularity-ranked/);
});
test('Europe merged coverage preserves popularity exclusion shortfall metadata for the UI',()=>{
 const primary={airports:[{code:'AMS',name:'Amsterdam',type:'large_airport'}],method:'OurAirports'};
 const secondary={airports:[{code:'AMS',name:'Amsterdam',passengers:100}],excludedAirports:[{code:'LHR',passengers:1000}],popularityExclusionLimit:3,popularityRankedCandidates:1,popularityExclusionShortfall:2,method:'Wikidata'};
 const merged=mergeAirportSources(primary,secondary,{strictPopularity:true});
 assert.equal(merged.popularityExclusionLimit,3);
 assert.equal(merged.popularityRankedCandidates,1);
 assert.equal(merged.popularityExclusionShortfall,2);
 assert.deepEqual(merged.excludedAirports.map(airport=>airport.code),['LHR']);
});
test('Europe merged coverage reports a full popularity shortfall when Wikidata is unavailable',()=>{
 const primary={airports:[{code:'AMS',name:'Amsterdam',type:'large_airport'}],method:'OurAirports'};
 const merged=mergeAirportSources(primary,null,{strictPopularity:true});
 assert.equal(merged.popularityExclusionLimit,3);
 assert.equal(merged.popularityRankedCandidates,0);
 assert.equal(merged.popularityExclusionShortfall,3);
 assert.deepEqual(merged.excludedAirports,[]);
 assert.equal(merged.directorySources[1].status,'unavailable');
});
