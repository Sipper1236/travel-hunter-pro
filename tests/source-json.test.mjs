import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedSourceJson} from '../lib/source-json.mjs';

test('bounded source JSON accepts a response exactly at the byte cap',async()=>{
 const body='{"ok":true}';assert.deepEqual(await readBoundedSourceJson(new Response(body),{provider:'Test',maxBytes:Buffer.byteLength(body)}),{ok:true});
});

test('bounded source JSON rejects oversized declared and streamed bodies',async()=>{
 await assert.rejects(readBoundedSourceJson(new Response('{"ok":true}',{headers:{'content-length':'500'}}),{provider:'Test',maxBytes:10}),error=>error.sourceStatus==='invalid_response');
 await assert.rejects(readBoundedSourceJson(new Response('12345678901'),{provider:'Test',maxBytes:10}),error=>error.sourceStatus==='invalid_response');
});

test('bounded source JSON fails closed on invalid JSON and missing body',async()=>{
 await assert.rejects(readBoundedSourceJson(new Response('{oops}'),{provider:'Test'}),error=>error.sourceStatus==='invalid_response');
 await assert.rejects(readBoundedSourceJson(new Response(null),{provider:'Test'}),error=>error.sourceStatus==='invalid_response');
});
