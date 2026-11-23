import {AsyncLocalStorage} from 'node:async_hooks';
const context=new AsyncLocalStorage();
const bucketNames=['0_100','100_250','250_500','500_1000','1000_2500','2500_5000','5000_10000','10000_30000','30000_plus'];
const bucketLimits=[100,250,500,1000,2500,5000,10000,30000,Infinity];
const newLatency=()=>({samples:0,totalMs:0,maxMs:0,buckets:Object.fromEntries(bucketNames.map(key=>[key,0]))});
const validLatency=value=>value&&Number.isSafeInteger(value.samples)&&value.samples>=0&&Number.isSafeInteger(value.totalMs)&&value.totalMs>=0&&Number.isSafeInteger(value.maxMs)&&value.maxMs>=0&&value.buckets&&bucketNames.every(key=>Number.isSafeInteger(value.buckets[key])&&value.buckets[key]>=0)&&bucketNames.reduce((sum,key)=>sum+value.buckets[key],0)===value.samples;
const p95UpperBound=value=>{
 if(!value?.samples)return null;
 const target=Math.ceil(value.samples*0.95);let seen=0;
 for(let i=0;i<bucketNames.length;i++){seen+=value.buckets[bucketNames[i]];if(seen>=target)return Number.isFinite(bucketLimits[i])?bucketLimits[i]:null;}
 return null;
};
const addLatency=(target,source)=>{
 if(!validLatency(source))return;
 target.samples+=source.samples;target.totalMs+=source.totalMs;target.maxMs=Math.max(target.maxMs,source.maxMs);
 for(const key of bucketNames)target.buckets[key]+=source.buckets[key];
};
export function recordTransport(provider,event,attempt,status,durationMs){
 const state=context.getStore();if(!state)return;
 const row=state.providers[provider]??={attempts:0,retries:0,responses:0,networkFailures:0,httpStatuses:{},requestLatency:newLatency()};
 if(event==='attempt'){row.attempts++;if(attempt>1)row.retries++;}
 if(event==='response'){row.responses++;row.httpStatuses[String(status)]=(row.httpStatuses[String(status)]??0)+1;}
 if(event==='failure')row.networkFailures++;
 if(Number.isFinite(durationMs)&&durationMs>=0){const latency=row.requestLatency??=newLatency(),value=Math.max(0,Math.round(durationMs)),index=bucketLimits.findIndex(limit=>value<=limit);latency.samples++;latency.totalMs+=value;latency.maxMs=Math.max(latency.maxMs,value);latency.buckets[bucketNames[index<0?bucketNames.length-1:index]]++;}
}
export function transportSnapshot(){
 const state=context.getStore();if(!state)return undefined;
 const value=structuredClone(state);
 for(const row of Object.values(value.providers))if(row.requestLatency)row.requestLatency.p95UpperBoundMs=p95UpperBound(row.requestLatency);
 return value;
}
export function mergeTransportCoverage(...values){
 const providers={},coverages=values.flat().filter(value=>value&&typeof value==='object');
 for(const coverage of coverages)for(const [name,row] of Object.entries(coverage.providers??{})){
  const target=providers[name]??={attempts:0,retries:0,responses:0,networkFailures:0,httpStatuses:{},requestLatency:newLatency()};
  for(const key of ['attempts','retries','responses','networkFailures'])target[key]+=(row[key]??0);
  for(const [status,count] of Object.entries(row.httpStatuses??{}))target.httpStatuses[status]=(target.httpStatuses[status]??0)+count;
  addLatency(target.requestLatency,row.requestLatency);
 }
 for(const row of Object.values(providers))row.requestLatency.p95UpperBoundMs=p95UpperBound(row.requestLatency);
 return {providers,includesUnobservedInterruptedAttempts:coverages.some(value=>value.includesUnobservedInterruptedAttempts),scope:'Shared HTTP transport only; direct fetch/browser traffic is not counted.'};
}
export async function withTransportMetrics(operation,{previous,interrupted=false}={}){
 const parent=context.getStore();
 let providers={};
 if(previous?.providers&&typeof previous.providers==='object'){
  for(const [name,row] of Object.entries(previous.providers)){
   if(!/^[A-Za-z0-9 ._-]{1,80}$/.test(name)||!row||['attempts','retries','responses','networkFailures'].some(key=>!Number.isSafeInteger(row[key])||row[key]<0))throw Error('Invalid saved transport metrics.');
   if(!row.httpStatuses||Object.entries(row.httpStatuses).some(([code,count])=>!/^\d{3}$/.test(code)||!Number.isSafeInteger(count)||count<0))throw Error('Invalid saved HTTP metrics.');
   const saved=structuredClone(row);
   if(saved.requestLatency!==undefined&&!validLatency(saved.requestLatency))throw Error('Invalid saved request-latency metrics.');
   if(!saved.requestLatency)saved.requestLatency=newLatency();
   providers[name]=saved;
  }
 }
 return context.run({providers,includesUnobservedInterruptedAttempts:Boolean(interrupted||previous?.includesUnobservedInterruptedAttempts),scope:'Shared HTTP transport only; direct fetch/browser traffic is not counted. Counts after interrupted queries may be lower bounds.'},async()=>{
  const result=await operation(),coverage=transportSnapshot();
  // Nested provider runs (for example, each calendar date or adapter) must
  // contribute to the enclosing job summary after their isolated context ends.
  if(parent){const merged=mergeTransportCoverage({providers:parent.providers,includesUnobservedInterruptedAttempts:parent.includesUnobservedInterruptedAttempts},coverage);parent.providers=merged.providers;parent.includesUnobservedInterruptedAttempts=merged.includesUnobservedInterruptedAttempts;}
  return {...result,transportCoverage:coverage};
 });
}
