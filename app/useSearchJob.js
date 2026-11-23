'use client';
import {useEffect,useRef,useState} from 'react';
const active=job=>job && ['queued','running','paused'].includes(job.status);
async function call(body){const response=await fetch('/api/search/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error || 'Search job request failed.'),{status:response.status});return data;}

export default function useSearchJob(handlers,{kind='flight',storageKey=`travel-hunter-${kind}-job`}={}) {
  const callbacks=useRef(handlers);callbacks.current=handlers;
  const [job,setJob]=useState(null),[starting,setStarting]=useState(false),[connectionMessage,setConnectionMessage]=useState('');
  const [interacting,setInteracting]=useState(false),[interactionError,setInteractionError]=useState('');
  const [removing,setRemoving]=useState(false);
  const submitting=useRef(false);
  useEffect(()=>{try{const raw=sessionStorage.getItem(storageKey);if(!raw)return;let saved;try{saved=JSON.parse(raw);}catch{sessionStorage.removeItem(storageKey);return;}if(saved&&typeof saved.id==='string'&&typeof saved.ownerToken==='string')setJob({id:saved.id,ownerToken:saved.ownerToken,status:'queued'});else sessionStorage.removeItem(storageKey);}catch{}},[]);
  useEffect(()=>{
    if(!job?.id)return;
    let stopped=false,timer,failures=0;
    const poll=async()=>{
      try{
        const next=await call({action:'status',id:job.id,ownerToken:job.ownerToken});if(stopped)return;
        if(next.kind && next.kind!==kind)throw Object.assign(Error('Saved job belongs to a different search product.'),{status:404});
        if(callbacks.current.acceptJob&&!callbacks.current.acceptJob(next))throw Object.assign(Error('Saved job belongs to a different search query.'),{status:404});
        failures=0;setConnectionMessage('');setJob({...next,ownerToken:job.ownerToken});callbacks.current.onProgress?.(next.progress);
        if(next.status==='complete')callbacks.current.onComplete(next.result);
        else if(next.status==='error')callbacks.current.onError(next.error);
        else if(next.status==='cancelled')callbacks.current.onCancelled?.();
        else timer=setTimeout(poll,1000);
      }catch(error){if(stopped)return;if(error.status===404){try{sessionStorage.removeItem(storageKey);}catch{}setJob({id:job.id,status:'error'});callbacks.current.onError({error:error.message});return;}setConnectionMessage('Connection interrupted. Reconnecting to the existing search…');timer=setTimeout(poll,Math.min(1000*2**failures++,10000));}
    };
    void poll();return ()=>{stopped=true;clearTimeout(timer);};
  },[job?.id,kind]);
  async function start(input) {
    if(submitting.current || active(job))return;
    submitting.current=true;setStarting(true);setInteractionError('');
    const ownerToken=crypto.randomUUID(),body={action:'start',kind,input,requestKey:crypto.randomUUID(),ownerToken};
    try{
      // A transport failure can happen after the server committed the enqueue.
      let next;try{next=await call(body);}catch(error){if(!(error instanceof TypeError))throw error;next=await call(body);}
      try{sessionStorage.setItem(storageKey,JSON.stringify({id:next.id,ownerToken}));}catch{}
      setJob({...next,ownerToken});setConnectionMessage('');
    }catch(error){callbacks.current.onError({error:error.message});}
    finally{submitting.current=false;setStarting(false);}
  }
  async function cancel(){if(!active(job))return;try{setJob({...await call({action:'cancel',id:job.id,ownerToken:job.ownerToken}),ownerToken:job.ownerToken});}catch(error){setConnectionMessage(error.message);}}
  async function pause(){if(!active(job))return;try{setJob({...await call({action:'pause',id:job.id,ownerToken:job.ownerToken}),ownerToken:job.ownerToken});}catch(error){setConnectionMessage(error.message);}}
  async function resume(){if(job?.status!=='paused')return;try{setJob({...await call({action:'resume',id:job.id,ownerToken:job.ownerToken}),ownerToken:job.ownerToken});}catch(error){setConnectionMessage(error.message);}}
  async function remove(){
    if(!job||active(job)||submitting.current)return;
    submitting.current=true;setRemoving(true);
    try{await call({action:'remove',id:job.id,ownerToken:job.ownerToken});try{sessionStorage.removeItem(storageKey);}catch{}setJob(null);setConnectionMessage('');setInteractionError('');callbacks.current.onDeleted?.();}
    catch(error){setConnectionMessage(error.message);}
    finally{submitting.current=false;setRemoving(false);}
  }
  async function interact(input){
    if(job?.status!=='running'||interacting)return;setInteracting(true);setInteractionError('');
    const body={action:'interact',id:job.id,input,requestKey:crypto.randomUUID(),ownerToken:job.ownerToken};
    try{let next;try{next=await call(body);}catch(error){if(!(error instanceof TypeError))throw error;next=await call(body);}setJob({...next,ownerToken:job.ownerToken});}
    catch(error){setInteractionError(error.message);}finally{setInteracting(false);}
  }
  return {job,busy:starting||Boolean(active(job)),connectionMessage,start,cancel,pause,resume,remove,removing,interact,interactionBusy:interacting || job?.status==='running'&&['pending','inflight'].includes(job?.interaction?.status),interactionMessage:interactionError || job?.interaction?.error};
}
