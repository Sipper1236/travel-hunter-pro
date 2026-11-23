import {DatabaseSync} from 'node:sqlite';
import {constants,createReadStream,createWriteStream} from 'node:fs';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {lstatSync} from 'node:fs';
import {chmod,link,mkdir,mkdtemp,open,stat,unlink,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,resolve,join} from 'node:path';

const REQUIRED_TABLES=['flight_jobs','job_interactions','worker_runtime','job_start_events','source_policy'];
const REQUIRED_JOB_COLUMNS=['id','request_key','input_hash','input','status','created','updated','deadline','attempts','lease_token','lease_until','progress','result','error','checkpoint','recoveries','kind','owner_hash'];
const quoteLiteral=value=>`'${value.replaceAll("'","''")}'`;
const ENCRYPTED_MAGIC=Buffer.from('THPDBE1\0','ascii');
const ENCRYPTED_HEADER_LENGTH=ENCRYPTED_MAGIC.length+12;
const GCM_TAG_LENGTH=16;

function databasePath(value,label){
 if(typeof value!=='string'||!value.trim()||value===':memory:')throw Error(`${label} must be a file path.`);
 return resolve(value);
}

function openDatabase(path){
 const db=new DatabaseSync(path,{readOnly:true});
 db.exec('PRAGMA busy_timeout=5000;');
 return db;
}

function stopRestoredJobs(path){
 const db=new DatabaseSync(path);let committed=false;
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
  const changed=db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,lease_until=NULL,progress=CASE WHEN json_valid(progress) THEN json_remove(progress,'$.challenge') ELSE NULL END WHERE status IN ('queued','running','paused')")
   .run(JSON.stringify({error:'Search was interrupted by database restore. Review it and start a fresh search explicitly.'}),Date.now()).changes;
  db.exec('COMMIT;');committed=true;
  db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');
  return changed;
 }catch(error){if(!committed){try{db.exec('ROLLBACK;');}catch{}}throw error;}
 finally{db.close();}
}

export function verifyJobDatabase(path){
 const file=databasePath(path,'Database');
 let info;try{info=lstatSync(file);}catch{throw Error('Database file does not exist.');}
 if(!info.isFile()||info.isSymbolicLink())throw Error('Database path must be a regular, non-symlink file.');
 let db;try{db=openDatabase(file);}catch{throw Error('Database could not be opened read-only.');}
 try{
  const integrity=db.prepare('PRAGMA integrity_check').all();
  if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw Error('SQLite integrity check failed.');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite foreign-key check failed.');
  const tables=new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name));
  if(REQUIRED_TABLES.some(name=>!tables.has(name)))throw Error('Database is missing required job-store tables.');
  const columns=new Set(db.prepare('PRAGMA table_info(flight_jobs)').all().map(row=>row.name));
  if(REQUIRED_JOB_COLUMNS.some(name=>!columns.has(name)))throw Error('Database job schema is incomplete; run the matching application migration first.');
  return {integrity:'ok',tableCount:tables.size,bytes:info.size};
 }finally{db.close();}
}

async function createVerifiedCopy({sourcePath,targetPath,operation}){
 const source=databasePath(sourcePath,'Source database'),target=databasePath(targetPath,'Destination');
 if(source===target)throw Error('Source and destination must be different files.');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 let directory;
 try{
  directory=await mkdtemp(join(dirname(target),'.travel-job-database-'));
  const snapshot=join(directory,'snapshot.sqlite');
  const db=openDatabase(source);
  try{db.exec(`VACUUM INTO ${quoteLiteral(snapshot)}`);}finally{db.close();}
  await chmod(snapshot,0o600);
  const interruptedActiveJobs=operation==='restore'?stopRestoredJobs(snapshot):0;
  const checked=verifyJobDatabase(snapshot);
  await link(snapshot,target);
  const targetInfo=await stat(target);
  await chmod(target,0o600);
  await unlink(snapshot);
  return {status:'ok',operation,integrity:checked.integrity,bytes:targetInfo.size,...(operation==='restore'?{interruptedActiveJobs}:{})};
 }catch(error){
  if(error?.code==='EEXIST')throw Error('Destination already exists; choose a new path.');
  throw error;
 }finally{if(directory)await rm(directory,{recursive:true,force:true});}
}

export function backupJobDatabase({sourcePath,targetPath}){
 return createVerifiedCopy({sourcePath,targetPath,operation:'backup'});
}

export function restoreJobDatabase({backupPath,targetPath}){
 return createVerifiedCopy({sourcePath:backupPath,targetPath,operation:'restore'});
}

async function backupKey(keyPath){
 const file=databasePath(keyPath,'Backup key');
 let handle;
 try{handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));}
 catch(error){if(error?.code==='ENOENT')throw Error('Backup key file does not exist. Generate a key file before encrypted backup operations.');if(error?.code==='ELOOP')throw Error('Backup key must be a regular non-symlink file with owner-only permissions (0600).');throw Error('Backup key file could not be opened safely.');}
 try{
  const info=await handle.stat();
  if(!info.isFile()||(info.mode&0o077)!==0||typeof process.getuid==='function'&&info.uid!==process.getuid())throw Error('Backup key must be a regular non-symlink file owned by this user with owner-only permissions (0600).');
  if(info.size>128)throw Error('Backup key file has an invalid size.');
  let value;try{const contents=Buffer.alloc(129),{bytesRead}=await handle.read(contents,0,contents.length,0);if(bytesRead>128)throw Error('Backup key file has an invalid size.');value=contents.subarray(0,bytesRead).toString('utf8').trim();}catch(error){if(error?.message==='Backup key file has an invalid size.')throw error;throw Error('Backup key file could not be read.');}
  if(!/^[a-fA-F0-9]{64}$/.test(value))throw Error('Backup key file must contain exactly 32 bytes encoded as 64 hexadecimal characters.');
  return Buffer.from(value,'hex');
 }finally{await handle.close();}
}

