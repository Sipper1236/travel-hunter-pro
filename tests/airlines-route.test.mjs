import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/airlines/route.js';

test('airline endpoint rejects requests outside the local origin',async()=>{
 const response=await POST(new Request('http://127.0.0.1:3000/api/airlines',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Air Canada'})}));
 assert.equal(response.status,403);assert.match((await response.json()).error,/local app/);
});

test('airline endpoint validates the query before querying Wikidata',async()=>{
 const response=await POST(new Request('http://127.0.0.1:3000/api/airlines',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify({query:'A'})}));
 assert.equal(response.status,400);assert.match((await response.json()).error,/at least two/);
});
