import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/search/route.js';

const remoteHeaders={host:'travel-hunter.example',origin:'https://travel-hunter.example','content-type':'application/json'};

test('legacy flight endpoint rejects remote Google requests before parsing or provider work',async()=>{
 const response=await POST(new Request('https://travel-hunter.example/api/search',{method:'POST',headers:remoteHeaders,body:JSON.stringify({source:'google',origin:'YHZ',destination:'LAX',date:'2026-11-12'})}));
 assert.equal(response.status,403);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.match((await response.json()).error,/limited to the local app/i);

 const malformed=await POST(new Request('https://travel-hunter.example/api/search',{method:'POST',headers:remoteHeaders,body:'not-json'}));
 assert.equal(malformed.status,403,'the local-origin guard runs before body parsing');
});

test('same-origin malformed search JSON is rejected without starting a provider request',async()=>{
 const response=await POST(new Request('http://127.0.0.1:3000/api/search',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:'not-json'}));
 assert.equal(response.status,400);
});
