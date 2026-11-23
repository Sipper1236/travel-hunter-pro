import test from 'node:test';
import assert from 'node:assert/strict';
import {searchHotel} from '../lib/hotel-search.mjs';
import {startJob,jobAction,bookingPageDiagnostics} from '../lib/browser-jobs.mjs';
const query={city:'Example',checkin:'2099-04-15',checkout:'2099-04-20',adults:1,rooms:1,childrenAges:[],minStars:4};
const noWaitPolicy={reserveSource:()=>({waitMs:0}),deferSource(){}};

test('hotel executor sends user input to its own session and persists the acknowledgement',async()=>{
 const actions=[],acks=[],commands=[{id:'human-input',input:{kind:'click',frameId:'original-frame',x:10,y:20}}],destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:null};let querySeen;
 const result=await searchHotel(query,{resolveDestination:async()=>destination,start:async q=>{querySeen=q;return{id:'original-session'};},nextInteraction:()=>commands.shift(),onInteractionResult:value=>acks.push(value),act:async input=>{actions.push(input);return input.action==='input'?{status:'complete',result:{offers:[],query:querySeen}}:{status:'cancelled'};}});
 assert.deepEqual(result.query,{...querySeen,destination:{city:'Example',cityId:'Q123',countryCode:'CA',airport:null}});assert.equal(querySeen.cityId,'Q123');assert.equal(actions[0].id,'original-session');assert.equal(actions[0].frameId,'original-frame');assert.equal(actions[0].action,'input');assert.deepEqual(acks,[{id:'human-input'}]);assert.equal(actions.at(-1).action,'cancel');
});

test('hotel executor closes its session on cancellation during verification',async()=>{
 const controller=new AbortController();let cancels=0,progress=0;
 await assert.rejects(searchHotel(query,{signal:controller.signal,resolveDestination:async()=>({city:'Example',cityId:'Q123',countryCode:'CA',airport:null}),start:async()=>({id:'session'}),onProgress:()=>{if(++progress===2)controller.abort();},act:async input=>{if(input.action==='cancel'){cancels++;return {status:'cancelled'};}return {status:'challenge',challenge:{id:'frame',image:'test crop',width:100,height:50}};}}),/abort/i);
 assert.equal(cancels,1);
});

test('cancelling during Chromium launch closes the late browser without navigating',async()=>{
 let finishLaunch,closed=0,pages=0;const launched=new Promise(resolve=>finishLaunch=resolve);
 const job=startJob(query,{launch:()=>launched,policy:noWaitPolicy});const cancellation=jobAction({id:job.id,action:'cancel'});
 finishLaunch({close:async()=>closed++,newPage:async()=>{pages++;throw Error('must not navigate');}});
 assert.equal((await cancellation).status,'cancelled');assert.equal(pages,0);assert.ok(closed>0);
});

