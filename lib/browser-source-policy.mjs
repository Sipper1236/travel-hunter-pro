import {setTimeout as delay} from 'node:timers/promises';
import {SourceRequestError} from './source-errors.mjs';

/** Reserve one bounded browser-mediated source operation in the shared durable policy. */
export async function reserveBrowserSource(policy,provider,{signal,gapMs}={}){
 if(!policy)return;
 const configured=Number(process.env.TRAVEL_SOURCE_GAP_MS??1000),gap=gapMs??(Number.isFinite(configured)&&configured>=100&&configured<=60000?configured:1000);
 for(;;){
  signal?.throwIfAborted();
  const slot=policy.reserveSource(provider,gap);
  if(slot.blockedUntil)throw new SourceRequestError(`${provider} is cooling down until ${new Date(slot.blockedUntil).toISOString()}.`,{status:slot.status??'temporarily_unavailable',retryAt:slot.blockedUntil});
  if(!slot.waitMs)return;
  await delay(slot.waitMs,undefined,{signal});
 }
}
