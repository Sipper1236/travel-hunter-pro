import {sourceFailure} from '../lib/source-errors.mjs';
import {calendarWorkerResultError} from '../lib/calendar-worker-result.mjs';
import {flightWorkerResultError} from '../lib/flight-worker-result.mjs';
import {comparisonWorkerResultError} from '../lib/comparison-worker-result.mjs';
import {hotelWorkerResultError} from '../lib/hotel-worker-result.mjs';
import {packageWorkerResultError} from '../lib/package-worker-result.mjs';
import {getJobStore} from '../lib/job-store.mjs';
const cancellation=new AbortController();
let completed=false;
const send=message=>{if(process.connected)process.send(message,()=>{});};
const stop=()=>{if(completed)process.exit(0);cancellation.abort(Error('Search cancelled.'));const timer=setTimeout(()=>process.exit(1),5000);timer.unref();};
process.once('disconnect',stop);process.once('SIGTERM',stop);
process.once('message',async ({kind='flight',input,checkpoint})=>{
  const interactions=[];
  process.on('message',message=>{if(message.interaction)interactions.push(message.interaction);});
  let sequence=0;
  const saveCheckpoint=value=>new Promise((resolve,reject)=>{
    if(cancellation.signal.aborted){reject(cancellation.signal.reason);return;}
    const id=++sequence;
    const cleanup=()=>{clearTimeout(timer);process.off('message',done);cancellation.signal.removeEventListener('abort',aborted);};
    const done=message=>{if(message.checkpointAck===id){cleanup();resolve();}};
    const aborted=()=>{cleanup();reject(cancellation.signal.reason);};
    const timer=setTimeout(()=>{cleanup();reject(Error('Worker checkpoint acknowledgement timed out.'));},10000);
    cancellation.signal.addEventListener('abort',aborted,{once:true});
    process.on('message',done);send({checkpoint:value,sequence:id});
  });
  try {
    const onProgress=progress=>send({progress});
    const result=kind==='calendar'?await (await import('../lib/calendar-search.mjs')).searchFareCalendar(input,{signal:cancellation.signal,checkpoint,onCheckpoint:saveCheckpoint,onProgress}):kind==='comparison'?await (await import('../lib/comparison-search.mjs')).executeComparison(input,{signal:cancellation.signal,checkpoint,onCheckpoint:saveCheckpoint,onProgress}):kind==='hotel'?await (await import('../lib/hotel-search.mjs')).searchHotel(input,{signal:cancellation.signal,onProgress,nextInteraction:()=>interactions.shift(),onInteractionResult:result=>send({interactionResult:result})}):kind==='package'?await (await import('../lib/vacation-search.mjs')).searchVacation(input,{signal:cancellation.signal,onProgress}):await (await import('../lib/search-request.mjs')).executeFlightSearch(input,{checkpoint,onCheckpoint:saveCheckpoint,onProgress,providerCache:getJobStore()});
    if(kind==='calendar'){
      const validationError=calendarWorkerResultError(result);
      if(validationError)throw Error(`Calendar worker result failed validation: ${validationError}.`);
    }
    if(kind==='flight'){
      const validationError=flightWorkerResultError(result,input);
      if(validationError)throw Error(`Flight worker result failed validation: ${validationError}.`);
    }
    if(kind==='comparison'){
      const validationError=comparisonWorkerResultError(result,input);
      if(validationError)throw Error(`Comparison worker result failed validation: ${validationError}.`);
    }
    if(kind==='hotel'){
      const validationError=hotelWorkerResultError(result,input);
      if(validationError)throw Error(`Hotel worker result failed validation: ${validationError}.`);
    }
    if(kind==='package'){
      const validationError=packageWorkerResultError(result,input);
      if(validationError)throw Error(`Package worker result failed validation: ${validationError}.`);
    }
    if(!cancellation.signal.aborted)send({result});
  }catch(error){if(!cancellation.signal.aborted){const failure=sourceFailure(undefined,error);send({error:{error:`${failure.reason}${failure.retryAt?` Retry after ${failure.retryAt}.`:''}`,sourceStatus:failure.status,httpStatus:failure.httpStatus,retryAt:failure.retryAt,locationChoices:error.cityChoices?{side:error.locationSide,value:error.locationValue,items:error.cityChoices}:undefined}});}}
  finally{completed=true;if(cancellation.signal.aborted)process.exit(1);}
});
