import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,join} from 'node:path';

export const defaultJobPath = () => process.env.TRAVEL_JOB_DB || join(process.cwd(),'.cache','jobs','search.sqlite');
const TERMINAL_JOB_RETENTION_MS=24*60*60*1000;
const WORKER_RECOVERY_BASE_DELAY_MS=1000;
const WORKER_RECOVERY_MAX_DELAY_MS=30000;
export const validJobOwnerToken = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const ownerDigest = value => createHash('sha256').update(value).digest('hex');

export function createJobStore({path=defaultJobPath(),now=Date.now,leaseMs=30000,maxActive=20,maxActivePerOwner=5,maxStartsPerWindow=30,maxStartsPerOwnerPerWindow=10,startWindowMs=60000}={}) {
  if(path!==':memory:'){mkdirSync(dirname(path),{recursive:true,mode:0o700});}
  const db=new DatabaseSync(path);
  if(path!==':memory:')chmodSync(path,0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS flight_jobs (
      id TEXT PRIMARY KEY, request_key TEXT UNIQUE, input_hash TEXT NOT NULL, input TEXT NOT NULL,
      status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, deadline INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER, next_attempt_at INTEGER NOT NULL DEFAULT 0,
      progress TEXT, result TEXT, error TEXT
    );
    CREATE TABLE IF NOT EXISTS job_interactions (id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES flight_jobs(id) ON DELETE CASCADE,input TEXT NOT NULL,status TEXT NOT NULL,lease_token TEXT,error TEXT,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS interaction_job_status ON job_interactions(job_id,status,created);
    CREATE TABLE IF NOT EXISTS worker_runtime (id TEXT PRIMARY KEY,status TEXT NOT NULL,started INTEGER NOT NULL,heartbeat INTEGER NOT NULL,active_kind TEXT);
    CREATE TABLE IF NOT EXISTS job_start_events (id INTEGER PRIMARY KEY AUTOINCREMENT,owner_hash TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS job_start_events_created ON job_start_events(created);
    CREATE INDEX IF NOT EXISTS job_start_events_owner_created ON job_start_events(owner_hash,created);
    CREATE TABLE IF NOT EXISTS matrix_response_cache (cache_key TEXT PRIMARY KEY,saved_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,result TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS matrix_response_cache_expiry ON matrix_response_cache(expires_at);
    CREATE TABLE IF NOT EXISTS provider_response_cache (cache_key TEXT PRIMARY KEY,saved_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,result TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS provider_response_cache_expiry ON provider_response_cache(expires_at);
    CREATE TRIGGER IF NOT EXISTS end_job_interactions AFTER UPDATE OF status ON flight_jobs WHEN NEW.status IN ('complete','error','cancelled') BEGIN UPDATE job_interactions SET status='error',error='Browser session ended.' WHERE job_id=NEW.id AND status IN ('pending','inflight'); END;
    CREATE TABLE IF NOT EXISTS source_policy (provider TEXT PRIMARY KEY,next_allowed INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0,status TEXT);`);
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns=new Set(db.prepare('PRAGMA table_info(flight_jobs)').all().map(column=>column.name));
    if(!columns.has('checkpoint'))db.exec('ALTER TABLE flight_jobs ADD COLUMN checkpoint TEXT');
    if(!columns.has('recoveries'))db.exec('ALTER TABLE flight_jobs ADD COLUMN recoveries INTEGER NOT NULL DEFAULT 0');
    if(!columns.has('kind'))db.exec("ALTER TABLE flight_jobs ADD COLUMN kind TEXT NOT NULL DEFAULT 'flight'");
    if(!columns.has('owner_hash'))db.exec('ALTER TABLE flight_jobs ADD COLUMN owner_hash TEXT');
    if(!columns.has('next_attempt_at'))db.exec('ALTER TABLE flight_jobs ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0');
    db.prepare("UPDATE flight_jobs SET status='cancelled',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge'),lease_until=NULL WHERE owner_hash IS NULL AND status IN ('queued','running','paused')").run(JSON.stringify({error:'The prior local job did not have an owner capability. Start a new search.'}),now());
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  db.prepare('DELETE FROM matrix_response_cache WHERE expires_at<=?').run(now());
  db.prepare('DELETE FROM provider_response_cache WHERE expires_at<=?').run(now());
  const row=id=>db.prepare('SELECT * FROM flight_jobs WHERE id=?').get(id);
  const decode=r=>{
    if(!r)return null;
    const retryAt=r.status==='queued'&&r.next_attempt_at>now()?new Date(r.next_attempt_at).toISOString():undefined;
    return {id:r.id,kind:r.kind,status:r.status,...(retryAt?{retryAt}:{}),...(['comparison','calendar','hotel'].includes(r.kind)?{input:JSON.parse(r.input)}:{}),createdAt:new Date(r.created).toISOString(),updatedAt:new Date(r.updated).toISOString(),attempts:r.attempts,interaction:db.prepare('SELECT id,status,error FROM job_interactions WHERE job_id=? ORDER BY created DESC,rowid DESC LIMIT 1').get(r.id) ?? null,progress:r.progress?JSON.parse(r.progress):null,result:r.result?JSON.parse(r.result):null,error:r.error?JSON.parse(r.error):null};
  };
  function findOffer(value,ignavId){
    if(!value||typeof value!=='object')return null;
    if(value.ignavId===ignavId&&Array.isArray(value.segments))return value;
    for(const child of Object.values(value)){const found=findOffer(child,ignavId);if(found)return found;}
    return null;
  }
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}
  let lastRetentionSweep=-Infinity;
  function pruneTerminalJobs(force=false){
    const at=now();if(!force&&at-lastRetentionSweep<60_000)return 0;
    const removed=db.prepare("DELETE FROM flight_jobs WHERE status IN ('complete','error','cancelled') AND updated<=?").run(at-TERMINAL_JOB_RETENTION_MS).changes;
    lastRetentionSweep=at;return removed;
  }
  pruneTerminalJobs(true);
  return {
    submit(input,requestKey,{kind='flight',ownerToken}={}) {return transaction(()=>{
      if(!['flight','package','hotel','comparison','calendar'].includes(kind))throw Error('Choose a supported search product.');
      if(typeof requestKey!=='string'||! /^[A-Za-z0-9_-]{8,100}$/.test(requestKey))throw Error('Provide a valid search request key.');
      if(ownerToken!==undefined&&!validJobOwnerToken(ownerToken))throw Error('Provide a valid job owner capability.');const digest=ownerDigest(ownerToken ?? randomUUID());
      const encoded=JSON.stringify(input),hash=createHash('sha256').update(encoded).digest('hex');
      const existing=db.prepare('SELECT * FROM flight_jobs WHERE request_key=?').get(requestKey);
      if(existing){if(existing.input_hash!==hash || existing.kind!==kind)throw Error('Search request key was reused with different input.');if(ownerToken!==undefined&&existing.owner_hash&&!timingSafeEqual(Buffer.from(existing.owner_hash,'hex'),Buffer.from(digest,'hex')))throw Error('Search request key belongs to another job owner.');return decode(existing);}
      db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE status IN ('queued','running','paused') AND deadline<=?").run(JSON.stringify({error:'Search expired before completion. Start a new search.'}),now(),now());
      pruneTerminalJobs(true);
      const at=now(),windowStart=at-startWindowMs;
      db.prepare('DELETE FROM job_start_events WHERE created<=?').run(windowStart);
      const totalStarts=db.prepare('SELECT count(*) AS n FROM job_start_events WHERE created>?').get(windowStart).n;
      const ownerStarts=ownerToken===undefined?0:db.prepare('SELECT count(*) AS n FROM job_start_events WHERE owner_hash=? AND created>?').get(digest,windowStart).n;
      if(totalStarts>=maxStartsPerWindow||ownerStarts>=maxStartsPerOwnerPerWindow){
        const oldest=totalStarts>=maxStartsPerWindow
          ?db.prepare('SELECT MIN(created) AS oldest FROM job_start_events WHERE created>?').get(windowStart).oldest
          :db.prepare('SELECT MIN(created) AS oldest FROM job_start_events WHERE owner_hash=? AND created>?').get(digest,windowStart).oldest;
        const error=new Error('Too many new searches in a short period. Wait before starting another search.');error.status=429;error.retryAfterSeconds=Math.max(1,Math.ceil((oldest+startWindowMs-at)/1000));throw error;
      }
      if(ownerToken!==undefined&&db.prepare("SELECT count(*) AS n FROM flight_jobs WHERE owner_hash=? AND status IN ('queued','running','paused')").get(digest).n>=maxActivePerOwner){const error=new Error(`This browser can have at most ${maxActivePerOwner} active searches. Wait for one to finish or cancel it.`);error.status=429;throw error;}
      if(db.prepare("SELECT count(*) AS n FROM flight_jobs WHERE status IN ('queued','running','paused')").get().n>=maxActive)throw Error('The search queue is full. Wait for a search to finish.');
      const id=randomUUID();
      db.prepare("INSERT INTO flight_jobs(id,request_key,input_hash,input,status,created,updated,deadline,progress,kind,owner_hash) VALUES(?,?,?,?,'queued',?,?,?,?,?,?)").run(id,requestKey,hash,encoded,at,at,at+15*60000,JSON.stringify({stage:'queued'}),kind,digest);
      db.prepare('INSERT INTO job_start_events(owner_hash,created) VALUES(?,?)').run(digest,at);
      return decode(row(id));
    });},
    authorize(id,ownerToken){
      if(typeof id!=='string'||!validJobOwnerToken(ownerToken))return false;
      const stored=db.prepare('SELECT owner_hash FROM flight_jobs WHERE id=?').get(id)?.owner_hash;
      if(typeof stored!=='string'||! /^[a-f0-9]{64}$/.test(stored))return false;
      return timingSafeEqual(Buffer.from(stored,'hex'),Buffer.from(ownerDigest(ownerToken),'hex'));
    },
    remove(id,ownerToken){return transaction(()=>{
      if(!this.authorize(id,ownerToken))return null;
      const job=row(id);
      if(!['complete','error','cancelled'].includes(job.status))throw Error('Cancel this search or wait for it to finish before deleting it.');
      if(job.lease_until>now())throw Error('The search is still cleaning up. Wait a moment before deleting it.');
      db.prepare('DELETE FROM flight_jobs WHERE id=?').run(id);
      return {id,kind:job.kind,status:'deleted'};
    });},
    get(id){
      pruneTerminalJobs();
      const at=now();
      let current=row(id);if(!current)return null;
      if(['complete','error','cancelled'].includes(current.status)&&current.updated<=at-TERMINAL_JOB_RETENTION_MS){db.prepare('DELETE FROM flight_jobs WHERE id=?').run(id);return null;}
      if(['package','hotel'].includes(current.kind)&&current.status==='running'&&current.lease_until<=at){db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE id=? AND status='running' AND lease_until<=?").run(JSON.stringify({error:'The provider browser session was lost. Start a new search explicitly.'}),at,id,at);}
      else if(['queued','running','paused'].includes(current.status)&&current.deadline<=at){db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE id=? AND status IN ('queued','running','paused') AND deadline<=?").run(JSON.stringify({error:'Search expired before completion. Start a new search.'}),at,id,at);}
      return decode(row(id));
    },
    findFlightOffer(ignavId,ownerToken){
      pruneTerminalJobs();
      if(typeof ignavId!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(ignavId)||!validJobOwnerToken(ownerToken))return null;
      const records=db.prepare("SELECT result FROM flight_jobs WHERE status='complete' AND kind IN ('flight','calendar','comparison') AND owner_hash=? AND updated>? AND result LIKE ? ORDER BY updated DESC LIMIT 100").all(ownerDigest(ownerToken),now()-TERMINAL_JOB_RETENTION_MS,`%${ignavId}%`);
      for(const record of records){try{const found=findOffer(JSON.parse(record.result),ignavId);if(found)return found;}catch{}}
      return null;
    },
    getMatrixResponse(cacheKey,at=now()){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey)||!Number.isSafeInteger(at))return null;
      const cached=db.prepare('SELECT expires_at,result FROM matrix_response_cache WHERE cache_key=?').get(cacheKey);
      if(!cached)return null;
      if(cached.expires_at<=at){db.prepare('DELETE FROM matrix_response_cache WHERE cache_key=?').run(cacheKey);return null;}
      try{return JSON.parse(cached.result);}catch{db.prepare('DELETE FROM matrix_response_cache WHERE cache_key=?').run(cacheKey);return null;}
    },
    deleteMatrixResponse(cacheKey){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey))return false;
      return db.prepare('DELETE FROM matrix_response_cache WHERE cache_key=?').run(cacheKey).changes===1;
    },
    setMatrixResponse(cacheKey,result,expiresAt,savedAt=now()){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey)||!Number.isSafeInteger(savedAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=savedAt)return false;
      let encoded;try{encoded=JSON.stringify(result);}catch{return false;}
      if(typeof encoded!=='string'||Buffer.byteLength(encoded)>1_000_000)return false;
      return transaction(()=>{
        db.prepare('INSERT INTO matrix_response_cache(cache_key,saved_at,expires_at,result) VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET saved_at=excluded.saved_at,expires_at=excluded.expires_at,result=excluded.result').run(cacheKey,savedAt,expiresAt,encoded);
        db.prepare('DELETE FROM matrix_response_cache WHERE expires_at<=?').run(savedAt);
        db.prepare('DELETE FROM matrix_response_cache WHERE cache_key IN (SELECT cache_key FROM matrix_response_cache ORDER BY saved_at DESC,cache_key LIMIT -1 OFFSET 100)').run();
        return true;
      });
    },
    getProviderResponse(cacheKey,at=now()){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey)||!Number.isSafeInteger(at))return null;
      const cached=db.prepare('SELECT expires_at,result FROM provider_response_cache WHERE cache_key=?').get(cacheKey);
      if(!cached)return null;
      if(cached.expires_at<=at){db.prepare('DELETE FROM provider_response_cache WHERE cache_key=?').run(cacheKey);return null;}
      try{return JSON.parse(cached.result);}catch{db.prepare('DELETE FROM provider_response_cache WHERE cache_key=?').run(cacheKey);return null;}
    },
    deleteProviderResponse(cacheKey){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey))return false;
      return db.prepare('DELETE FROM provider_response_cache WHERE cache_key=?').run(cacheKey).changes===1;
    },
    setProviderResponse(cacheKey,result,expiresAt,savedAt=now()){
      if(typeof cacheKey!=='string'||! /^[a-f0-9]{64}$/.test(cacheKey)||!Number.isSafeInteger(savedAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=savedAt)return false;
      let encoded;try{encoded=JSON.stringify(result);}catch{return false;}
      if(typeof encoded!=='string'||Buffer.byteLength(encoded)>512_000)return false;
      return transaction(()=>{
        db.prepare('INSERT INTO provider_response_cache(cache_key,saved_at,expires_at,result) VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET saved_at=excluded.saved_at,expires_at=excluded.expires_at,result=excluded.result').run(cacheKey,savedAt,expiresAt,encoded);
        db.prepare('DELETE FROM provider_response_cache WHERE expires_at<=?').run(savedAt);
        db.prepare('DELETE FROM provider_response_cache WHERE cache_key IN (SELECT cache_key FROM provider_response_cache ORDER BY saved_at DESC,cache_key LIMIT -1 OFFSET 100)').run();
        return true;
      });
    },
    cancel(id){const at=now();db.prepare("UPDATE flight_jobs SET status='cancelled',updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge'),lease_until=CASE WHEN kind IN ('package','hotel') AND status='running' THEN ? ELSE NULL END WHERE id=? AND status IN ('queued','running','paused')").run(at,at+17000,id);return decode(row(id));},
    claim(){return transaction(()=>{
      const at=now();
      db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE kind IN ('package','hotel') AND status='running' AND lease_until<=?").run(JSON.stringify({error:'The provider browser session was lost. Start a new search explicitly.'}),at,at);
      db.prepare("UPDATE flight_jobs SET status='error',error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE status IN ('queued','running','paused') AND (deadline<=? OR (recoveries>=2 AND lease_until<=?))").run(JSON.stringify({error:'Search timed out or its worker repeatedly stopped. Start a new search.'}),at,at,at);
      db.prepare("UPDATE flight_jobs SET status='queued',updated=?,next_attempt_at=?+MIN(?,? * (1 << recoveries)),lease_token=NULL,lease_until=NULL,recoveries=recoveries+1 WHERE status='running' AND lease_until<=? AND deadline>? AND recoveries<2 AND kind NOT IN ('package','hotel')").run(at,at,WORKER_RECOVERY_MAX_DELAY_MS,WORKER_RECOVERY_BASE_DELAY_MS,at,at);
      const r=db.prepare("SELECT * FROM flight_jobs WHERE status='queued' AND next_attempt_at<=? AND (kind='flight' OR NOT EXISTS(SELECT 1 FROM flight_jobs AS running WHERE running.kind=flight_jobs.kind AND running.status IN ('running','cancelled') AND running.lease_until>?)) ORDER BY created,id LIMIT 1").get(at,at);
      if(!r)return null;
      const token=randomUUID();db.prepare("UPDATE flight_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_until=?,next_attempt_at=0,updated=?,progress=? WHERE id=?").run(token,at+leaseMs,at,JSON.stringify({stage:r.attempts?'recovering':'starting'}),r.id);
      return {id:r.id,kind:r.kind,input:JSON.parse(r.input),checkpoint:r.checkpoint?JSON.parse(r.checkpoint):undefined,token};
    });},
    heartbeat(id,token,progress) {
      const at=now();
      db.prepare("UPDATE flight_jobs SET status='error',updated=?,error=?,lease_token=NULL,progress=json_remove(progress,'$.challenge') WHERE id=? AND status='running' AND lease_token=? AND deadline<=?").run(at,JSON.stringify({error:'Search exceeded its 15-minute execution window.'}),id,token,at);
      const savedProgress=progress?.stage==='provider_results_streaming'?{...progress,persistedAt:new Date(at).toISOString()}:progress;
      return db.prepare("UPDATE flight_jobs SET lease_until=?,updated=?,progress=COALESCE(?,progress) WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND deadline>?").run(at+leaseMs,at,savedProgress?JSON.stringify(savedProgress):null,id,token,at,at).changes===1;
    },
    finish(id,token,{result,error}) {
      const at=now();return db.prepare("UPDATE flight_jobs SET status=?,result=?,error=?,updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge'),lease_until=NULL WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND deadline>?").run(error?'error':'complete',result?JSON.stringify(result):null,error?JSON.stringify(error):null,at,id,token,at,at).changes===1;
    },
    checkpoint(id,token,value) {
      const at=now();return db.prepare("UPDATE flight_jobs SET checkpoint=?,updated=? WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND deadline>?").run(JSON.stringify(value),at,id,token,at,at).changes===1;
    },
    interact(id,input,requestKey){return transaction(()=>{
      if(typeof requestKey!=='string'||! /^[A-Za-z0-9_-]{8,100}$/.test(requestKey))throw Error('Invalid verification input reference.');
      if(!['click','refresh'].includes(input?.kind))throw Error('Only direct user clicks or refresh are supported.');
      const safeInput=input.kind==='click'?{kind:'click',frameId:input.frameId,x:input.x,y:input.y}:{kind:'refresh'};
      const encoded=JSON.stringify(safeInput),existing=db.prepare('SELECT * FROM job_interactions WHERE id=?').get(requestKey);
      if(existing){if(existing.job_id!==id || existing.input!==encoded)throw Error('Verification input reference was reused.');return this.get(id);}
      const job=row(id),at=now();
      if(!job || job.kind!=='hotel' || job.status!=='running' || job.lease_until<=at || job.deadline<=at)throw Error('No live hotel browser session.');
      const frame=JSON.parse(job.progress || '{}').challenge;
      if(!frame)throw Error('No active provider verification.');
      if(input.kind==='click' && (input.frameId!==frame.id || !Number.isFinite(frame.capturedAt) || at-frame.capturedAt>15000 || !Number.isFinite(input.x)||!Number.isFinite(input.y)||input.x<0||input.y<0||input.x>=frame.width||input.y>=frame.height))throw Error('Verification image changed or click is outside it. Refresh and try again.');
      if(db.prepare("SELECT 1 FROM job_interactions WHERE job_id=? AND status IN ('pending','inflight')").get(id))throw Error('Wait for the previous verification input.');
      db.prepare("INSERT INTO job_interactions(id,job_id,input,status,created) VALUES(?,?,?,'pending',?)").run(requestKey,id,encoded,at);
      return this.get(id);
    });},
    takeInteraction(id,token){return transaction(()=>{
      const job=row(id),at=now();if(!job || job.status!=='running'||job.lease_token!==token||job.lease_until<=at||job.deadline<=at)return null;
      const command=db.prepare("SELECT * FROM job_interactions WHERE job_id=? AND status='pending' ORDER BY created,rowid LIMIT 1").get(id);if(!command)return null;
      db.prepare("UPDATE job_interactions SET status='inflight',lease_token=? WHERE id=?").run(token,command.id);
      return {id:command.id,input:JSON.parse(command.input)};
    });},
    finishInteraction(id,token,commandId,error){
      const job=row(id),at=now();if(!job||job.status!=='running'||job.lease_token!==token||job.lease_until<=at)return false;
      return db.prepare("UPDATE job_interactions SET status=?,error=? WHERE id=? AND job_id=? AND lease_token=? AND status='inflight'").run(error?'error':'complete',error?.slice(0,512) ?? null,commandId,id,token).changes===1;
    },
    workerHeartbeat(id,activeKind){const pruned=pruneTerminalJobs();const at=now();db.prepare(`INSERT INTO worker_runtime(id,status,started,heartbeat,active_kind) VALUES(?,'running',?,?,?) ON CONFLICT(id) DO UPDATE SET status='running',heartbeat=excluded.heartbeat,active_kind=excluded.active_kind`).run(id,at,at,['flight','package','hotel','comparison','calendar'].includes(activeKind)?activeKind:null);return pruned;},
    workerStopped(id){db.prepare("UPDATE worker_runtime SET status='stopped',heartbeat=?,active_kind=NULL WHERE id=?").run(now(),id);},
    operationalSnapshot(){
      const at=now(),jobs=db.prepare("SELECT kind,status,count(*) AS count,MIN(CASE WHEN status='queued' THEN created END) AS oldest_queued FROM flight_jobs GROUP BY kind,status ORDER BY kind,status").all();
      const workers=db.prepare('SELECT status,heartbeat,active_kind FROM worker_runtime').all().map(worker=>({status:worker.status,heartbeatAt:new Date(worker.heartbeat).toISOString(),activeKind:worker.active_kind,live:worker.status==='running'&&worker.heartbeat>=at-5000}));
      const active=jobs.filter(job=>['queued','running','paused'].includes(job.status)),queued=jobs.filter(job=>job.status==='queued');
      return {observedAt:new Date(at).toISOString(),queue:Object.fromEntries(active.map(job=>[`${job.kind}.${job.status}`,job.count])),oldestQueuedAt:queued.length?new Date(Math.min(...queued.map(job=>job.oldest_queued))).toISOString():null,workers:{running:workers.filter(worker=>worker.live).length,stale:workers.filter(worker=>worker.status==='running'&&!worker.live).length,stopped:workers.filter(worker=>worker.status==='stopped').length,records:workers},expiredLeases:db.prepare("SELECT count(*) AS count FROM flight_jobs WHERE status='running' AND lease_until<=?").get(at).count,expiredDeadlines:db.prepare("SELECT count(*) AS count FROM flight_jobs WHERE status IN ('queued','running','paused') AND deadline<=?").get(at).count};
    },
    reserveSource(provider,gapMs){return transaction(()=>{
      const at=now(),state=db.prepare('SELECT * FROM source_policy WHERE provider=?').get(provider);
      if(state?.blocked_until>at)return {blockedUntil:state.blocked_until,status:state.status};
      if(state?.next_allowed>at)return {waitMs:state.next_allowed-at};
      db.prepare('INSERT INTO source_policy(provider,next_allowed) VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET next_allowed=excluded.next_allowed').run(provider,at+gapMs);
      return {waitMs:0};
    });},
    deferSource(provider,until,status){db.prepare('INSERT INTO source_policy(provider,blocked_until,status) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET blocked_until=MAX(source_policy.blocked_until,excluded.blocked_until),status=CASE WHEN excluded.blocked_until>=source_policy.blocked_until THEN excluded.status ELSE source_policy.status END').run(provider,until,status);},
    pause(id){if(row(id) && !['flight','comparison','calendar'].includes(row(id).kind))throw Error('Browser searches support cancellation, not pause/resume.');db.prepare("UPDATE flight_jobs SET status='paused',updated=?,lease_token=NULL,progress=json_remove(progress,'$.challenge'),lease_until=NULL WHERE id=? AND status IN ('queued','running','paused') AND deadline>?").run(now(),id,now());return this.get(id);},
    resume(id){if(row(id) && !['flight','comparison','calendar'].includes(row(id).kind))throw Error('Start a new browser search explicitly.');db.prepare("UPDATE flight_jobs SET status='queued',updated=? WHERE id=? AND status='paused' AND deadline>?").run(now(),id,now());return this.get(id);},
    close(){db.close();},
  };
}

export function getJobStore(){return globalThis.__travelFlightJobStore ??= createJobStore();}
