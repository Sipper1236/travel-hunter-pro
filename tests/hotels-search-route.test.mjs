import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/hotels/search/route.js';

test('Booking.com hotel search rejects remote and cross-origin requests before provider access',async()=>{
 const oldToken=process.env.BOOKING_API_TOKEN,oldAffiliate=process.env.BOOKING_AFFILIATE_ID;
 process.env.BOOKING_API_TOKEN='';process.env.BOOKING_AFFILIATE_ID='';
 const input={airport:'YHZ',checkin:'2027-04-15',checkout:'2027-04-16',adults:1,rooms:1,childrenAges:[],bookerCountry:'ca'};
 const request=(host,origin)=>new Request('http://'+host+'/api/hotels/search',{method:'POST',headers:{host,origin,'content-type':'application/json'},body:JSON.stringify(input)});
 try{
  const remote=await POST(request('travel.example','https://travel.example'));
  assert.equal(remote.status,403);
  const crossOrigin=await POST(request('127.0.0.1','https://evil.example'));
  assert.equal(crossOrigin.status,403);
  const local=await POST(request('127.0.0.1','http://127.0.0.1'));
  assert.equal(local.status,200);
  assert.equal((await local.json()).status,'unavailable');
 }finally{
  if(oldToken===undefined)delete process.env.BOOKING_API_TOKEN;else process.env.BOOKING_API_TOKEN=oldToken;
  if(oldAffiliate===undefined)delete process.env.BOOKING_AFFILIATE_ID;else process.env.BOOKING_AFFILIATE_ID=oldAffiliate;
 }
});
