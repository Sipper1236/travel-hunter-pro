import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {publicAddress,publicTarget,fetchPublic} from '../lib/public-fetch.mjs';
const lookup=async()=>[{address:'8.8.8.8',family:4}];
function transport(handler){return(url,options,callback)=>{const req=new EventEmitter();req.end=()=>queueMicrotask(async()=>{try{const reply=await handler(url,options),res=Readable.from([reply.body ?? Buffer.from('ok')]);res.statusCode=reply.status ?? 200;res.headers=reply.headers ?? {};callback(res);}catch(error){req.emit('error',error);}});return req;};}
test('public website reads reject local, reserved, mapped and mixed DNS destinations before connection',async()=>{
 for(const address of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','169.254.169.254','100.64.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1','2002:7f00:1::','3fff::1'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','192.0.78.12','1.1.1.1','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(address),true,address);
 for(const url of ['http://hotel.example.com','https://localhost','https://2130706433','https://0x7f000001','https://[::1]','https://user:secret@hotel.example.com','https://hotel.example.com:444','https://metadata.internal'])await assert.rejects(publicTarget(url,{lookup}));
 await assert.rejects(publicTarget('https://hotel.example.com',{lookup:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]}),/private/);
});
test('TLS requests use the checked pinned address and redirects cannot reach an internal target',async()=>{
 let resolutions=0,requests=0;
 const response=await fetchPublic('https://hotel.example.com',{lookup:async()=>{resolutions++;return [{address:'8.8.8.8',family:4}];},request:transport((url,options)=>{requests++;assert.equal(url.hostname,'hotel.example.com');options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});return {body:Buffer.from('hotel')};})});
 assert.equal(await response.text(),'hotel');assert.equal(response.url,'https://hotel.example.com/');assert.equal(resolutions,1);assert.equal(requests,1);
 requests=0;await assert.rejects(fetchPublic('https://hotel.example.com',{lookup,request:transport(()=>{requests++;return {status:302,headers:{location:'https://127.0.0.1/private'}};})}),/private/);assert.equal(requests,1);
});
test('decoded response limits apply to compressed bodies and normal JSON remains intact',async()=>{
 const body=gzipSync(Buffer.from('x'.repeat(10000)));
 await assert.rejects(fetchPublic('https://hotel.example.com',{lookup,maxBytes:100,request:transport(()=>({headers:{'content-encoding':'gzip'},body}))}),/size limit/);
 const response=await fetchPublic('https://hotel.example.com',{lookup,request:transport(()=>({headers:{'content-type':'application/json'},body:Buffer.from('{"name":"Hotel"}')}))});assert.deepEqual(await response.json(),{name:'Hotel'});
});
test('cancellation interrupts pending DNS before an HTTPS request can start',async()=>{
 const controller=new AbortController();let requests=0;const timer=setTimeout(()=>controller.abort(Error('DNS cancelled')),10);
 try{await assert.rejects(fetchPublic('https://hotel.example.com',{signal:controller.signal,lookup:()=>new Promise(()=>{}),request:()=>{requests++;}}),/DNS cancelled/);assert.equal(requests,0);}finally{clearTimeout(timer);}
});