test('Booking.com browser search honors a shared cooldown before starting Chromium',async()=>{
 let launches=0;const until=Date.now()+60000,policy={reserveSource:()=>({blockedUntil:until,status:'rate_limited'}),deferSource(){}};
 const job=startJob(query,{policy,launch:async()=>{launches++;throw Error('must not launch');}});let snapshot;
 for(let attempt=0;attempt<30;attempt++){snapshot=await jobAction({id:job.id,action:'poll'});if(snapshot.status==='error')break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(snapshot.status,'error');assert.equal(snapshot.sourceStatus,'rate_limited');assert.equal(Date.parse(snapshot.retryAt),until);assert.equal(launches,0);
});

test('Booking.com page diagnostics retain safe status markers without URL queries or page captures',async()=>{
 const body='Bot or Not? Verify you are human. private search details must not be retained.';
 const page={url:()=> 'https://www.booking.com/searchresults.en-us.html?ss=Private%20City&age=7',title:async()=>'Bot or Not?',locator:selector=>selector==='body'?{innerText:async()=>body}:{count:async()=>0}};
 const diagnostic=await bookingPageDiagnostics(page,{httpStatus:429});
 assert.deepEqual(diagnostic,{host:'www.booking.com',path:'/searchresults.en-us.html',title:'Bot or Not?',httpStatus:429,propertyCards:0,challengeMarkers:['bot_check_marker','human_verification_marker'],pageTextLength:body.length});
 assert.equal(JSON.stringify(diagnostic).includes('Private City'),false);assert.equal(JSON.stringify(diagnostic).includes('private search details'),false);
});

test('Booking.com HTTP 429 stops immediately, persists the shared cooldown, and returns bounded challenge diagnostics',async()=>{
 let closed=0;const deferred=[],page={goto:async()=>({status:()=>429,headers:()=>({'retry-after':'20'})}),url:()=> 'https://www.booking.com/searchresults.en-us.html?ss=Private%20City',title:async()=>'Bot or Not?',viewportSize:()=>({width:1280,height:1000}),locator:selector=>selector==='body'?{innerText:async()=>'Bot or Not?'}:{count:async()=>0}};
 const policy={...noWaitPolicy,deferSource:(...args)=>deferred.push(args)};
 const job=startJob(query,{launch:async()=>({newPage:async()=>page,close:async()=>closed++}),policy});let snapshot;
 for(let attempt=0;attempt<30;attempt++){snapshot=await jobAction({id:job.id,action:'poll'});if(['error','complete','cancelled'].includes(snapshot.status))break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(snapshot.status,'error');assert.equal(snapshot.sourceStatus,'rate_limited');assert.equal(snapshot.diagnostics.httpStatus,429);assert.deepEqual(snapshot.diagnostics.challengeMarkers,['bot_check_marker']);assert.ok(Date.parse(snapshot.retryAt)>Date.now());
 assert.deepEqual(deferred.map(row=>[row[0],row[2]]),[['Booking.com','rate_limited']]);assert.match(snapshot.message,/HTTP 429/);assert.equal(snapshot.message.includes('Private City'),false);assert.equal(closed,1);
});

test('hotel worker forwards trusted resolved destination and preserves city-choice errors before launch',async()=>{
 const linked={...query,destinationAirport:'YUL'},destination={city:'Montreal',cityId:'Q340',countryCode:'CA',airport:'YUL'};let optionsSeen,querySeen,starts=0;
 const options={resolveDestination:async()=>destination,start:async(q,options)=>{starts++;querySeen=q;optionsSeen=options;return {id:'session'};},act:async()=>({status:'complete',result:{offers:[],query}})};
 await searchHotel(linked,options);assert.equal(querySeen.city,'Montreal');assert.equal(querySeen.cityId,'Q340');assert.deepEqual(optionsSeen.destination,destination);
 options.resolveDestination=async()=>{const error=Error('choose city');error.cityChoices=[{id:'Q340'}];throw error;};
 await assert.rejects(searchHotel(linked,options),error=>Boolean(error.cityChoices));assert.equal(starts,1);
 options.resolveDestination=async()=>{throw Error('city service unavailable');};const refused=await searchHotel(linked,options);assert.equal(starts,1);assert.equal(refused.sourceResults[0].status,'unverified_destination');assert.match(refused.limitation,/No Booking.com request was made/);
});

test('Booking.com city-only searches resolve a canonical destination before opening the source',async()=>{
 const selected={city:'Montréal',cityId:'Q340',countryCode:'CA',countryName:'Canada',airport:null};let resolved=0,started=0,querySeen,contextSeen;
 const result=await searchHotel(query,{resolveDestination:async input=>{resolved++;assert.equal(input.city,'Example');return selected;},start:async(q,context)=>{started++;querySeen=q;contextSeen=context;return{id:'city-session'};},act:async()=>({status:'complete',result:{offers:[],query:querySeen}})});
 assert.equal(resolved,1);assert.equal(started,1);assert.equal(querySeen.city,'Montréal');assert.equal(querySeen.cityId,'Q340');assert.equal(contextSeen.destination,selected);assert.equal(result.query.destination.cityId,'Q340');assert.equal(result.sourceResults[0].provider,'Booking.com browser search');assert.equal(result.sourceResults[0].status,'no_matching_observation');assert.equal(result.coverage.scope,'visible_first_page');assert.equal(result.coverage.furtherPagesSearched,false);
});

test('Booking.com source is not searched when its city cannot be verified',async()=>{
 let starts=0;const result=await searchHotel(query,{resolveDestination:async()=>{throw Error('City resolver unavailable.');},start:async()=>{starts++;return{id:'must-not-start'};},act:async()=>{throw Error('must not poll');}});
 assert.equal(starts,0);assert.deepEqual(result.offers,[]);assert.equal(result.sourceResults[0].status,'unverified_destination');assert.match(result.limitation,/no Booking.com request was made/i);
});

test('combined hotel sources retain official observations if Booking.com fails and show partial progress',async()=>{
 const destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:null},updates=[];
 const r=await searchHotel({...query,hotelSource:'both',adultAges:[35]},{resolveDestination:async()=>destination,officialSearch:async()=>({offers:[{name:'Direct Hotel'}],query:{...query,destination},received:1,rejected:0,sourceResults:[{provider:'Official',status:'observed'}]}),start:async()=>{throw Error('Booking unavailable');},onProgress:p=>updates.push(p)});
 assert.equal(r.offers[0].name,'Direct Hotel');assert.equal(r.sourceResults.at(-1).status,'error');assert.equal(r.sourceResults.at(-1).reason,'Booking unavailable');assert.equal(updates.some(p=>p.partialResult?.offers.length===1),true);assert.equal(r.query.destination.cityId,'Q123');
});
test('official hotel source failures retain provider state instead of implying no inventory',async()=>{
 const failed=await searchHotel({...query,hotelSource:'official',adultAges:[35]},{resolveDestination:async()=>({city:'Example',cityId:'Q123',countryCode:'CA'}),officialSearch:async()=>{throw Object.assign(Error('Property pages could not be reached.'),{sourceStatus:'temporarily_unavailable'});}});
 assert.equal(failed.sourceResults[0].status,'temporarily_unavailable');assert.equal(failed.sourceResults[0].reason,'Property pages could not be reached.');assert.deepEqual(failed.offers,[]);
});
test('Demand API hotel source resolves the destination and is isolated from browser and official sources',async()=>{
 const destination={city:'Montréal',cityId:'Q340',countryCode:'CA',countryName:'Canada',airport:'YUL'},calls=[];
 const demandQuery={...query,city:'Montréal',destinationAirport:'YUL',checkin:'2027-04-15',checkout:'2027-04-20',adults:2,adultAges:[35,39],childrenAges:[12],hotelSource:'booking-demand'};
 const result=await searchHotel(demandQuery,{resolveDestination:async()=>destination,bookingDemandSearch:async(input,options)=>{calls.push({input,options});return {status:'unavailable',offers:[],reason:'Partner access not configured.'};},officialSearch:async()=>{throw Error('official source must not run');},start:async()=>{throw Error('browser source must not run');}});
 assert.equal(calls.length,1);assert.equal(calls[0].input.airport,'YUL');assert.equal(calls[0].input.bookerCountry,'ca');assert.deepEqual(calls[0].input.childrenAges,[12]);assert.equal(calls[0].options.destination,destination);assert.equal(result.sourceResults[0].provider,'Booking.com Demand API');assert.equal(result.query.destination.cityId,'Q340');
});
test('Booking.com browser quotes each validated room assignment and joins only the same verified property',async()=>{
 const multi={...query,destinationAirport:'YUL',adults:2,adultAges:[35,39],rooms:2,childrenAges:[7],hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL'},sessions=new Map(),started=[],progress=[];
 const options={resolveDestination:async()=>destination,start:async(q,context)=>{const id=`room-${started.length+1}`;started.push({q,context});sessions.set(id,q);return{id};},act:async({id})=>{
  const q=sessions.get(id),room=started.find(item=>item.q===q),now=new Date().toISOString();
  return {status:'complete',result:{offers:[{name:'Example Hotel',stars:4,priceText:`CAD ${q.childrenAges.length?120:180}.00`,currency:'CAD',url:'https://www.booking.com/hotel/ca/example.html',observedAt:now,provider:'booking',source:'Booking.com via api-anything',occupancyEvidence:{status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:true,roomsMatched:true,individualAgesEchoed:false,requestedAdultAges:q.adultAges,requestedChildrenAges:q.childrenAges},stay:{checkin:q.checkin,checkout:q.checkout,nights:5,rooms:1,adults:q.adults,adultAges:q.adultAges,childrenAges:q.childrenAges},locationEvidence:{status:'verified',city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL',hotelName:'Example Hotel',propertyKey:'www.booking.com/hotel/ca/example.html',observedAt:now}}],received:1,rejected:0,query:q,sourceResults:[{provider:'Booking.com',status:'observed'}]}};
 },onProgress:event=>progress.push(event)};
 const result=await searchHotel(multi,options);
 assert.equal(started.length,2);
 assert.deepEqual(started.map(({q})=>({rooms:q.rooms,adults:q.adults,adultAges:q.adultAges,childrenAges:q.childrenAges})),[
  {rooms:1,adults:1,adultAges:[35],childrenAges:[7]},
  {rooms:1,adults:1,adultAges:[39],childrenAges:[]}
 ]);
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].priceText,'CAD 300.00');
 const partialResults=progress.map(event=>event.partialResult).filter(Boolean);
 assert.deepEqual(partialResults[0].offers,[],'Do not show a full-party subtotal after observing only the first assigned room.');
 assert.equal(partialResults.at(-1).offers.length,1);
 assert.deepEqual(result.offers[0].roomQuotes.map(({adultAges,childrenAges})=>({adultAges,childrenAges})),multi.roomAllocations);
 assert.match(result.offers[0].bookingStatus,/simultaneous.*unverified/i);
 assert.equal(result.offers[0].occupancyEvidence.status,'separate_room_count_matches');assert.equal(result.offers[0].occupancyEvidence.individualAgesEchoed,false);
 assert.equal(result.offers[0].stay.rooms,2);assert.deepEqual(result.offers[0].stay.roomAllocations,multi.roomAllocations);
});

test('Booking.com room totals are withheld unless each listing confirms the requested guest counts',async()=>{
 const multi={...query,destinationAirport:'YUL',adults:2,adultAges:[35,39],rooms:2,childrenAges:[7],hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL'};let count=0;
 const result=await searchHotel(multi,{resolveDestination:async()=>destination,start:async()=>({id:`room-${++count}`}),act:async()=>{const room=count,now=new Date().toISOString(),allocation=multi.roomAllocations[room-1];return{status:'complete',result:{offers:[{name:'Example Hotel',stars:4,priceText:'CAD 100.00',currency:'CAD',url:'https://www.booking.com/hotel/ca/example.html',observedAt:now,provider:'booking',source:'Booking.com via api-anything',occupancyEvidence:{status:'provider_count_match',adultsMatched:true,nightsMatched:true,childrenCountMatched:room!==1,roomsMatched:true,individualAgesEchoed:false,requestedAdultAges:allocation.adultAges,requestedChildrenAges:allocation.childrenAges},stay:{checkin:multi.checkin,checkout:multi.checkout,nights:5,rooms:1,adults:allocation.adultAges.length,adultAges:allocation.adultAges,childrenAges:allocation.childrenAges},locationEvidence:{status:'verified',city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL',hotelName:'Example Hotel',propertyKey:'www.booking.com/hotel/ca/example.html',observedAt:now}}],received:1,rejected:0}};}});
 assert.deepEqual(result.offers,[]);assert.equal(result.coverage.commonPropertyCount,0);
});

test('failed Booking.com room searches are not represented as unavailable inventory',async()=>{
 const multi={...query,destinationAirport:'YUL',adults:2,adultAges:[35,39],rooms:2,childrenAges:[7],hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL'};let count=0;
 const result=await searchHotel(multi,{resolveDestination:async()=>destination,start:async()=>{if(++count===2)throw Error('Booking.com navigation failed: provider connection closed.');return{id:'room-1'};},act:async()=>({status:'complete',result:{offers:[],received:0,rejected:0}})});
 assert.equal(result.status,'partial');assert.equal(result.coverage.roomsObserved,1);assert.equal(result.coverage.roomSearchesAttempted,2);assert.equal(result.coverage.roomSearchesCompleted,1);assert.equal(result.coverage.roomSearchesFailed,1);assert.equal(result.sourceResults[0].status,'observed');
 assert.equal(result.sourceResults[1].status,'error');assert.equal(result.sourceResults[1].reason,'Booking.com navigation failed: provider connection closed.');
});

test('first-room Booking.com failure counts an attempt but no completed observation',async()=>{
 const multi={...query,destinationAirport:'YUL',adults:2,adultAges:[35,39],rooms:2,childrenAges:[7],hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const result=await searchHotel(multi,{resolveDestination:async()=>({city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL'}),start:async()=>{throw Object.assign(Error('provider session could not start'),{sourceStatus:'rate_limited'});}});
 assert.equal(result.status,'partial');assert.deepEqual(result.coverage,{scope:'separate_room_queries',roomsRequested:2,roomsObserved:0,roomSearchesPlanned:2,roomSearchesAttempted:1,roomSearchesCompleted:0,roomSearchesFailed:1,roomSearchesNotAttempted:1,commonPropertyCount:0,partialCommonPropertyCount:0,simultaneousAvailabilityVerified:false});
 assert.equal(result.sourceResults[0].status,'rate_limited');assert.equal(result.sourceResults[0].reason,'provider session could not start');
 assert.deepEqual({room:result.sourceResults[1].room,status:result.sourceResults[1].status},{room:2,status:'not_searched'});
 assert.match(result.limitation,/1 of 2 room searches were attempted; 0 returned observations, 1 failed, and 1 were not searched/);
});

test('Booking.com room quotes for different properties cannot be combined',async()=>{
 const multi={...query,destinationAirport:'YUL',adults:2,adultAges:[35,39],rooms:2,childrenAges:[7],hotelSource:'booking',roomAllocations:[{adultAges:[35],childrenAges:[7]},{adultAges:[39],childrenAges:[]}]};
 const destination={city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL'},sessions=new Map();let count=0;
 const options={resolveDestination:async()=>destination,start:async q=>{const id=`room-${++count}`;sessions.set(id,q);return{id};},act:async({id})=>{const q=sessions.get(id),now=new Date().toISOString();return{status:'complete',result:{offers:[{name:'Example Hotel',stars:4,priceText:'CAD 120.00',currency:'CAD',url:`https://www.booking.com/hotel/ca/${id}.html`,observedAt:now,stay:{checkin:q.checkin,checkout:q.checkout,nights:5,rooms:1,adults:q.adults,adultAges:q.adultAges,childrenAges:q.childrenAges},locationEvidence:{status:'verified',city:'Example',cityId:'Q123',countryCode:'CA',airport:'YUL',hotelName:'Example Hotel',propertyKey:`www.booking.com/hotel/ca/${id}.html`,observedAt:now}}],received:1,rejected:0,query:q}};}};
 const result=await searchHotel(multi,options);assert.deepEqual(result.offers,[]);assert.equal(result.coverage.commonPropertyCount,0);assert.equal(result.sourceResults.filter(source=>source.status==='observed').length,2);
});
test('official city ambiguity stops before property requests and cancellation propagates',async()=>{
 let reads=0;await assert.rejects(searchHotel({...query,hotelSource:'official',adultAges:[35]},{resolveDestination:async()=>{const e=Error('Choose city');e.cityChoices=[{id:'Q123'}];throw e;},officialSearch:async()=>{reads++;}}),error=>Boolean(error.cityChoices));assert.equal(reads,0);
 const controller=new AbortController();await assert.rejects(searchHotel({...query,hotelSource:'official',adultAges:[35]},{signal:controller.signal,resolveDestination:async()=>({city:'Example'}),officialSearch:async()=>{controller.abort(Error('Cancelled'));throw controller.signal.reason;}}),/Cancelled/);
});
