import {configuredProviders} from '../../../../lib/provider-capabilities.mjs';
import {sourceErrorResponse} from '../../../../lib/source-errors.mjs';
import {randomUUID} from 'node:crypto';
import {getJobStore,validJobOwnerToken} from '../../../../lib/job-store.mjs';
import {validateCalendarQuery} from '../../../../lib/calendar-query.mjs';
import {localRequest} from '../../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Calendar searches are limited to the local app.'},{status:403});
 try{const body=await readJsonRequest(request,{maxBytes:12000,label:'Calendar'});if(!validJobOwnerToken(body.ownerToken))throw Error('A valid job owner capability is required.');const ownerToken=body.ownerToken;delete body.ownerToken;return Response.json(getJobStore().submit(validateCalendarQuery(body,{configured:configuredProviders(process.env),deferBudget:true}),request.headers.get('Idempotency-Key') ?? randomUUID(),{kind:'calendar',ownerToken}),{status:202,headers:{'Cache-Control':'no-store'}});}
 catch(e){return sourceErrorResponse(e);}
}
