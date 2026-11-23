import {randomUUID} from 'node:crypto';
import {localRequest} from '../../../lib/local-request.mjs';
import {getJobStore,validJobOwnerToken} from '../../../lib/job-store.mjs';
import {validateStay} from '../../../lib/booking-browser.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 const headers={'Cache-Control':'no-store'};
 if(!localRequest(request))return Response.json({error:'Use this feature from the local webpage.'},{status:403,headers});
 try{
  const input=await readJsonRequest(request,{maxBytes:12000,label:'Hotel'}),store=getJobStore();
  if(input.action==='start'){
   if(!validJobOwnerToken(input.ownerToken))throw Error('A valid job owner capability is required.');
   const ownerToken=input.ownerToken;delete input.ownerToken;
   return Response.json(store.submit(validateStay(input),input.requestKey || randomUUID(),{kind:'hotel',ownerToken}),{status:202,headers});
  }
  if(!store.authorize(input.id,input.ownerToken))return Response.json({error:'Hotel job not found.'},{status:404,headers});
  const job=store.get(input.id);if(!job||job.kind!=='hotel')return Response.json({error:'Hotel job not found.'},{status:404,headers});
  if(input.action==='poll')return Response.json(job,{headers});
  if(input.action==='cancel')return Response.json(store.cancel(input.id),{headers});
  if(input.action==='input')return Response.json(store.interact(input.id,{kind:input.kind,frameId:input.frameId,x:input.x,y:input.y},input.requestKey || randomUUID()),{headers});
  throw Error('Unknown hotel action.');
 }catch(error){return Response.json({error:error.message},{status:error.status||400,headers});}
}
