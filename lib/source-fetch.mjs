import {recordTransport} from './transport-metrics.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {getJobStore} from './job-store.mjs';
import {SourceRequestError,retryAfter} from './source-errors.mjs';

const SERVER_FAILURE_COOLDOWN_MS=30_000;

function providerQuotaResetAt(headers,now){
  if(headers.get('x-ratelimit-requests-remaining')!=='0')return null;
  const raw=headers.get('x-ratelimit-requests-reset');
  if(!raw||!/^\d+$/.test(raw.trim()))return null;
  const resetAt=Number(raw)*1000;
  return Number.isSafeInteger(resetAt)&&resetAt>now&&resetAt<=now+366*24*60*60_000?resetAt:null;
}

/** Local pacing policy, independent of any provider's published quota. */
export async function fetchSource(provider,url,init={},options={}) {
  const fetcher=options.fetcher ?? fetch,now=options.now ?? Date.now;
  const policy=options.policy ?? (options.fetcher ? null : getJobStore());
  const sleep=options.sleep ?? (ms=>delay(ms,undefined,{signal:init.signal}));
  const configuredGap=Number(process.env.TRAVEL_SOURCE_GAP_MS ?? 1000);
  const gapMs=Number.isFinite(configuredGap)&&configuredGap>=100&&configuredGap<=60000?configuredGap:1000;
  const retrySafe=options.retrySafe ?? ['GET','HEAD'].includes(init.method ?? 'GET');
  const ignavRetry=provider==='Ignav'&&options.retryIgnav424===true;
  for(let attempt=0;attempt<(ignavRetry?3:2);attempt++) {
    if(init.signal?.aborted)throw init.signal.reason;
    if(policy)for(;;){
      const slot=policy.reserveSource(provider,gapMs);
      if(slot.blockedUntil)throw new SourceRequestError(`${provider} is cooling down until ${new Date(slot.blockedUntil).toISOString()}.`,{status:slot.status,retryAt:slot.blockedUntil});
      if(!slot.waitMs)break;await sleep(slot.waitMs);
    }
    const timeout=AbortSignal.timeout(options.timeoutMs ?? 30000);
    let response;const requestStartedAt=performance.now();
    try {
      options.onAttempt?.({provider,attempt:attempt+1});
      recordTransport(provider,'attempt',attempt+1);
      response=await fetcher(url,{...init,signal:init.signal?AbortSignal.any([init.signal,timeout]):timeout});
      recordTransport(provider,'response',attempt+1,response.status,performance.now()-requestStartedAt);
    }catch(error){
      recordTransport(provider,'failure',attempt+1,undefined,performance.now()-requestStartedAt);
      if(init.signal?.aborted)throw error;
      if(retrySafe && attempt===0){await sleep(500);continue;}
      throw new SourceRequestError(`${provider} request failed or timed out.`,{status:'temporarily_unavailable'});
    }
    if(response.ok)return response;
    const httpStatus=response.status,hint=retryAfter(response.headers.get('retry-after'),now());
    let upstreamCode;
    if(ignavRetry&&httpStatus===424){
      const reader=response.body?.getReader();let size=0,parts=[];
      if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();break;}parts.push(Buffer.from(value));}
        if(size<=8192){const data=JSON.parse(Buffer.concat(parts).toString('utf8'));const code=data?.error?.code??data?.code??data?.error;if(['unable_to_complete_request','unsupported_search'].includes(code))upstreamCode=code;}
      }catch{/* Unrecognized errors are never retried. */}finally{reader.releaseLock();}
      if(upstreamCode==='unable_to_complete_request'&&retrySafe&&attempt<2&&(!hint||hint-now()<=3000)){await sleep(Math.max(attempt===0?1000:3000,(hint??0)-now())+Math.floor((options.random??Math.random)()*250));continue;}
    }
    const status=upstreamCode==='unsupported_search'?'unsupported_trip':upstreamCode==='unable_to_complete_request'?'temporarily_unavailable':httpStatus===429?'rate_limited':httpStatus===401?'auth':httpStatus===403?'blocked':httpStatus>=500?'temporarily_unavailable':'error';
    let retryAt=hint;
    if(httpStatus===429)retryAt=Math.max(hint ?? 0,providerQuotaResetAt(response.headers,now())??0,now()+60000);
    if(httpStatus===401 || httpStatus===403)retryAt=Math.max(hint ?? 0,now()+300000);
    await response.body?.cancel().catch(()=>{});
    if(httpStatus>=500 && retrySafe && attempt===0 && (!hint || hint-now()<=1000)) {await sleep(Math.max(500,(hint ?? 0)-now()));continue;}
    if(httpStatus>=500)retryAt=Math.max(retryAt??0,now()+SERVER_FAILURE_COOLDOWN_MS);
    if(retryAt && policy)policy.deferSource(provider,retryAt,status);
    throw new SourceRequestError(upstreamCode==='unsupported_search'?'Ignav cannot search these exact travel dates because they are outside its available search range.':`${provider} request failed (HTTP ${httpStatus}).`,{status,httpStatus,retryAt,providerCode:upstreamCode});
  }
}
