import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod,mkdtemp,readFile,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/job-store.mjs';

const cli=new URL('../scripts/job-database.mjs',import.meta.url);
function run(args,jobPath,keyFile){return spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8',env:{...process.env,TRAVEL_JOB_DB:jobPath,...(keyFile?{TRAVEL_JOB_BACKUP_KEY_FILE:keyFile}:{})},timeout:10000});}

test('job database backup verifies and restores durable jobs without exposing their contents',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-job-backup-')),source=join(directory,'live.sqlite'),backup=join(directory,'archive.sqlite'),restored=join(directory,'restored.sqlite');
 const owner='9f5a2d30-46c9-4a3f-9a61-22fbb6706a73';let store=createJobStore({path:source});
 try{
  const done=store.submit({origin:'YHZ',destination:'LAX',privateNote:'traveler-data'},'backup_complete_01',{ownerToken:owner}),claim=store.claim();
  assert.equal(store.finish(done.id,claim.token,{result:{offers:[{price:1234.56,currency:'CAD'}]}}),true);
  const hotel=store.submit({origin:'YHZ'},'backup_hotel_01',{kind:'hotel',ownerToken:owner}),hotelClaim=store.claim();
  assert.equal(hotelClaim.id,hotel.id);
  store.heartbeat(hotel.id,hotelClaim.token,{challenge:{id:'challenge-1',width:40,height:30,capturedAt:Date.now(),image:'private challenge crop'}});
  store.interact(hotel.id,{kind:'click',frameId:'challenge-1',x:5,y:5},'backup_input_01');
  const queued=store.submit({origin:'YYZ',destination:'BCN'},'backup_queued_01',{ownerToken:owner});

  const made=run(['backup',backup],source);
  assert.equal(made.status,0,made.stderr);
  const backupSummary=JSON.parse(made.stdout);assert.equal(backupSummary.operation,'backup');assert.equal(backupSummary.integrity,'ok');
  assert.doesNotMatch(made.stdout,/traveler-data|private challenge crop|YHZ|1234\.56|9f5a2d30/i);
  assert.equal((await stat(backup)).mode&0o777,0o600);

  const verified=run(['verify',backup],source);
  assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).integrity,'ok');
  const restoredResult=run(['restore',backup,restored],source);
  assert.equal(restoredResult.status,0,restoredResult.stderr);assert.equal(JSON.parse(restoredResult.stdout).operation,'restore');assert.equal(JSON.parse(restoredResult.stdout).interruptedActiveJobs,2);
  assert.equal((await stat(restored)).mode&0o777,0o600);

  store.close();store=null;
  store=createJobStore({path:restored});
  assert.equal(store.get(done.id).result.offers[0].price,1234.56);
  assert.equal(store.get(queued.id).status,'error');
  assert.match(store.get(queued.id).error.error,/restore.*fresh search/i);
  const restoredHotel=store.get(hotel.id);assert.equal(restoredHotel.status,'error');assert.equal(restoredHotel.progress.challenge,undefined);assert.equal(restoredHotel.interaction.status,'error');
  assert.equal(store.claim(),null,'restoring a queue must not replay incomplete provider searches automatically');
  assert.equal(store.authorize(done.id,owner),true);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

test('backup and restore refuse to overwrite existing files and verification rejects corrupt databases',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-job-backup-')),source=join(directory,'live.sqlite'),occupied=join(directory,'occupied.sqlite'),backup=join(directory,'archive.sqlite'),restoreTarget=join(directory,'restore.sqlite'),corrupt=join(directory,'corrupt.sqlite');
 let store=createJobStore({path:source});
 try{store.submit({origin:'YHZ'},'backup_safe_001');}finally{store.close();store=null;}
 try{
  await writeFile(occupied,'keep backup destination',{mode:0o600});
  const overwriteBackup=run(['backup',occupied],source);assert.notEqual(overwriteBackup.status,0);assert.equal(await readFile(occupied,'utf8'),'keep backup destination');
  const created=run(['backup',backup],source);assert.equal(created.status,0,created.stderr);
  await writeFile(restoreTarget,'keep restored destination',{mode:0o600});
  const overwriteRestore=run(['restore',backup,restoreTarget],source);assert.notEqual(overwriteRestore.status,0);assert.equal(await readFile(restoreTarget,'utf8'),'keep restored destination');
  const samePath=run(['backup',source],source);assert.notEqual(samePath.status,0);
  await writeFile(corrupt,'not a SQLite database',{mode:0o600});
  const invalid=run(['verify',corrupt],source);assert.notEqual(invalid.status,0);assert.doesNotMatch(invalid.stderr,/traveler-data|YHZ/i);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('encrypted backups authenticate data and restore only into a new verified database',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'travel-job-encrypted-backup-')),source=join(directory,'live.sqlite'),key=join(directory,'backup.key'),backup=join(directory,'archive.thpdb'),restored=join(directory,'restored.sqlite'),wrongKey=join(directory,'wrong.key'),tampered=join(directory,'tampered.thpdb'),oversizedKey=join(directory,'oversized.key'),symlinkKey=join(directory,'linked.key'),symlinkBackup=join(directory,'linked-archive.thpdb');
 let store=createJobStore({path:source});
 const owner='3d219b42-8c4a-4f97-90c0-34c1f1658c62';
 try{
  const done=store.submit({origin:'YHZ',destination:'LAX',privateNote:'secret-traveler-marker'},'encrypted_complete_01',{ownerToken:owner}),claim=store.claim();
  assert.equal(store.finish(done.id,claim.token,{result:{marker:'confidential-result-marker'}}),true);
  const queued=store.submit({origin:'YYZ',destination:'BCN'},'encrypted_queued_01',{ownerToken:owner});
  store.close();store=null;

  const generated=run(['keygen',key],source);assert.equal(generated.status,0,generated.stderr);
  assert.equal(JSON.parse(generated.stdout).operation,'keygen');assert.equal((await stat(key)).mode&0o777,0o600);
  const made=run(['backup-encrypted',backup],source,key);assert.equal(made.status,0,made.stderr);
  assert.equal(JSON.parse(made.stdout).integrity,'ok');assert.equal((await stat(backup)).mode&0o777,0o600);
  const encrypted=await readFile(backup);assert.equal(encrypted.includes(Buffer.from('secret-traveler-marker')),false);assert.equal(encrypted.includes(Buffer.from('confidential-result-marker')),false);

  const verified=run(['verify-encrypted',backup],source,key);assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).integrity,'ok');
  await symlink(backup,symlinkBackup);const linkedBackup=run(['verify-encrypted',symlinkBackup],source,key);assert.notEqual(linkedBackup.status,0);assert.match(linkedBackup.stderr,/non-symlink/);
  const restoredResult=run(['restore-encrypted',backup,restored],source,key);assert.equal(restoredResult.status,0,restoredResult.stderr);assert.equal(JSON.parse(restoredResult.stdout).operation,'restore-encrypted');assert.equal(JSON.parse(restoredResult.stdout).interruptedActiveJobs,1);
  assert.equal((await stat(restored)).mode&0o777,0o600);

  store=createJobStore({path:restored});assert.equal(store.get(done.id).result.marker,'confidential-result-marker');assert.equal(store.get(queued.id).status,'error');assert.equal(store.claim(),null);
  await writeFile(wrongKey,Buffer.alloc(32,7).toString('hex')+'\n',{mode:0o600});
  const wrong=run(['verify-encrypted',backup],source,wrongKey);assert.notEqual(wrong.status,0);assert.doesNotMatch(wrong.stderr,/secret-traveler-marker|confidential-result-marker/);
  const encryptedCopy=await readFile(backup);encryptedCopy[encryptedCopy.length-1]^=1;await writeFile(tampered,encryptedCopy,{mode:0o600});
  const corrupted=run(['verify-encrypted',tampered],source,key);assert.notEqual(corrupted.status,0);assert.match(corrupted.stderr,/authentication failed/);
  await chmod(key,0o644);const insecureKey=run(['verify-encrypted',backup],source,key);assert.notEqual(insecureKey.status,0);assert.match(insecureKey.stderr,/owner-only permissions/);await chmod(key,0o600);
  await writeFile(oversizedKey,'a'.repeat(4096),{mode:0o600});const oversized=run(['verify-encrypted',backup],source,oversizedKey);assert.notEqual(oversized.status,0);assert.match(oversized.stderr,/invalid size/);
  await symlink(key,symlinkKey);const linked=run(['verify-encrypted',backup],source,symlinkKey);assert.notEqual(linked.status,0);assert.match(linked.stderr,/non-symlink/);
  const overwrite=run(['backup-encrypted',backup],source,key);assert.notEqual(overwrite.status,0);assert.doesNotMatch(overwrite.stderr,/secret-traveler-marker|confidential-result-marker/);
  const duplicateKey=run(['keygen',key],source);assert.notEqual(duplicateKey.status,0);assert.doesNotMatch(duplicateKey.stderr,/secret-traveler-marker|confidential-result-marker/);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});
