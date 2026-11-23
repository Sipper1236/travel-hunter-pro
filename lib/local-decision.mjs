import {spawn} from 'node:child_process';
import {existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';

const state=globalThis.__travelDecision ??= {worker:null,ready:false,pending:new Map(),failedAt:0};
function start(){
 const python=join(process.cwd(),'.venv-laya/bin/python'), script=join(process.cwd(),'scripts/destination-model.py'), weights=join(process.cwd(),'.cache/laya-model/model.safetensors');
 if(!existsSync(python)||!existsSync(script)||!existsSync(weights))return;
 const version=statSync(script).mtimeMs;
 if(state.worker && state.version !== version){state.worker.kill();state.worker=null;state.ready=false;for(const pending of state.pending.values()){clearTimeout(pending.timer);pending.resolve(null);}state.pending.clear();}
 if(state.worker || Date.now()-state.failedAt<60000)return;
 const child=spawn(python,[script],{cwd:process.cwd(),stdio:['pipe','pipe','ignore'],env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});
 state.worker=child;state.ready=false;state.version=version;
 createInterface({input:child.stdout}).on('line',line=>{
  let message;try{message=JSON.parse(line);}catch{return;}
  if(message.ready){state.ready=true;return;}
  const pending=state.pending.get(message.id);if(!pending)return;state.pending.delete(message.id);clearTimeout(pending.timer);pending.resolve(message.error?null:message.answers);
 });
 const close=()=>{if(state.worker!==child)return;state.worker=null;state.ready=false;state.failedAt=Date.now();for(const p of state.pending.values()){clearTimeout(p.timer);p.resolve(null);}state.pending.clear();};
 child.on('exit',close);child.on('error',close);
}
async function infer(descriptions,mode){
 start();
 if(!state.ready||!Array.isArray(descriptions)||!descriptions.length)return null;
 const child=state.worker,id=randomUUID();
 return new Promise(resolve=>{
  const timer=setTimeout(()=>{state.pending.delete(id);resolve(null);},25000);
  state.pending.set(id,{resolve,timer});
  child.stdin.write(JSON.stringify({id,mode,descriptions:descriptions.slice(0,12).map(x=>x.slice(0,mode==='preferences'?600:400))})+'\n',err=>{if(err){clearTimeout(timer);state.pending.delete(id);resolve(null);}});
 });
}
export function classifyDescriptions(descriptions){return infer(descriptions,'destination');}
export async function interpretPreferences(text){return infer([text],'preferences');}
export function localModelStatus(){return state.ready?'ready':state.worker?'starting':'unavailable';}
