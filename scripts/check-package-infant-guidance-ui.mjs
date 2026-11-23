// Controlled browser flow; package suggestions and job results are test fixtures only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=new URL(process.env.TRAVEL_CHECK_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use the loopback application URL.');
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage(),unexpected=[],requests=[],jobs=new Map();let input,sequence=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base.origin){unexpected.push(`${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/packages/locations'){const body=route.request().postDataJSON();return route.fulfill({json:{items:body.kind==='from'?[{label:'Halifax, NS (YHZ)',type:'AIRPORT',code:'YHZ'}]:[{label:'Barcelona, Spain',type:'CITY'},{label:'Barcelona Airport (BCN)',type:'AIRPORTGROUP',code:'BCN'}],truncated:false}});}
  if(url.pathname==='/api/search/jobs'){
   const body=route.request().postDataJSON();requests.push(body);
   if(body.action==='start'){input=body.input;const id=`package-fixture-${++sequence}`;jobs.set(id,input);return route.fulfill({json:{id,kind:'package',status:'queued'}});}
   if(body.action==='status'){const current=jobs.get(body.id);return route.fulfill({json:{id:body.id,kind:'package',status:'complete',result:{query:current,offers:[{name:'Fixture Barcelona Hotel',stars:4,mealPlan:'Room Only',propertyCity:'Barcelona',taxText:'Fixture-only provider fee text',cancellationText:'Fixture rate terms',flightSummary:'Outbound and return schedule shown in fixture.',bookingStatus:'Fixture package observation.',occupancyEvidence:{perRoomAllocation:current.rooms>1?'not_exposed_by_widget':'single_room_request'},observedAt:new Date().toISOString(),sourceUrl:'https://vacations.aircanada.com/en/packages/product-listing',price:3216.12,currency:'CAD'}],received:1,rejected:0,coverage:{mode:'structured_widget_response',returnedPackages:1,totalAvailable:84,responsePages:current.maxResults===40?2:1,resultLimit:current.maxResults??20,moreAvailable:true},limitation:'Fixture-only browser evidence.'}}});}
   return route.fulfill({json:{id:'package-fixture',kind:'package',status:'cancelled'}});
  }
  return route.continue();
 });
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 const section=page.getByRole('heading',{name:'Flight + Hotel Vacation Packages',exact:true}).locator('xpath=ancestor::section[1]');
 await section.getByText(/actual age on the departure date.*as the provider requests/i).waitFor({state:'visible'});
 await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('1');
 await section.getByLabel('Actual age at departure · child 1',{exact:true}).fill('7');
 await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('0');
 await section.getByText(/birth dates are used in this browser to validate age and are not sent to or stored by the package worker/i).waitFor({state:'visible'});
 assert.equal(await section.getByRole('link',{name:'Air Canada Vacations infant terms ↗',exact:true}).getAttribute('href'),'https://vacations.aircanada.com/en/terms-conditions');
 await section.getByRole('button',{name:'Find provider origins'}).click();
 await section.getByRole('button',{name:'Halifax, NS (YHZ) · AIRPORT'}).click();
 await section.getByRole('button',{name:'Find provider destinations'}).click();
 await section.getByRole('button',{name:'Barcelona, Spain · CITY'}).click();
 await section.getByLabel('Departure').fill('2027-04-15');
 await section.getByLabel('Return').fill('2027-04-25');
 const airportSelect=section.locator('select[name="destinationAirport"]');
 assert.equal(await airportSelect.evaluate(element=>element.validity.valueMissing),true,'A provider airport must be selected before the package form is valid.');
 await section.getByRole('button',{name:'Search vacation packages'}).click();
 await page.waitForTimeout(100);
 assert.equal(requests.filter(request=>request.action==='start').length,0,'A search without a provider-suggested airport must not reach the job API.');
 await airportSelect.selectOption('BCN');
 await section.getByLabel('Adults',{exact:true}).fill('2');
 const roomsInput=section.getByLabel('Rooms',{exact:true});await roomsInput.fill('2');
 await section.getByRole('button',{name:'Search vacation packages'}).click();
 await page.waitForFunction(()=>document.body.innerText.includes('not verified for a specific per-room allocation'),null,{timeout:10000});
 await section.getByRole('status').filter({hasText:/not verified for a specific per-room allocation/i}).waitFor({state:'visible'});
 const adultMultiRoomInput=requests.find(request=>request.action==='start')?.input;
 assert.equal(adultMultiRoomInput?.adults,2);assert.equal(adultMultiRoomInput?.rooms,2);
 assert.match(await section.innerText(),/2 adults.*2 rooms/s);
 assert.match(await section.innerText(),/widget did not expose an adult assignment for each room/i);
 await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('1');
 await section.getByLabel('Actual age at departure · child 1',{exact:true}).fill('7');
 assert.equal(await roomsInput.getAttribute('max'),'1','The package form must reflect the provider’s one-room child limit.');
 await section.getByText(/provider limits child\/infant bookings to one room/i).waitFor({state:'visible'});
 await section.getByRole('button',{name:'Search vacation packages'}).click();await page.waitForTimeout(100);
 assert.equal(requests.filter(request=>request.action==='start').length,1,'An unsupported two-room child party must not be submitted after the adult-only multi-room fixture.');
 await roomsInput.fill('1');await section.getByLabel('Adults',{exact:true}).fill('1');
 await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('1');
 await section.getByLabel('Actual age at departure · child 1',{exact:true}).fill('7');
 await section.getByRole('combobox',{name:'Maximum package results to inspect',exact:true}).selectOption('40');
 await section.getByRole('button',{name:'Search vacation packages'}).click();
 await page.waitForFunction(()=>document.body.innerText.includes('Fixture-only browser evidence.'),null,{timeout:10000});
 assert.match(await section.innerText(),/Search context:.*Apr 15, 2027.*Apr 25, 2027.*1 adult.*child age at departure 7.*1 room/s,'Package results must display the exact searched dates and children’s ages beside the observations.');
 assert.match(await section.innerText(),/1 supported package observations from 1 provider result across 2 checked pages\. The provider response reported 84 matching listings; 83 were beyond the selected 40-result limit\./,'Structured coverage must distinguish returned results, pages checked, and provider-reported listings beyond the selected limit.');
 assert.match(await section.innerText(),/CAD 3,216\.12/,'Fixture package observation must be visible for the party summary check.');
 await section.getByLabel('Children and youths (ages 2–17)',{exact:true}).fill('0');
 await section.getByLabel('Lap infants (under two)').fill('1');
 const dob=section.getByLabel('Lap infant · actual date of birth 1');
 assert.equal(await dob.getAttribute('name'),null,'DOB must not be submitted as a form field.');
 await dob.fill('2025-04-26');
 await section.getByRole('button',{name:'Search vacation packages'}).click();
 await page.waitForTimeout(1000);
 assert.ok(requests.filter(request=>request.action==='start').length>=3,`Package form did not start the adult multi-room, child, and infant fixture searches: ${await page.locator('body').innerText()}`);
 await page.waitForFunction(()=>document.body.innerText.includes('Fixture-only browser evidence.'),null,{timeout:10000});
 assert.equal(requests.filter(request=>request.action==='start').length,3);
 assert.equal(input.destinationLabel,'Barcelona, Spain');
 assert.equal(input.destinationAirport,'BCN');
 assert.deepEqual(input.infants,[{seating:'lap',departureAge:1,returnAge:1}]);
 assert.match(await section.innerText(),/Search context:.*1 adult.*1 lap infant \(age 1 outbound, 1 return\).*1 room/s,'Package results must state the validated infant seating category.');
 assert.ok(!JSON.stringify(input).includes('2025-04-26'),'DOB must stay in the browser.');
 assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({ui:'package-occupancy-disclosures',destination:'provider city plus provider airport',arrivalAirport:input.destinationAirport,adultMultiRoomPerRoomAssignment:'disclosed as not exposed',exactTravelAges:'browser-derived',dobSent:false,providerCalls:0,jobCalls:requests.length}));
}finally{await browser.close();}
