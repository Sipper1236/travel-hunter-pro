import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server.js';
import nextConfig from '../next.config.mjs';
import {proxy,config as proxyConfig} from '../proxy.js';

test('all routes receive the baseline browser security headers',async()=>{
 const rules=await nextConfig.headers(),rule=rules.find(item=>item.source==='/:path*');
 assert.ok(rule,'security headers must apply to every page and API route');
 const values=new Map(rule.headers.map(item=>[item.key.toLowerCase(),item.value]));
 assert.equal(values.get('x-content-type-options'),'nosniff');
 assert.equal(values.get('x-frame-options'),'DENY');
 assert.equal(values.get('referrer-policy'),'strict-origin-when-cross-origin');
 assert.equal(values.get('permissions-policy'),'camera=(), microphone=(), geolocation=()');
 assert.equal(values.get('cross-origin-opener-policy'),'same-origin');
});

test('HTML proxy CSP uses a fresh nonce and excludes provider APIs and static assets',()=>{
 const response=proxy(new NextRequest('http://127.0.0.1:3000/'));
 const nextResponse=proxy(new NextRequest('http://127.0.0.1:3000/'));
 const policy=response.headers.get('content-security-policy');
 assert.notEqual(policy,nextResponse.headers.get('content-security-policy'),'each page response needs a distinct nonce');
 assert.match(policy,/default-src 'self'/);
 assert.match(policy,/script-src 'self' 'nonce-([A-Za-z0-9+/]+=*)' 'strict-dynamic'/);
 assert.match(policy,/frame-ancestors 'none'/);
 assert.match(policy,/object-src 'none'/);
 assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval|upgrade-insecure-requests/);
 assert.match(response.headers.get('x-middleware-request-content-security-policy'),/nonce-/);
 assert.match(response.headers.get('x-middleware-request-x-nonce'),/^[A-Za-z0-9+/]+=*$/);
 assert.deepEqual(proxyConfig.matcher,['/((?!api|_next/static|_next/image|favicon.ico).*)']);
});
