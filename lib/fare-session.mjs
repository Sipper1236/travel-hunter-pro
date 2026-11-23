import {createHash} from 'node:crypto';
import {searchIgnav} from './ignav.mjs';
import {quoteFreshness} from './quote-freshness.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fareQuery=q=>({origin:q.origin,destination:q.destination,date:q.date,tripType:q.tripType ?? 'one-way',...(q.tripType==='round-trip'?{returnDate:q.returnDate}:{}),cabin:q.cabin ?? 'economy',...(q.travelers?{travelers:q.travelers}:{adults:q.adults,children:q.children ?? 0,childrenAges:q.childrenAges ?? []}),...(q.filters?{filters:q.filters}:{})});
const usable=entry=>entry&&quoteFreshness({observedAt:entry.savedAt}).status==='fresh'&&Array.isArray(entry.result?.offers)&&entry.result.offers.every(offer=>quoteFreshness(offer).status==='fresh')&&(!entry.result.observedAt||quoteFreshness({observedAt:entry.result.observedAt}).status==='fresh');

/** Budgeted read-only fare requests with acknowledged intents and reusable observations. */
export async function createFareSession(input,options={}){
  const signature=digest(input),limit=options.limit;
  if(!Number.isInteger(limit)||limit<1||limit>250)throw Error('Invalid fare request budget.');
  const previous=options.checkpoint;
  if(previous&&(previous.version!==1||previous.signature!==signature||!Number.isInteger(previous.started)||previous.started<0||previous.started>limit||!Number.isInteger(previous.interrupted)||previous.interrupted<0||previous.interrupted>previous.started||!Array.isArray(previous.responses)||previous.responses.length>previous.started||previous.responses.some(e=>!e||typeof e.key!=='string')||previous.pending!==null&&(typeof previous.pending!=='string'||previous.started===0)))throw Error('The saved fare-search checkpoint is invalid. Start a new search.');
  const state=previous?structuredClone(previous):{version:1,signature,started:0,interrupted:0,pending:null,responses:[]};
  const responses=new Map(state.responses.map(entry=>[entry.key,entry]));
  let reused=0,phase={stage:options.initialStage ?? 'fare_starting'},budgetRefused=false,checkpointFailure;
  const check=()=>{options.signal?.throwIfAborted();if(checkpointFailure)throw checkpointFailure;};
  const report=update=>{phase={...phase,...update};options.onProgress?.({...phase,...options.progressContext,fareRequestsStarted:state.started,requestBudget:limit,responsesReused:reused,interruptedRequests:state.interrupted});};
  const save=async()=>{check();if(options.transportSnapshot)state.transportCoverage=options.transportSnapshot();try{await options.onCheckpoint?.({...state,responses:[...responses.values()]});}catch(error){checkpointFailure=error;throw error;}check();};
  if(state.pending){state.interrupted++;state.pending=null;await save();}
  const searcher=async query=>{
    check();const queryInput=fareQuery(query),key=digest(queryInput),cached=responses.get(key);
    if(usable(cached)){reused++;report({});return cached.result;}
    if(state.started>=limit){budgetRefused=true;throw Error('The fare request budget was exhausted while refreshing or recovering quotes.');}
    state.started++;state.pending=key;await save();report({});
    let result;
    try{result=await (options.searcher ?? searchIgnav)(queryInput,{signal:options.signal});}
    catch(error){check();state.pending=null;await save();throw error;}
    check();responses.set(key,{key,savedAt:new Date().toISOString(),result});state.pending=null;await save();report({});return result;
  };
  return {search:searcher,report,check,get budgetExhausted(){return budgetRefused;},get coverage(){return {fareRequestsStarted:state.started,requestBudget:limit,responsesReused:reused,interruptedRequests:state.interrupted};}};
}
