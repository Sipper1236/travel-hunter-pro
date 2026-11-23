import {SourceRequestError} from './source-errors.mjs';

/** Read decoded response text under a fixed byte cap so one upstream response cannot exhaust the worker. */
export async function readBoundedSourceText(response,{provider='Provider',maxBytes=2_000_000}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('A positive response byte limit is required.');
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes){await response.body?.cancel().catch(()=>{});throw new SourceRequestError(`${provider} response exceeded its size limit.`,{status:'invalid_response'});}
 const reader=response.body?.getReader();if(!reader)throw new SourceRequestError(`${provider} returned no response body.`,{status:'invalid_response'});
 const chunks=[];let bytes=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel().catch(()=>{});throw new SourceRequestError(`${provider} response exceeded its size limit.`,{status:'invalid_response'});}chunks.push(Buffer.from(value));}
 }finally{reader.releaseLock();}
 return Buffer.concat(chunks,bytes).toString('utf8');
}

/** Read decoded JSON under a fixed byte cap. */
export async function readBoundedSourceJson(response,{provider='Provider',maxBytes=2_000_000}={}){
 let text;
 try{text=await readBoundedSourceText(response,{provider,maxBytes});}
 catch(error){if(error instanceof SourceRequestError)throw error;throw new SourceRequestError(`${provider} returned invalid JSON.`,{status:'invalid_response'});}
 try{return JSON.parse(text);}
 catch{throw new SourceRequestError(`${provider} returned invalid JSON.`,{status:'invalid_response'});}
}
