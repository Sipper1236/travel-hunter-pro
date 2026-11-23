import test from 'node:test';
import assert from 'node:assert/strict';
import {googleManualUrl,manualFlightChecklist} from '../lib/manual-flight-search.mjs';
const query={origin:'Canada',destination:'Europe',originAirports:['YHZ'],destinationAirports:['IST','LHR'],tripType:'round-trip',start:'2027-04-15',end:'2027-04-16',nightsMin:5,nightsMax:7,cabin:'premium_economy',adults:1,children:1,childrenAges:[11],filters:{maxStops:1,minLayover:60,maxLayover:180,maxPrice:4000,airlinesExclude:['XX'],countriesExclude:['US']}};
const selection={origin:'YHZ',destination:'IST',date:'2027-04-16',returnDate:'2027-04-23'};
test('manual checklist preserves exact regional date pair, party, cabin and filters without exporting them',()=>{
 const text=manualFlightChecklist(query,selection);
 for(const fragment of ['YHZ → IST','2027-04-16','2027-04-23','departure ages: 11','premium economy','60 minimum / 180 maximum','Excluded: XX','countries: US','CAD 4000','no fare is imported'])assert.ok(text.includes(fragment),fragment);
 assert.equal(new URL(googleManualUrl).searchParams.get('curr'),'CAD');
 assert.equal(new URL(googleManualUrl).searchParams.has('q'),false);
});
test('manual route and dates cannot silently escape the selected calendar',()=>{
 for(const overrides of [{origin:'YYZ'},{destination:'CDG'},{destination:'YHZ'},{returnDate:'2027-04-24'},{date:'2027-04-17'},{returnDate:null}])assert.throws(()=>manualFlightChecklist(query,{...selection,...overrides}));
});
test('identified checklist shows actual date-specific ages and seating/guardian assignments without DOBs',()=>{
 const {adults,children,childrenAges,...base}=query;
 const input={...base,travelers:[{id:'guardian',birthDate:'1990-01-01'},{id:'child',birthDate:'2015-04-20',guardianId:'guardian'},{id:'baby',birthDate:'2026-07-01',infantSeating:'lap',guardianId:'guardian'}]};
 const text=manualFlightChecklist(input,selection);
 assert.match(text,/age 11 at departure, 12 at return/);
 assert.match(text,/infant on lap, guardian traveler 1/);
 for(const person of input.travelers)assert.ok(!text.includes(person.birthDate));
 assert.throws(()=>manualFlightChecklist({...input,travelers:input.travelers.map(person=>person.id==='baby'?{...person,guardianId:'child'}:person)},selection),/guardian/);
});
