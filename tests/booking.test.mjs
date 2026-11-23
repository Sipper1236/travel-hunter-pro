import test from 'node:test';
import assert from 'node:assert/strict';
import {searchBooking,validateHotelSearch} from '../lib/booking.mjs';

const query={airport:'YUL',bookerCountry:'ca',checkin:'2027-04-15',checkout:'2027-04-20',adults:2,adultAges:[35,39],rooms:1,childrenAges:[12],minStars:4};
const destination={city:'Montréal',cityId:'Q340',countryCode:'CA',countryName:'Canada',airport:'YUL',cityUrl:'https://www.wikidata.org/wiki/Q340'};
const property=(overrides={})=>({id:101,accommodation_status:'open',name:{'en-ca':'Test Hotel'},rating:{stars:4,stars_type:'official'},location:{city:-2140479,country:'ca'},url:'https://www.booking.com/hotel/ca/test-hotel.html',...overrides});
const offerRow=(overrides={})=>({id:101,currency:'CAD',price:{book:200,total:210,extra_charges:{included:10,excluded:0}},products:[{id:'101_1',number_of_adults:2,children:[12],price:{total:210,extra_charges:{conditional:[]}}}],url:'https://www.booking.com/hotel/ca/test-hotel.html',...overrides});
const propertyRow=id=>offerRow({id,url:`https://www.booking.com/hotel/ca/test-hotel-${id}.html`});
const propertyDetail=id=>property({id,url:`https://www.booking.com/hotel/ca/test-hotel-${id}.html`,name:{'en-ca':`Test Hotel ${id}`}});
function fixtureFetcher({autocomplete=[{id:-2140479,type:'city',name:'Montréal'}],rows=[offerRow()],details=[property()],nextPage=null,searchPages=null,failSearchPage=null,failDetailsPage=null,onRequest=()=>{}}={}){
 let detailPage=0;
 return async(url,options)=>{
  const path=new URL(url).pathname;const body=JSON.parse(options.body);onRequest(path,body,options);
  const pageIndex=body.page?1:0,searchPage=searchPages?.[pageIndex];
  if(path.endsWith('/accommodations/search')&&failSearchPage===pageIndex+1)return new Response('{}',{status:429});
  if(path.endsWith('/accommodations/details')&&failDetailsPage===++detailPage)return new Response('{}',{status:429});
  const data=path.endsWith('/common/autocomplete')?autocomplete:path.endsWith('/accommodations/search')?(searchPage?.rows??rows):details;
  const responseNextPage=searchPage&&Object.hasOwn(searchPage,'nextPage')?searchPage.nextPage:nextPage;
  const metadata={...(responseNextPage!==null&&responseNextPage!==undefined?{next_page:responseNextPage}:{})};
  if(searchPage?.totalResults!==undefined)metadata.total_results=searchPage.totalResults;
  return new Response(JSON.stringify({data,metadata}),{status:200,headers:{'content-type':'application/json'}});
 };
}

