import {localRequest} from '../../../../lib/local-request.mjs';
import {getJobStore} from '../../../../lib/job-store.mjs';
import {validJobOwnerToken} from '../../../../lib/job-store.mjs';
import {sourceErrorResponse} from '../../../../lib/source-errors.mjs';
import { getIgnavBookingLinks } from '../../../../lib/ignav.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    if (!localRequest(request)) return Response.json({error:'Seller lookup is limited to the local app.'},{status:403});
    const { ignavId,ownerToken } = await readJsonRequest(request,{maxBytes:2000,label:'Seller lookup'});
    if(!validJobOwnerToken(ownerToken))return Response.json({error:'The search job owner capability is required.'},{status:404,headers:{'Cache-Control':'no-store'}});
    const expectedOffer=getJobStore().findFlightOffer(ignavId,ownerToken);
    if(!expectedOffer)return Response.json({error:'The selected offer was not found for this job owner.'},{status:404,headers:{'Cache-Control':'no-store'}});
    const result = await getIgnavBookingLinks(ignavId,{expectedOffer});
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return sourceErrorResponse(error);
  }
}
