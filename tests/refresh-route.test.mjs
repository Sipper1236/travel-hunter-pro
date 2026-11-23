import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/search/refresh/route.js';

const request=(body,{remote=false}={})=>new Request('http://127.0.0.1/api/search/refresh',{method:'POST',headers:{host:remote?'example.com':'127.0.0.1',origin:remote?'https://example.com':'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify(body)});

test('Expedia refresh requires the original exact flight selection before adapter access',async()=>{
 const response=await POST(request({provider:'Expedia'}));assert.equal(response.status,400);assert.match((await response.json()).error,/exact originally observed/);
});

test('provider refresh routes reject remote origins before provider work',async()=>{
 const response=await POST(request({provider:'Expedia'},{remote:true}));assert.equal(response.status,403);
});

test('Ignav seller links cannot bypass the owner-bound booking handoff route',async()=>{
 const previousKey=process.env.IGNAV_API_KEY,previousFetch=globalThis.fetch;let calls=0;process.env.IGNAV_API_KEY='fixture-only';globalThis.fetch=async()=>{calls++;return Response.json({booking_options:[]});};
 try{const response=await POST(request({provider:'Ignav',ignavId:'fare_12345678'}));assert.equal(response.status,501);assert.equal(calls,0);}
 finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.IGNAV_API_KEY;else process.env.IGNAV_API_KEY=previousKey;}
});
