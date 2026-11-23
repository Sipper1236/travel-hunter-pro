import {chromium} from 'playwright-core';
import {installGoogleNativeFixture,googleTestZones} from './google-native-site.mjs';
const originalLaunch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await originalLaunch(...args),newPage=browser.newPage.bind(browser);
 browser.newPage=async(...options)=>{const page=await newPage(...options);await installGoogleNativeFixture(page,{onRequest:({state})=>{if(state.adults!==3||state.children!==0)throw Error('Test requires the complete canonical teen family.');}});return page;};return browser;
};
globalThis.fetch=async url=>{
 if(String(url)==='https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'){
  const records={};let n=0;
  for(let i=0;n<1001;i++){
   const code=String.fromCharCode(65+Math.floor(i/676),65+Math.floor(i/26)%26,65+i%26);if(googleTestZones[code])continue;
   const icao=`T${String(i).padStart(4,'0')}`;records[icao]={icao,iata:code,name:'Synthetic test timezone',tz:'Etc/UTC'};n++;
  }
  for(const [iata,tz] of Object.entries(googleTestZones)){const icao=`T${iata}`;records[icao]={icao,iata,name:'Synthetic test airport',tz};}
  return Response.json(records);
 }
 throw Error('Controlled Google worker fixture forbids all other network access.');
};
