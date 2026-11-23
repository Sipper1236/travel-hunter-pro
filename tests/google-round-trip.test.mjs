import test from 'node:test';
import assert from 'node:assert/strict';
import {googleRoundTripParty,parseGoogleRpcFrames,normalizeGoogleRoundTrip} from '../lib/google-round-trip.mjs';
const input={origin:'YHZ',destination:'LHR',date:'2099-04-15',returnDate:'2099-04-25',tripType:'round-trip',cabin:'economy',adults:1,children:1,childrenAges:[8]};
const zones={byCode:new Map([['YHZ',{timeZone:'America/Halifax'}],['LHR',{timeZone:'Europe/London'}]]),sourceUrl:'https://example.test/licensed-zones',retrievedAt:new Date().toISOString()};
function segment(from,to,date,dep,arr,number){const row=[];row[3]=from;row[6]=to;row[8]=dep;row[10]=arr;row[11]=360;row[13]=2;row[15]=[['LH',number]];row[16]=1;row[20]=date;row[21]=date;row[22]=['AC',number];return row;}
function leg(from,to,date,dep,arr,number){const row=[];row[1]=['Air Canada'];row[2]=[segment(from,to,date,dep,arr,number)];row[3]=from;row[4]=date;row[5]=dep;row[6]=to;row[7]=date;row[8]=arr;row[9]=360;return row;}
function seller(price,type=0,refs=[['AC','860'],['AC','861']]){const row=[];row[0]=type;row[1]=[['AC','Air Canada']];row[3]=refs;row[7]=[[null,price],'opaque-source-price-reference'];if(type===2)row[6]=['test-phone','test-phone'];else row[5]=['aircanada.com',null,['https://www.google.com/travel/clk/f',[]]];return row;}
function fixture(){const data=[];data[0]=[seller(1200,2),seller(1250)];data[5]=[[leg('YHZ','LHR',[2099,4,15],[8],[18],'860'),leg('LHR','YHZ',[2099,4,25],[10],[12],'861')]];return [[],data];}
const rpc=data=>")]}'\n\n"+JSON.stringify([['wrb.fr',null,JSON.stringify(data)]])+'\n';
const evidence={currency:'CAD',sourceUrl:'https://www.google.com/travel/flights/booking?tfs=selected-query&tfu=selected-flights&curr=CAD&tracking=discard',text:'Round tripEconomy\n2 passengers\n$1,200\nLowest total price\nPrices include required taxes + fees for 1 adult and 1 child. Optional charges may apply.'};
const normalize=(data=fixture(),query=input,proof=evidence,extra={})=>normalizeGoogleRoundTrip(rpc(data),query,{evidence:proof,timezones:zones,...extra});

