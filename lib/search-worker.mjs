import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createJobStore} from './job-store.mjs';

export function startSearchWorker({store=createJobStore(),pollMs=1000,spawn=()=>fork(new URL('../scripts/flight-job-runner.mjs',import.meta.url),[],{stdio:['ignore','ignore','inherit','ipc']})}={}) {
  const workerId=randomUUID();let active=null,stopped=false;
  const terminate=child=>{
    const timeout=setTimeout(()=>child.kill('SIGKILL'),15000);timeout.unref();
    child.once('exit',()=>clearTimeout(timeout));
    child.kill('SIGTERM');
  };
  const stopChild=()=>{if(active && !active.stopping){active.stopping=true;terminate(active.child);}};
  const tick=()=>{
    if(stopped)return;
    store.workerHeartbeat(workerId,active?.kind);
    if(active){
      if(!active.stopping){
        if(!store.heartbeat(active.id,active.token))stopChild();
        else if(active.kind==='hotel'){const command=store.takeInteraction(active.id,active.token);if(command)active.child.send({interaction:command});}
      }
      return;
    }
    const claim=store.claim();if(!claim)return;
    const child=spawn();active={...claim,child};
    const fail=()=>{if(stopped || active?.child!==child)return;store.finish(claim.id,claim.token,{error:{error:'The search worker stopped before returning a result. Start a new search.'}});active=null;};
    child.on('error',fail);
    child.on('exit',()=>{if(active?.child===child){if(active.stopping)active=null;else fail();}});
    child.on('message',message=>{
      if(active?.child!==child || active.stopping)return;
      if(message.interactionResult){store.finishInteraction(claim.id,claim.token,message.interactionResult.id,message.interactionResult.error);return;}
      if(message.checkpoint){
        if(store.checkpoint(claim.id,claim.token,message.checkpoint))child.send({checkpointAck:message.sequence});
        else stopChild();
        return;
      }
      if(message.progress){if(!store.heartbeat(claim.id,claim.token,message.progress))stopChild();return;}
      if(message.result || message.error){store.finish(claim.id,claim.token,message);active=null;terminate(child);}
    });
    child.send({kind:claim.kind,input:claim.input,checkpoint:claim.checkpoint});
  };
  const timer=setInterval(()=>{try{tick();}catch(error){console.error('Search worker database failure:',error.message);}},pollMs);
  tick();
  return {stop(){if(stopped)return;stopped=true;clearInterval(timer);try{store.workerStopped(workerId);}finally{stopChild();store.close();}}};
}
