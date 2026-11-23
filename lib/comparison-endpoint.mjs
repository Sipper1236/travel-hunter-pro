import {randomUUID} from 'node:crypto';
import {getJobStore,validJobOwnerToken} from './job-store.mjs';
import {validateComparisonQuery} from './comparison-query.mjs';
import {localRequest} from './local-request.mjs';
import {sourceErrorResponse} from './source-errors.mjs';
import {readJsonRequest} from './request-json.mjs';

export async function queueComparison(request,mode){
  if(!localRequest(request))return Response.json({error:'Ticket comparisons are limited to the local app.'},{status:403});
  try{
    const body=await readJsonRequest(request,{maxBytes:24000,label:'Comparison'}),ownerToken=body.ownerToken;delete body.ownerToken;
    if(!validJobOwnerToken(ownerToken))throw Error('A valid job owner capability is required.');
    const input=validateComparisonQuery({...body,mode});
    const job=getJobStore().submit(input,request.headers.get('Idempotency-Key') ?? randomUUID(),{kind:'comparison',ownerToken});
    return Response.json(job,{status:202,headers:{'Cache-Control':'no-store'}});
  }catch(error){return sourceErrorResponse(error);}
}
