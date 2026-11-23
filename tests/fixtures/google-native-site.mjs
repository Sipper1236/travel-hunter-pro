import {chromium} from 'playwright-core';
import {airportLocalInstant} from '../../lib/airport-timezones.mjs';
export const googleTestZones={YHZ:'America/Halifax',LHR:'Europe/London',BCN:'Europe/Madrid',IST:'Europe/Istanbul'};
export const googleTestTimezones=()=>({byCode:new Map(Object.entries(googleTestZones).map(([code,timeZone])=>[code,{timeZone}])),sourceUrl:'https://example.test/licensed-test-zones',retrievedAt:new Date().toISOString()});
const service='/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/';
const rpc=data=>")]}'\n\n"+JSON.stringify([['wrb.fr',null,JSON.stringify(data)]])+'\n';
function leg(from,to,date,returning=false){
 const dep=returning?[10]:[8],arr=returning?[12]:[18];
 const local=(parts)=>`${date}T${String(parts[0]).padStart(2,'0')}:00:00`;
 const duration=(Date.parse(airportLocalInstant(local(arr),googleTestZones[to]))-Date.parse(airportLocalInstant(local(dep),googleTestZones[from])))/60000;
 const segment=[];segment[3]=from;segment[6]=to;segment[8]=dep;segment[10]=arr;segment[11]=duration;segment[15]=[];segment[16]=1;segment[20]=date.split('-').map(Number);segment[21]=date.split('-').map(Number);segment[22]=['AC',returning?'861':'860'];
 const row=[];row[1]=['Air Canada'];row[2]=[segment];row[3]=from;row[4]=segment[20];row[5]=dep;row[6]=to;row[7]=segment[21];row[8]=arr;row[9]=duration;row[17]=returning?'return-test':'outbound-test';return row;
}
function dataFor(state,stage,mode){
 if(['no-flights','empty-frame'].includes(mode))return [];
 const out=leg(state.origin,state.destination,state.date),back=leg(state.destination,state.origin,state.returnDate,true);
 if(mode==='wrong-return'&&stage==='booking')back[4]=back[2][0][20]=[2099,4,29];
 if(stage!=='booking'){const data=[];data[3]=[[[stage==='outbound'?out:back,[[null,1200]]]]];return data;}
 const seller=[];seller[0]=2;seller[1]=[['AC','Air Canada']];seller[3]=[['AC','860'],['AC','861']];seller[6]=['test-phone','test-phone'];seller[7]=[[null,1200],'test-price-reference'];
 const data=[];data[0]=[seller];data[5]=[[out,back]];return [[],data];
}
const html=`<!doctype html><html><body><button id="party" aria-label="1 passenger, change number of passengers.">1</button>
<input role="combobox" aria-label="Where from?" id="origin"><input role="combobox" aria-label="Where to?" id="destination">
<input aria-label="Departure" id="departure"><input aria-label="Return" id="return"><button id="search" aria-label="Search">Search</button><main role="main"></main>
<button aria-label="Currency CAD">CurrencyCAD</button><script>
const state={adults:1,children:0};let dateStep=0;
party.onclick=()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<button id="addAdult">Add adult</button><button id="addChild">Add child aged 2 to 11</button><button id="partyDone">Done</button>';document.body.append(d);addAdult.onclick=()=>state.adults++;addChild.onclick=()=>state.children++;partyDone.onclick=()=>{party.textContent=String(state.adults+state.children);d.remove()}};
for(const [id,key] of [['origin','origin'],['destination','destination']])document.getElementById(id).oninput=e=>{document.querySelectorAll('[role=option]').forEach(n=>n.remove());const option=document.createElement('div');option.setAttribute('role','option');option.textContent='Airport'+e.target.value;option.onclick=()=>{state[key]=e.target.value;option.remove()};document.body.append(option)};
departure.onclick=()=>{const c=document.createElement('div');c.id='calendar';for(let i=1;i<=30;i++){const cell=document.createElement('div');cell.setAttribute('role','gridcell');const day='2099-04-'+String(i).padStart(2,'0');cell.dataset.iso=day;cell.textContent=String(i);cell.onclick=()=>{if(!dateStep++){state.date=day;departure.value='Apr '+i}else{state.returnDate=day;document.getElementById('return').value='Apr '+i}};c.append(cell)}const done=document.createElement('button');done.setAttribute('aria-label','Done. Search exact test dates');done.textContent='Done';done.onclick=()=>c.remove();c.append(done);document.body.append(c)};
async function lookup(stage){const name=stage==='booking'?'GetBookingResults':'GetShoppingResults';await fetch('${service}'+name,{method:'POST',body:JSON.stringify({state,stage})}).then(r=>r.text());if(stage==='return'&&window.googleFixtureNavigate){location.href='/travel/flights/search?fixtureState='+encodeURIComponent(JSON.stringify(state));return;}paint(stage);}function paint(stage){const main=document.querySelector('main');if(window.googleFixtureNoFlights){main.innerHTML='<h2>No flights found</h2>';return;}if(stage==='booking'){history.pushState({},'','/travel/flights/booking?tfs=test-query&tfu=test-flights&curr=CAD');main.innerHTML='<h2>Booking options</h2><p>'+(state.adults+state.children)+' passengers</p><p>Lowest total price</p><p>Prices include required taxes + fees for '+state.adults+' adults'+(state.children?' and '+state.children+' children':'')+'.</p>';return;}main.innerHTML='<h2>'+(stage==='outbound'?'Top departing flights':'Returning flights')+'</h2>';const parent=document.createElement('div');parent.dataset.id=stage==='outbound'?'outbound-test':'return-test';const link=document.createElement('div');link.setAttribute('role','link');link.tabIndex=0;link.setAttribute('aria-label','From 1200 Canadian dollars total. Select flight');link.textContent='Test direction';parent.append(link);const next=()=>lookup(stage==='outbound'?'return':'booking');parent.onclick=next;link.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();next()}};main.append(parent)};
search.onclick=()=>lookup('outbound');
</script></body></html>`;
export async function installGoogleNativeFixture(page,{mode,onRequest,directState}={}){
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(mode==='direct-refresh'&&url.pathname==='/travel/flights/booking')return route.fulfill({contentType:'text/html',body:html.replace('const state={adults:1,children:0}','const state='+JSON.stringify(directState)).replace('</script>','lookup(\'booking\');</script>')});
  if(mode==='navigate-return'&&url.pathname==='/travel/flights/search'){const state=JSON.parse(url.searchParams.get('fixtureState'));return route.fulfill({contentType:'text/html',body:html.replace('const state={adults:1,children:0}', 'const state='+JSON.stringify(state)).replace('</script>',"paint('return');</script>")});}
  if(url.pathname==='/travel/flights')return route.fulfill({status:mode==='rate'?429:200,headers:mode==='rate'?{'Retry-After':'120'}:{},contentType:'text/html',body:mode==='challenge'?'Unusual traffic. Verify you are human.':mode==='no-flights'?html.replace('<script>','<script>window.googleFixtureNoFlights=true;'):mode==='navigate-return'?html.replace('<script>','<script>window.googleFixtureNavigate=true;'):mode==='request-bound'?html.replace("search.onclick=()=>lookup('outbound');","search.onclick=()=>{for(let i=0;i<13;i++)void lookup('outbound');};"):html});
  if(url.pathname.startsWith(service)){
   const {state,stage}=request.postDataJSON();onRequest?.({state,stage});
   if(/birthDate|guardianId|travelers/.test(request.postData()))return route.fulfill({status:400,body:'Test rejects private identities in source requests.'});
   return route.fulfill({contentType:'application/json',body:rpc(dataFor(state,stage,mode))});
  }
  return route.abort();
 });
}
export function googleFixtureBrowserFactory(options={}){return async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const newPage=browser.newPage.bind(browser);browser.newPage=async(...args)=>{const page=await newPage(...args);await installGoogleNativeFixture(page,options);return page;};return browser;};}