export async function generateJobBackupKey({targetPath}){
 const target=databasePath(targetPath,'Backup key destination');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 const value=`${randomBytes(32).toString('hex')}\n`;
 try{await writeFile(target,value,{flag:'wx',mode:0o600});}
 catch(error){if(error?.code==='EEXIST')throw Error('Destination already exists; choose a new key-file path.');throw error;}
 await chmod(target,0o600);
 return {status:'ok',operation:'keygen',bytes:32,mode:'0600'};
}

async function encryptDatabaseFile({sourcePath,targetPath,key}){
 const source=databasePath(sourcePath,'Source database'),target=databasePath(targetPath,'Encrypted backup destination');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const appendTag=new Transform({transform(chunk,_encoding,callback){callback(null,chunk);},flush(callback){this.push(cipher.getAuthTag());callback();}});
 const output=createWriteStream(target,{flags:'wx',mode:0o600});let created=false;
 const opened=new Promise((resolveOpen,rejectOpen)=>{output.once('open',()=>{created=true;resolveOpen();});output.once('error',rejectOpen);});
 try{
  await opened;
  if(!output.write(Buffer.concat([ENCRYPTED_MAGIC,iv])))await new Promise((resolveDrain,rejectDrain)=>{output.once('drain',resolveDrain);output.once('error',rejectDrain);});
  await pipeline(createReadStream(source),cipher,appendTag,output);
  await chmod(target,0o600);
  return {status:'ok',integrity:'ok',formatVersion:1,bytes:(await stat(target)).size,mode:'0600'};
 }catch(error){if(created)await unlink(target).catch(()=>{});if(error?.code==='EEXIST')throw Error('Destination already exists; choose a new path.');throw error;}
}

async function decryptedDatabase(backupPath,key,action){
 const source=databasePath(backupPath,'Encrypted backup');
 let handle;
 try{handle=await open(source,constants.O_RDONLY|(constants.O_NOFOLLOW??0));}
 catch(error){if(error?.code==='ENOENT')throw Error('Encrypted backup file does not exist.');if(error?.code==='ELOOP')throw Error('Encrypted backup path must be a regular non-symlink file.');throw Error('Encrypted backup file could not be opened safely.');}
 try{
  const info=await handle.stat();
  if(!info.isFile()||info.size<ENCRYPTED_HEADER_LENGTH+GCM_TAG_LENGTH)throw Error('Encrypted backup has an invalid file shape.');
  const header=Buffer.alloc(ENCRYPTED_HEADER_LENGTH),tag=Buffer.alloc(GCM_TAG_LENGTH);
  const headerRead=await handle.read(header,0,header.length,0),tagRead=await handle.read(tag,0,tag.length,info.size-GCM_TAG_LENGTH);
  if(headerRead.bytesRead!==header.length||tagRead.bytesRead!==tag.length||!header.subarray(0,ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC))throw Error('Encrypted backup format is invalid or unsupported.');
  const iv=header.subarray(ENCRYPTED_MAGIC.length),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
  const directory=await mkdtemp(join(tmpdir(),'travel-job-decrypt-')),plain=join(directory,'verified.sqlite');
  try{
   await pipeline(handle.createReadStream({start:ENCRYPTED_HEADER_LENGTH,end:info.size-GCM_TAG_LENGTH-1,autoClose:false}),decipher,createWriteStream(plain,{flags:'wx',mode:0o600}));
   await chmod(plain,0o600);
   return await action(plain);
  }catch(error){if(error?.code==='ERR_OSSL_EVP_BAD_DECRYPT'||error?.code==='ERR_CRYPTO_AUTH_FAILED'||/bad decrypt|authentication failed/i.test(error?.message??''))throw Error('Encrypted backup authentication failed; check the key and file integrity.');throw error;}
  finally{await rm(directory,{recursive:true,force:true});}
 }finally{await handle.close();}
}

export async function backupEncryptedJobDatabase({sourcePath,targetPath,keyPath}){
 const key=await backupKey(keyPath),source=databasePath(sourcePath,'Source database'),target=databasePath(targetPath,'Encrypted backup destination');
 if(source===target)throw Error('Source and destination must be different files.');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 const directory=await mkdtemp(join(dirname(target),'.travel-job-encrypted-'));
 const snapshot=join(directory,'snapshot.sqlite');
 try{
  const db=openDatabase(source);try{db.exec(`VACUUM INTO ${quoteLiteral(snapshot)}`);}finally{db.close();}
  await chmod(snapshot,0o600);const checked=verifyJobDatabase(snapshot);
  const encrypted=await encryptDatabaseFile({sourcePath:snapshot,targetPath:target,key});
  const verified=await decryptedDatabase(target,key,verifyJobDatabase);
  return {status:'ok',operation:'backup-encrypted',integrity:verified.integrity,formatVersion:encrypted.formatVersion,bytes:encrypted.bytes,mode:'0600',sourceTables:checked.tableCount};
 }finally{await rm(directory,{recursive:true,force:true});}
}

export async function verifyEncryptedJobDatabase({backupPath,keyPath}){
 const key=await backupKey(keyPath),verified=await decryptedDatabase(backupPath,key,verifyJobDatabase);
 return {status:'ok',operation:'verify-encrypted',...verified,formatVersion:1};
}

export async function restoreEncryptedJobDatabase({backupPath,targetPath,keyPath}){
 const key=await backupKey(keyPath);
 return decryptedDatabase(backupPath,key,async plain=>({...await restoreJobDatabase({backupPath:plain,targetPath}),operation:'restore-encrypted'}));
}
