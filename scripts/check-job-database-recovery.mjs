import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createJobStore} from '../lib/job-store.mjs';

const directory=await mkdtemp(join(tmpdir(),'travel-job-recovery-drill-'));
const source=join(directory,'disposable-source.sqlite');
const backup=join(directory,'disposable-backup.sqlite');
const restored=join(directory,'disposable-restored.sqlite');
const key=join(directory,'disposable-backup.key');
const encryptedBackup=join(directory,'disposable-encrypted-backup.thpdb');
const encryptedRestored=join(directory,'disposable-encrypted-restored.sqlite');
const ownerToken=randomUUID();
const cli=new URL('./job-database.mjs',import.meta.url).pathname;
const env={...process.env,TRAVEL_JOB_DB:source,TRAVEL_JOB_BACKUP_KEY_FILE:key};
let store;

function command(args){
 const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env,timeout:10000});
 if(result.error)throw result.error;
 assert.equal(result.status,0,result.stderr||`CLI exited ${result.status}`);
 return JSON.parse(result.stdout);
}

try{
 store=createJobStore({path:source});
 const completed=store.submit({operation:'controlled-recovery-drill'},'drill_complete_001',{ownerToken});
 const completedClaim=store.claim();
 assert.equal(completedClaim.id,completed.id);
 assert.equal(store.finish(completed.id,completedClaim.token,{result:{marker:'completed-record-preserved'}}),true);

 const hotel=store.submit({operation:'controlled-active-hotel-drill'},'drill_hotel_001',{kind:'hotel',ownerToken});
 const hotelClaim=store.claim();
 assert.equal(hotelClaim.id,hotel.id);
 store.heartbeat(hotel.id,hotelClaim.token,{challenge:{id:'drill-challenge',width:40,height:30,capturedAt:Date.now(),image:'disposable-crop'}});
 store.interact(hotel.id,{kind:'click',frameId:'drill-challenge',x:5,y:5},'drill_interaction_001');

 const queued=store.submit({operation:'controlled-queued-drill'},'drill_queued_001',{ownerToken});
 store.close();store=null;

 const backupResult=command(['backup',backup]);
 assert.equal(backupResult.integrity,'ok');
 const backupVerify=command(['verify',backup]);
 assert.equal(backupVerify.integrity,'ok');
 const restoreResult=command(['restore',backup,restored]);
 assert.equal(restoreResult.integrity,'ok');
 assert.equal(restoreResult.interruptedActiveJobs,2);
 const restoredVerify=command(['verify',restored]);
 assert.equal(restoredVerify.integrity,'ok');

 const keyResult=command(['keygen',key]);assert.equal(keyResult.operation,'keygen');
 const encryptedResult=command(['backup-encrypted',encryptedBackup]);assert.equal(encryptedResult.integrity,'ok');
 const encryptedVerify=command(['verify-encrypted',encryptedBackup]);assert.equal(encryptedVerify.integrity,'ok');
 const encryptedRestore=command(['restore-encrypted',encryptedBackup,encryptedRestored]);assert.equal(encryptedRestore.integrity,'ok');assert.equal(encryptedRestore.interruptedActiveJobs,2);
 const encryptedRestoredVerify=command(['verify',encryptedRestored]);assert.equal(encryptedRestoredVerify.integrity,'ok');
 assert.equal((await stat(backup)).mode&0o777,0o600);
 assert.equal((await stat(restored)).mode&0o777,0o600);
 assert.equal((await stat(key)).mode&0o777,0o600);assert.equal((await stat(encryptedBackup)).mode&0o777,0o600);assert.equal((await stat(encryptedRestored)).mode&0o777,0o600);

 store=createJobStore({path:restored});
 assert.equal(store.get(completed.id).result.marker,'completed-record-preserved');
 for(const id of [hotel.id,queued.id]){
  const job=store.get(id);
  assert.equal(job.status,'error');
  assert.match(job.error.error,/restore.*fresh search/i);
 }
 assert.equal(store.get(hotel.id).progress.challenge,undefined);
 assert.equal(store.get(hotel.id).interaction.status,'error');
 assert.equal(store.claim(),null);
 store.close();store=createJobStore({path:encryptedRestored});
 assert.equal(store.get(completed.id).result.marker,'completed-record-preserved');
 for(const id of [hotel.id,queued.id])assert.equal(store.get(id).status,'error');
 assert.equal(store.get(hotel.id).progress.challenge,undefined);assert.equal(store.claim(),null);
 console.log(JSON.stringify({status:'passed',database:'disposable isolated fixture',productionDatabaseAccessed:false,commands:{backup:'passed',verifyBackup:'passed',restore:'passed',verifyRestored:'passed',keygen:'passed',backupEncrypted:'passed',verifyEncrypted:'passed',restoreEncrypted:'passed'},completedRecordPreserved:true,activeJobsInterrupted:restoreResult.interruptedActiveJobs,automaticReplay:false,backupAndRestoreMode:'0600',providerRequests:0}));
}finally{
 store?.close();
 await rm(directory,{recursive:true,force:true});
}
