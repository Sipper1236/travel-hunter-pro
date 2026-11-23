import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'travel-hunter-stack-check-'));
const isolatedDistDir=`.next-local-stack-check-${process.pid}`;
const probe=createServer();
await new Promise((resolve,reject)=>probe.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const env={...process.env,PORT:String(port),TRAVEL_JOB_DB:join(temp,'search.sqlite'),TRAVEL_NEXT_DIST_DIR:isolatedDistDir,NEXT_TELEMETRY_DISABLED:'1'};
delete env.NODE_ENV;
const child=spawn(process.execPath,['scripts/local-stack.mjs'],{cwd:root,env,stdio:['ignore','ignore','ignore']});
let launchError=null;
child.once('error',error=>{launchError=error;});
const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
const origin=`http://127.0.0.1:${port}`;
let health=null;

async function stop(){
  if(child.exitCode!==null||child.signalCode!==null)return await closed;
  child.kill('SIGTERM');
  let timer;
  const result=await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),10000);})]);
  clearTimeout(timer);
  if(result)return result;
  child.kill('SIGKILL');
  return await closed;
}

try{
  for(let attempt=0;attempt<120;attempt++){
    if(launchError)throw Error(`Could not launch local stack: ${launchError.message}`);
    if(child.exitCode!==null||child.signalCode!==null)throw Error('Local stack exited before becoming ready.');
    try{
      const page=await fetch(origin,{signal:AbortSignal.timeout(1200)});
      const response=await fetch(`${origin}/api/health`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(1200)});
      const state=await response.json();
      if(page.status===200&&response.ok&&state.workerAvailable){health=state;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(health,'Local web app and worker did not become ready within 60 seconds.');
  assert.equal(health.status,'ok');
  assert.equal(health.queueDepth,0);
  const exit=await stop();
  assert.equal(exit.code,0,'Local stack did not shut down cleanly.');
  const available=createServer();
  await new Promise((resolve,reject)=>available.once('error',reject).listen(port,'127.0.0.1',resolve));
  await new Promise(resolve=>available.close(resolve));
  console.log(JSON.stringify({check:'local-stack',webHttpStatus:200,workerAvailable:true,queueDepth:0,gracefulShutdown:true,providerSearches:0,temporaryDatabase:true}));
}finally{
  await stop();
  await rm(join(root,isolatedDistDir),{recursive:true,force:true});
  await rm(temp,{recursive:true,force:true});
}
