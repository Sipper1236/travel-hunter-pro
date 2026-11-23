import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegionCache } from '../lib/region-cache.mjs';

test('cache persists, expires, and reports stale on lookup failure', async () => {
  const directory = await mkdtemp(join(tmpdir(),'travel-cache-')); let clock=100000, calls=0;
  const lookup=async()=>{calls++;return {region:{name:'Europe'},airports:[{code:'ABC'}]};};
  try {
    const first=createRegionCache({directory,ttlMs:1000,now:()=>clock});
    assert.equal((await first('Europe',lookup)).cache.status,'fresh');
    const second=createRegionCache({directory,ttlMs:1000,now:()=>clock});
    assert.equal((await second(' europe ',lookup)).cache.status,'hit'); assert.equal(calls,1);
    clock+=1001; assert.equal((await second('Europe',async()=>{throw Error('offline')})).cache.status,'stale');
    assert.equal((await second('Europe',lookup)).cache.status,'fresh'); assert.equal(calls,2);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
test('failures and empty lookups do not become cached entries', async()=>{
  const directory=await mkdtemp(join(tmpdir(),'travel-cache-'));
  try {const cache=createRegionCache({directory}); await assert.rejects(cache('Europe',async()=>{throw Error('offline')})); let calls=0; const lookup=async()=>{calls++;return {region:{name:'Europe'},airports:[]};}; await cache('Europe',lookup); await cache('Europe',lookup); assert.equal(calls,2);} finally {await rm(directory,{recursive:true,force:true});}
});