test('missing partner credentials fail closed without a network call',async()=>{let calls=0;const result=await searchBooking(query,{token:'',affiliateId:'',destination,fetcher:()=>{calls++;throw Error('unexpected')}});assert.equal(result.status,'unavailable');assert.deepEqual(result.offers,[]);assert.equal(calls,0)});
test('Demand API validates actual child ages and bounded stay dates',()=>{
 assert.throws(()=>validateHotelSearch({...query,childrenAges:[null]}),/actual age/i);
 assert.throws(()=>validateHotelSearch({...query,checkout:'2027-08-01'}),/90 nights/i);
 assert.throws(()=>validateHotelSearch({...query,checkin:'2028-06-01',checkout:'2028-06-05'},'2027-01-01'),/500 days/i);
});
test('partner search resolves Booking city, sends CAD/exact party and imports verified star/property/price details',async()=>{
 const calls=[];const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({onRequest:(path,body)=>calls.push({path,body})}),now:Date.parse('2026-11-07T12:00:00Z')});
 assert.equal(result.status,'complete');assert.equal(result.offers.length,1);assert.equal(result.rejected,0);
 assert.deepEqual(calls.map(item=>item.path),['/3.3/common/autocomplete','/3.3/accommodations/search','/3.3/accommodations/details']);
 assert.deepEqual(calls[0].body,{query:'Montréal',country:'ca',language:'en-ca',filters:{types:['city']}});
 assert.equal(calls[1].body.city,-2140479);assert.equal(calls[1].body.currency,'CAD');assert.equal(calls[1].body.airport,undefined);assert.deepEqual(calls[1].body.guests.children,[12]);assert.deepEqual(calls[1].body.extras,['extra_charges','products']);assert.equal(calls[1].body.rows,30);
 assert.deepEqual(calls[2].body.accommodations,[101]);
 const [offer]=result.offers;assert.equal(offer.stars,4);assert.equal(offer.priceText,'CAD 210.00');assert.equal(offer.displayPriceText,'CAD 200.00');assert.match(offer.taxText,/expected total/);assert.equal(offer.locationEvidence.cityId,'Q340');assert.equal(offer.locationEvidence.status,'verified');assert.equal(offer.stay.childrenAges[0],12);assert.equal(offer.url,'https://www.booking.com/hotel/ca/test-hotel.html?checkin=2027-04-15&checkout=2027-04-20&group_adults=2&no_rooms=1&group_children=1&selected_currency=CAD&age=12');
});
test('Demand API fee text never claims conditional details when amounts are missing or incalculable',async()=>{
 const base={token:'token',affiliateId:'12',destination};
 const listed=await searchBooking(query,{...base,fetcher:fixtureFetcher()});
 assert.match(listed.offers[0].taxText,/No conditional charges were listed in the search response/);
 const missing=offerRow({price:{book:200,total:210,extra_charges:{included:10,excluded:0}},products:[{number_of_adults:2,children:[12],price:{total:210}}]});
 const missingResult=await searchBooking(query,{...base,fetcher:fixtureFetcher({rows:[missing]})});
 assert.equal(missingResult.offers.length,1);assert.match(missingResult.offers[0].taxText,/Conditional charge details were not supplied/);assert.match(missingResult.offers[0].taxText,/Conditional or incalculable charges may apply; this response did not provide their complete amounts/);
 const unknown=offerRow({price:{book:200,total:210,extra_charges:{included:10,excluded:0,conditional:[{charge:22,total_amount:null}]}}});
 const unknownResult=await searchBooking(query,{...base,fetcher:fixtureFetcher({rows:[unknown]})});
 assert.equal(unknownResult.offers.length,1);assert.match(unknownResult.offers[0].taxText,/Conditional or incalculable charges may apply/);
 const priced=offerRow({price:{book:200,total:210,extra_charges:{included:10,excluded:0,conditional:[{charge:3,total_amount:25}]}}});
 const pricedResult=await searchBooking(query,{...base,fetcher:fixtureFetcher({rows:[priced]})});
 assert.equal(pricedResult.offers.length,1);assert.match(pricedResult.offers[0].taxText,/Conditional charges totalling CAD 25\.00 may apply/);
 const itemized=offerRow({price:{book:200,total:210,extra_charges:{included:[{charge:21,mode:'percentage',total_amount:10,chargeable_online:true}],excluded:[],conditional:[{charge:3,condition:28,mode:'per_stay',total_amount:25,chargeable_online:false}]}}});
 const itemizedResult=await searchBooking(query,{...base,fetcher:fixtureFetcher({rows:[itemized]})});
 assert.match(itemizedResult.offers[0].taxText,/Included: charge ID 21, percentage: CAD 10\.00; provider marks chargeable online yes/);
 assert.match(itemizedResult.offers[0].taxText,/Excluded: none reported/);
 assert.match(itemizedResult.offers[0].taxText,/Conditional: charge ID 3, per stay, condition 28: CAD 25\.00; provider marks chargeable online no/);
});
test('Demand API follows one opaque next-page token and verifies up to 60 exact property results',async()=>{
 const calls=[],firstRows=Array.from({length:30},(_,index)=>propertyRow(index+1)),secondRows=Array.from({length:30},(_,index)=>propertyRow(index+31)),details=Array.from({length:60},(_,index)=>propertyDetail(index+1));let clock=Date.parse('2026-11-07T12:00:00Z');
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,clock:()=>{const instant=clock;clock+=1000;return instant;},fetcher:fixtureFetcher({searchPages:[{rows:firstRows,nextPage:'opaque-next-page',totalResults:60},{rows:secondRows,nextPage:null,totalResults:60}],details,onRequest:(path,body)=>calls.push({path,body})})});
 const firstRequest={...validateHotelSearch(query),city:-2140479};delete firstRequest.airport;
 assert.equal(result.offers.length,60);assert.deepEqual(calls.filter(call=>call.path.endsWith('/accommodations/search')).map(call=>call.body),[firstRequest,{page:'opaque-next-page'}]);
 assert.deepEqual(calls.filter(call=>call.path.endsWith('/accommodations/details')).map(call=>call.body.accommodations.length),[30,30]);
 assert.deepEqual(result.coverage,{limit:60,pageSize:30,pagesChecked:2,propertiesReturned:60,providerReportedTotal:60,moreAvailable:false,paginationStatus:'complete'});
 assert.equal(result.sourceResults[0].requestCount,5);assert.equal(result.sourceResults[0].pagesChecked,2);assert.equal(result.sourceResults[0].propertiesReceived,60);
 assert.notEqual(result.offers[0].observedAt,result.offers[30].observedAt);assert.deepEqual([result.offers[0].providerPage,result.offers[30].providerPage],[1,2]);
});
test('Demand API keeps verified first-page offers when a bounded next-page request is throttled',async()=>{
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({searchPages:[{rows:[offerRow()],nextPage:'opaque-next-page',totalResults:2}],failSearchPage:2})});
 assert.equal(result.status,'partial');assert.equal(result.offers.length,1);assert.deepEqual(result.coverage,{limit:60,pageSize:30,pagesChecked:1,propertiesReturned:1,providerReportedTotal:2,moreAvailable:true,paginationStatus:'page_failed'});
 assert.equal(result.sourceResults[0].status,'observed');assert.equal(result.sourceResults[0].paginationErrorStatus,'rate_limited');
});
test('Demand API treats next-page tokens as opaque, caps two pages, and never echoes a token',async()=>{
 const calls=[],result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({searchPages:[{rows:[offerRow()],nextPage:'token-two'},{rows:[offerRow({id:102,url:'https://www.booking.com/hotel/ca/second-hotel.html'})],nextPage:'token-three'}],details:[property(),property({id:102,url:'https://www.booking.com/hotel/ca/second-hotel.html',name:{'en-ca':'Second Hotel'}})],onRequest:(path,body)=>calls.push({path,body})})});
 assert.equal(calls.filter(call=>call.path.endsWith('/accommodations/search')).length,2);assert.equal(result.coverage.pagesChecked,2);assert.equal(result.coverage.moreAvailable,true);assert.equal(result.coverage.paginationStatus,'page_limit');assert.equal(JSON.stringify(result).includes('token-two'),false);assert.equal(JSON.stringify(result).includes('token-three'),false);
});
test('Demand API retains first-page offers if second-page property details fail',async()=>{
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({searchPages:[{rows:[offerRow()],nextPage:'token-two'},{rows:[offerRow({id:102,url:'https://www.booking.com/hotel/ca/second-hotel.html'})],nextPage:null}],details:[property(),property({id:102,url:'https://www.booking.com/hotel/ca/second-hotel.html',name:{'en-ca':'Second Hotel'}})],failDetailsPage:2})});
 assert.equal(result.status,'partial');assert.equal(result.offers.length,1);assert.equal(result.offers[0].providerPage,1);assert.equal(result.coverage.paginationStatus,'details_failed');assert.equal(result.coverage.moreAvailable,false);assert.equal(result.sourceResults[0].paginationErrorStatus,'rate_limited');
});
test('Demand API refuses malformed continuation tokens without sending them',async()=>{
 for(const token of [{unexpected:'object'},'x'.repeat(8193),'bad\ncontinuation']){
  const calls=[],result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({searchPages:[{rows:[offerRow()],nextPage:token}],onRequest:(path,body)=>calls.push({path,body})})});
  assert.equal(calls.filter(call=>call.path.endsWith('/accommodations/search')).length,1);assert.equal(result.offers.length,1);assert.equal(result.coverage.moreAvailable,true);assert.equal(result.coverage.paginationStatus,'invalid_token');
  const serialized=JSON.stringify(result);assert.equal(serialized.includes(typeof token==='string'?token:JSON.stringify(token)),false);
 }
});
test('autocomplete mismatch and ambiguous destination IDs are never guessed',async()=>{
 for(const suggestions of [[{id:123,type:'city',name:'Toronto'}],[{id:1,type:'city',name:'Montréal'},{id:2,type:'city',name:'Montréal'}],[{id:1,type:'region',name:'Montréal'}]]){
  const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({autocomplete:suggestions})});assert.equal(result.status,'incomplete');assert.deepEqual(result.offers,[]);
 }
});
test('property, official star class, CAD all-in price and exact products are required',async()=>{
 const invalid=[
  {details:[property({location:{city:-1,country:'ca'}})]},
  {details:[property({location:{city:-2140479,country:'us'}})]},
  {details:[property({rating:{stars:5,stars_type:'guest'}})]},
  {rows:[offerRow({currency:'USD'})]},
  {rows:[offerRow({price:{book:200,total:null,extra_charges:{included:0,excluded:0}}})]},
  {rows:[offerRow({price:{book:200,total:210,extra_charges:{included:10,excluded:[{charge:22,total_amount:null}],conditional:[]}}})]},
  {rows:[offerRow({products:[{number_of_adults:2,children:[10],price:{total:210}}]})]},
  {rows:[offerRow({price:{book:210,total:200,extra_charges:{included:0,excluded:0}}})]},
  {details:[property({url:'https://hotel.example/hotel/ca/test-hotel.html'})]},
  {details:[property({url:'http://www.booking.com/hotel/ca/test-hotel.html'})]}
 ];
 for(const fixture of invalid){const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher(fixture)});assert.equal(result.offers.length,0);assert.equal(result.rejected,1)}
});
test('safe localized Booking.com property links remain valid while tracking parameters are stripped',async()=>{
 const details=[property({url:'https://www.booking.com/hotel/ca/test-hotel.en-gb.html?aid=12&label=session-secret'})];
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({details})});
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].url,'https://www.booking.com/hotel/ca/test-hotel.en-gb.html?checkin=2027-04-15&checkout=2027-04-20&group_adults=2&no_rooms=1&group_children=1&selected_currency=CAD&age=12');
});
test('multi-room search sends and verifies exact adult and child assignments and total',async()=>{
 const multi={...query,adults:3,adultAges:[35,39,42],rooms:2,childrenAges:[7],roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39,42],childrenAges:[]}]};
 let searchBody;const rows=[offerRow({price:{book:180,total:190,extra_charges:{included:10,excluded:0}},products:[{number_of_adults:1,children:[7],price:{total:100}},{number_of_adults:2,children:[],price:{total:90}}]})];
 const result=await searchBooking(multi,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({rows,onRequest:(path,body)=>{if(path.endsWith('/accommodations/search'))searchBody=body;}})});
 assert.deepEqual(searchBody.guests,{number_of_adults:3,number_of_rooms:2,children:[7],allocation:[{number_of_adults:1,children:[7]},{number_of_adults:2,children:[]}]});assert.equal(result.offers.length,1);assert.deepEqual(result.offers[0].stay.roomAllocations,multi.roomAllocations);
 assert.equal(result.offers[0].occupancyEvidence.status,'provider_product_allocation_match');assert.deepEqual(result.offers[0].occupancyEvidence.requestedRoomAllocations,multi.roomAllocations);assert.deepEqual(result.offers[0].occupancyEvidence.observedRoomProducts,[{adults:1,childrenAges:[7]},{adults:2,childrenAges:[]}]);assert.equal(result.offers[0].occupancyEvidence.expectedTotalCents,19000);assert.equal(result.offers[0].occupancyEvidence.productTotalsMatchExpectedTotal,true);
 const mismatch=await searchBooking(multi,{token:'token',affiliateId:'12',destination,fetcher:fixtureFetcher({rows:[offerRow({price:{book:180,total:190,extra_charges:{included:10,excluded:0}},products:[{number_of_adults:1,children:[6],price:{total:100}},{number_of_adults:2,children:[],price:{total:90}}]})]})});assert.deepEqual(mismatch.offers,[]);
});
test('multi-room allocations are required and cover every actual traveler exactly once',async()=>{
 let calls=0;const options={token:'token',affiliateId:'12',destination,fetcher:()=>{calls++;return new Response('{}')}};
 await assert.rejects(searchBooking({...query,adults:2,rooms:2},{...options}),/exact adult and child allocation/i);
 await assert.rejects(searchBooking({...query,adults:2,rooms:2,roomAllocations:[{adultAges:[35],childrenAges:[12]},{adultAges:[39],childrenAges:[11]}]},{...options}),/assign every entered adult and child age/i);
 assert.equal(calls,0);
});
test('demand API failures preserve rate-limit and access-denied states without offers',async()=>{
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,fetcher:async()=>new Response('{}',{status:429})});assert.equal(result.status,'rate_limited');assert.deepEqual(result.offers,[]);
});
test('Demand API POSTs share the durable provider cooldown and never retry rate-limited calls',async()=>{
 const reservations=[],deferred=[];let requests=0;
 const policy={reserveSource(provider,gapMs){reservations.push({provider,gapMs});return {waitMs:0,blockedUntil:0};},deferSource(provider,until,status){deferred.push({provider,until,status});}};
 const result=await searchBooking(query,{token:'token',affiliateId:'12',destination,policy,fetcher:async()=>{requests++;return new Response('{}',{status:429,headers:{'retry-after':'60'}});}});
 assert.equal(result.status,'rate_limited');assert.deepEqual(result.offers,[]);assert.equal(requests,1);
 assert.deepEqual(reservations,[{provider:'Booking.com Demand API',gapMs:1000}]);
 assert.equal(deferred.length,1);assert.equal(deferred[0].provider,'Booking.com Demand API');assert.equal(deferred[0].status,'rate_limited');assert.ok(deferred[0].until>Date.now());assert.equal(Date.parse(result.retryAt),deferred[0].until);
});