test('native Google final seller quotes retain a group amount, both legs, exact flights and fulfillment',()=>{
 const result=normalize();assert.equal(result.offers.length,2);
 const [phone,online]=result.offers;assert.equal(phone.price,1200);assert.equal(online.price,1250);
 assert.equal(phone.googleBookingMode,'phone');assert.match(phone.bookingStatus,/calling/);assert.equal(online.googleBookingMode,'online');
 assert.equal(phone.segments[0].marketing_carrier_code,'AC');assert.equal(phone.inbound.segments[0].flight_number,'861');
 assert.equal(phone.segments[0].departure_time_utc,'2099-04-15T11:00:00Z');assert.equal(phone.timeEvidence.status,'directory_validated');
 assert.equal(new URL(phone.sourceUrl).searchParams.has('tracking'),false);assert.equal(phone.currency,'CAD');
 assert.match(result.limitation,/one fully selected/);
});
test('Google party categories preserve teen counts, exact identities and birthday boundaries',()=>{
 assert.deepEqual(googleRoundTripParty({...input,childrenAges:[15]}),{adults:2,children:0,total:2});
 assert.throws(()=>googleRoundTripParty({...input,childrenAges:[11]}),/birth dates/);
 const {adults,children,childrenAges,...base}=input;
 const people=[{id:'guardian',birthDate:'2070-01-01'},{id:'child',birthDate:'2087-04-20',guardianId:'guardian'}];
 assert.throws(()=>googleRoundTripParty({...base,travelers:people}),/changes fare category/);
 assert.deepEqual(googleRoundTripParty({...base,travelers:people.map(person=>person.id==='child'?{...person,birthDate:'2090-04-20'}:person)}),{adults:1,children:1,total:2});
 for(const change of [{infants:1},{tripType:'one-way'},{cabin:'business'}])assert.throws(()=>googleRoundTripParty({...input,...change}));
 assert.throws(()=>googleRoundTripParty({...base,travelers:[{id:'minor',birthDate:'2084-01-01'}]}),/guardian/);
});
test('outbound-only, wrong-currency, wrong-party and generic search evidence never become return quotes',()=>{
 const missingReturn=fixture();missingReturn[1][5][0].pop();assert.throws(()=>normalize(missingReturn),/complete selected return/);
 for(const proof of [{...evidence,currency:'USD'},{...evidence,text:evidence.text.replace('1 child','2 children')},{...evidence,text:evidence.text.replace('2 passengers','1 passenger')},{...evidence,text:evidence.text.replace('Lowest total price','Per-person price')},{...evidence,sourceUrl:'https://www.google.com/travel/flights/search?tfs=query'}])assert.throws(()=>normalize(fixture(),input,proof));
 const wrongDate=fixture();wrongDate[1][5][0][1]=leg('LHR','YHZ',[2099,4,26],[10],[12],'861');assert.throws(()=>normalize(wrongDate),/canonical/);
});
test('native Google rejects mixed cabins, missing flight evidence and fabricated source durations',()=>{
 for(const mutate of [data=>data[1][5][0][0][2][0][16]=2,data=>data[1][5][0][0][2][0][22]=null,data=>data[1][5][0][0][2][0][11]=300,data=>data[1][5][0][0][9]=300,data=>data[1][5][0][0][4]=[2099,2,30]]){const data=fixture();mutate(data);assert.throws(()=>normalize(data));}
 assert.throws(()=>normalize(fixture(),input,evidence,{timezones:{...zones,byCode:new Map()}}),/timezone evidence/);
 assert.throws(()=>normalize(fixture(),input,evidence,{observedAt:new Date(Date.now()-3600_000).toISOString()}),/canonical/);
});
test('seller flight references must match selected marketing or observed codeshare identities',()=>{
 const data=fixture();data[1][0]=[seller(1300,0,[['LH','860'],['LH','861']])];assert.equal(normalize(data).offers.length,1);
 data[1][0][0][3][1]=['XX','861'];assert.throws(()=>normalize(data),/no attributable/);
});
test('a birthday on the observed return arrival date cannot escape the party check',()=>{
 const {adults,children,childrenAges,...base}=input;
 const query={...base,travelers:[{id:'guardian',birthDate:'2070-01-01'},{id:'child',birthDate:'2087-04-26',guardianId:'guardian'}]};
 const data=fixture(),inbound=data[1][5][0][1];
 inbound[7]=[2099,4,26];inbound[9]=1800;inbound[2][0][21]=[2099,4,26];inbound[2][0][11]=1800;
 assert.throws(()=>normalize(data,query),/observed flight date/);
});
test('native RPC parsing rejects truncation, invalid payloads and oversized bodies',()=>{
 assert.equal(parseGoogleRpcFrames(rpc(fixture())).length,1);
 for(const raw of [rpc(fixture()).slice(0,-8),'not a stream',")]}'\n"+JSON.stringify([['wrb.fr',null,'broken json']]),")]}'\n"+' '.repeat(8_000_000)])assert.throws(()=>parseGoogleRpcFrames(raw));
});
