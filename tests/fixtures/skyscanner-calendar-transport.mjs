// Test-only preload: every supplier and timezone request is intercepted.
let query;
globalThis.fetch=async(url,init={})=>{
 const value=String(url);
 if(value.includes('mwgg/Airports')){
  const records={};for(let i=0;i<1002;i++){const code=String.fromCharCode(65+Math.floor(i/676),65+Math.floor(i/26)%26,65+i%26),icao=`TEST${i}`;if(['YHZ','BCN'].includes(code))continue;records[icao]={icao,iata:code,name:icao,tz:'Europe/London'};}
  for(const [iata,tz] of [['YHZ','America/Halifax'],['BCN','Europe/Madrid']])records[iata]={icao:iata,iata,name:iata,tz};return Response.json(records);
 }
 if(!value.startsWith('https://partners.api.skyscanner.net/'))throw Error('Unexpected test network request');
 if(value.includes('/search/create')){query=JSON.parse(init.body).query;if(process.env.SKYS_TEST_FAMILY==='1'&&(query.adults!==1||JSON.stringify(query.childrenAges)!=='[9]'||String(init.body).includes('birthDate')||String(init.body).includes('guardianId')))throw Error('Incorrect or identifying family supplier payload');}
 const local=(date,hour)=>({...date,hour,minute:0});const [out,back]=query.queryLegs;
 return Response.json({sessionToken:'fixture-skyscanner-session',status:'RESULT_STATUS_COMPLETE',content:{results:{itineraries:{one:{legIds:['out','back'],pricingOptions:[{price:{amount:'900',unit:'PRICE_UNIT_WHOLE'},items:[{deepLink:'https://www.skyscanner.net/'}]}]}},legs:{out:{segmentIds:['s1'],durationInMinutes:480},back:{segmentIds:['s2'],durationInMinutes:480}},segments:{s1:{originPlaceId:'a',destinationPlaceId:'b',departureDateTime:local(out.date,8),arrivalDateTime:local(out.date,21),marketingCarrierId:'AC',marketingFlightNumber:'100'},s2:{originPlaceId:'b',destinationPlaceId:'a',departureDateTime:local(back.date,12),arrivalDateTime:local(back.date,15),marketingCarrierId:'AC',marketingFlightNumber:'101'}},places:{a:{iata:out.originPlaceId.iata},b:{iata:out.destinationPlaceId.iata}},carriers:{AC:{iata:'AC',name:'Air Canada'}}}}});
};
