export class SourceRequestError extends Error {
  constructor(message,{status='error',httpStatus,retryAt,providerCode}={}){super(message);this.name='SourceRequestError';this.sourceStatus=status;this.httpStatus=httpStatus;this.retryAt=retryAt;this.providerCode=providerCode;}
}
export function retryAfter(value,now=Date.now()) {
  if(typeof value!=='string'||!value.trim())return null;
  if(/^\d+$/.test(value.trim())){const at=now+Number(value)*1000;return Number.isFinite(at)&&at<=8640000000000000?at:null;}
  const at=Date.parse(value);return Number.isFinite(at)&&at>now?at:null;
}
export function sourceFailure(provider,error){
 const counts=provider==='Google Flights'&&error.nativeCoverage?Object.fromEntries(['nativeRpcRequests','nativeRpcResponses','maxNativeRpcRequests','outboundRows','returnRows','outboundSelected','returnSelected','sellerQuotes'].filter(key=>Number.isInteger(error.nativeCoverage[key])&&error.nativeCoverage[key]>=0&&error.nativeCoverage[key]<=10000).map(key=>[key,error.nativeCoverage[key]])):null;
 const matrixTiming=provider==='ITA Matrix'&&error.matrixTiming?Object.fromEntries(Object.entries(error.matrixTiming).filter(([key,value])=>['setupMs','dispatchMs','responseMs','totalMs','responseTimeoutMs','searchRequestSent'].includes(key)&&(value===null||typeof value==='boolean'||Number.isFinite(value)&&value>=0&&value<=600000))):null;
 return {provider,...(matrixTiming?{matrixTiming}:{}),status:error.sourceStatus || 'error',reason:error.message,...(error.providerCode?{providerCode:error.providerCode}:{}),...(counts?{nativeCoverage:{...counts,scope:'Bounded native Google fare traffic; assets and shared HTTP counters are separate.'}}:{}),...(error.httpStatus?{httpStatus:error.httpStatus}:{}),...(error.retryAt?{retryAt:new Date(error.retryAt).toISOString()}: {})};
}
export const SOURCE_STOP_STATUSES=['rate','blocked','auth','rate_limited','access_denied','temporarily_unavailable'];

export function sourceErrorResponse(error) {
  const sqliteBusy=error?.code==='ERR_SQLITE_BUSY'||error?.code==='ERR_SQLITE_LOCKED'||error?.errcode===5||error?.errcode===6||/\bdatabase(?: table)? is (?:locked|busy)\b/i.test(error?.message??'');
  if(sqliteBusy){
    const retryAt=new Date(Date.now()+1000).toISOString();
    return Response.json({error:'The local job store is busy. Retry shortly.',sourceStatus:'temporarily_unavailable',retryAt},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'1'}});
  }
  const failure=sourceFailure(undefined,error),headers={'Cache-Control':'no-store'};
  if(error.retryAt)headers['Retry-After']=String(Math.max(0,Math.ceil((error.retryAt-Date.now())/1000)));
  const status=error.status===413?413:error.sourceStatus==='rate_limited'?429:error.sourceStatus==='temporarily_unavailable'?503:error.sourceStatus?502:400;
  return Response.json({error:`${error.message || 'Source request failed.'}${failure.retryAt ? ` Retry after ${failure.retryAt}.` : ''}`,sourceStatus:failure.status,retryAt:failure.retryAt},{status,headers});
}
