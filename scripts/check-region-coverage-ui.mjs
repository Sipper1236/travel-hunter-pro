import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the local application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();let input;
 await page.route('**/api/airports',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await page.route('**/api/search/jobs',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='start'&&body.kind==='flight'){
   input=body.input;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000201',status:'queued',kind:'flight',input})});
  }
  if(body.action==='status'&&body.id==='00000000-0000-0000-0000-000000000201'){
   const originCodes=Array.from({length:40},(_,index)=>`A${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`),destinationCodes=Array.from({length:40},(_,index)=>`B${String.fromCharCode(65+Math.floor(index/26))}${String.fromCharCode(65+index%26)}`);
   const origin={region:{name:'Europe',url:'https://unstats.un.org/unsd/methodology/m49/overview/',policyVersion:'UNSD-M49-test+airport-box-v1',description:'UNSD M49 Europe country membership with an airport coordinate convention.',policyNote:'Airports are limited to the documented airport boundary.'},countries:[{name:'France',iso:'FR'},{name:'Germany',iso:'DE'}],excludedAirports:[{code:'AAA'}],popularityExclusionLimit:3,popularityRankedCandidates:1,popularityExclusionShortfall:2,geographicExcludedAirportCount:1,geographicExcludedAirports:[{code:'UFA'}],geographyUnknownAirportCount:1,geographyUnknownAirports:[{code:'XYZ'}],method:'Fixture region coverage',airports:originCodes.slice(0,4).map(code=>({code})),uncheckedAirports:originCodes.slice(4).map(code=>({code})),airportLimit:4,knownAirportCount:40,moreAvailable:true,checked:[{airport:{code:'FRA',name:'Frankfurt Airport',country:'Germany'},sources:[],offers:0}]};
   const destination={region:{name:'Canada',url:'https://unstats.un.org/unsd/methodology/m49/overview/'},countries:[{name:'Canada',iso:'CA'}],method:'Fixture destination coverage',airports:destinationCodes.slice(0,4).map(code=>({code})),uncheckedAirports:destinationCodes.slice(4).map(code=>({code})),airportLimit:4,knownAirportCount:40,moreAvailable:true,checked:[]};
   const coverage={side:'both',airportLimit:4,origin,destination,pairsPlanned:16,pairsChecked:16,stoppedBySource:false,checked:[],uncheckedPairs:[],uncheckedAirportPairs:[],outsideSelectedPairCoverage:{knownOriginAirportCount:40,knownDestinationAirportCount:40,knownAirportPairs:1600,selectedAirportPairs:16,outsideSelectedPairs:1584,enumeratedPairs:0,enumerationLimit:1000,resolverMayHaveMore:true,representation:'Cartesian product of the known origin and destination airport codes, excluding same-code pairs; outside-selected pairs are those for which at least one endpoint is not in the selected airport sets.'}};
   const result={query:input,offers:[],priceObservations:[],sources:[],observedAt:new Date().toISOString(),originDetection:{type:'region',method:'Versioned local geographic policy',model:'not-used'},destinationDetection:{type:'place',method:'Wikidata exact name or alias and description',model:'not-used'},coverage};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'complete',kind:'flight',input,result})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.id,status:'queued',kind:body.kind,input:body.input})});
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const form=page.locator('.search form').nth(1);
 await page.getByLabel('From',{exact:true}).fill('Europe');await page.getByLabel('To',{exact:true}).fill('YYZ');
 await page.locator('#originType').selectOption('region');await page.locator('#destinationType').selectOption('place');
 await form.locator('input[type=date]').first().fill('2026-12-15');
 await form.locator('input[type=number]').nth(0).fill('1');await form.locator('input[type=number]').nth(1).fill('0');
 await form.getByRole('button',{name:/Search flights/}).click();
 try{await page.getByText('UNSD M49 Europe country membership with an airport coordinate convention.',{exact:false}).waitFor({timeout:10000});}catch(error){console.error(await page.locator('.results').innerText());throw error;}
 const coverage=page.locator('.coverage').filter({hasText:'Geographic scope policy: UNSD-M49-test+airport-box-v1'});
 await coverage.getByText(/Airport boundary omissions:/).click();
 assert.match(await coverage.innerText(),/Intentionally excluded from search.*AAA/);
 assert.match(await coverage.innerText(),/Only 1 of 3 requested airports had recorded passenger traffic/);
 assert.match(await coverage.innerText(),/unknown popularity were retained/);
 assert.match(await coverage.innerText(),/1 outside the boundary/);assert.match(await coverage.innerText(),/UFA/);
 assert.match(await coverage.innerText(),/1 without usable coordinates/);assert.match(await coverage.innerText(),/XYZ/);
 assert.match(await coverage.innerText(),/Additional origin airports not selected: AAE/);
 assert.match(await coverage.innerText(),/1,584 known airport pairs outside the selected limits/);
 await coverage.getByText(/1,584 known airport pairs outside the selected limits/).click();
 assert.match(await coverage.innerText(),/Exact count among 40 known origin airports and 40 known destination airports: 1,600 valid candidate pairs, including 16 selected pairs/);
 assert.match(await coverage.innerText(),/additional airport candidates may exist/);
 assert.deepEqual(input.origin,'Europe');assert.equal(input.originType,'region');
 assert.match(await page.locator('.results').innerText(),/detection: origin versioned local geographic policy; destination Wikidata classification/);
 console.log(JSON.stringify({ui:'region-coverage',m49Policy:true,popularityShortfallDisclosed:true,unknownTrafficRetained:true,airportBoundaryOmissions:true,unsearchedAirports:true,largeOutsidePairCount:true,providerCallsIntercepted:true}));
}finally{await browser.close();}
