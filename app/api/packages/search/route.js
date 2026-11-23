import {randomUUID} from 'node:crypto';
import {localRequest} from '../../../../lib/local-request.mjs';
import {validateVacationQuery} from '../../../../lib/vacation-query.mjs';
import {getJobStore,validJobOwnerToken} from '../../../../lib/job-store.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 const headers={'Cache-Control':'no-store'};
 if(!localRequest(request))return Response.json({error:'Package searches are limited to the local website.'},{status:403,headers});
 try{
  const body=await readJsonRequest(request,{maxBytes:12000,label:'Package'});if(!validJobOwnerToken(body.ownerToken))throw Error('A valid job owner capability is required.');const ownerToken=body.ownerToken;delete body.ownerToken;
  const input=validateVacationQuery(body);
  return Response.json(getJobStore().submit(input,request.headers.get('Idempotency-Key') || randomUUID(),{kind:'package',ownerToken}),{status:202,headers});
 }catch(error){return Response.json({error:error.message},{status:error.status||400,headers});}
}
