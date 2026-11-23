'use client';
import {useCallback,useEffect,useState} from 'react';

export default function WorkerStatus(){
 const [health,setHealth]=useState(null),[error,setError]=useState(''),[checking,setChecking]=useState(false);
 const check=useCallback(async()=>{
  setChecking(true);setError('');
  try{
   const response=await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Worker status request failed.');
   if(!['ok','degraded'].includes(body.status)||typeof body.workerAvailable!=='boolean')throw Error('Worker status response was incomplete.');
   setHealth(body);
  }catch(cause){setError(cause instanceof Error?cause.message:'Worker status is unavailable.');setHealth(null);}
  finally{setChecking(false);}
 },[]);
 useEffect(()=>{
  void check();
  const timer=setInterval(()=>void check(),15000);
  return ()=>clearInterval(timer);
 },[check]);
 const message=error
  ? `Local search worker status is unavailable: ${error}`
  : !health
   ? 'Checking the local search worker…'
   : !health.workerAvailable
    ? `Search worker unavailable; submitted jobs may stay queued. Start it locally with “npm run worker”. Queue: ${health.queueDepth}.`
    : health.status==='degraded'
     ? `Search worker is online, but job health needs attention (${health.expiredLeases} expired leases, ${health.expiredDeadlines} expired deadlines).`
     : `Search worker online · queue ${health.queueDepth}.`;
 return <aside className="note worker-status" aria-label="Search worker status"><p role="status" aria-live="polite">{message}</p><button type="button" onClick={check} disabled={checking}>{checking?'Checking…':'Refresh worker status'}</button></aside>;
}
