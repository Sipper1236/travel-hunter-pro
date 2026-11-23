import {lookupAirports} from '../../../lib/airport-lookup.mjs';
import {sourceErrorResponse} from '../../../lib/source-errors.mjs';
import {localRequest} from '../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Airport lookup is limited to the local app.'},{status:403});
 try{
  const {query}=await readJsonRequest(request,{maxBytes:2000,label:'Airport lookup'});if(typeof query!=='string'||query.trim().length<2||query.length>80)throw Error('Enter at least two characters.');
  return Response.json(await lookupAirports(query),{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e.sourceStatus)return sourceErrorResponse(e);return Response.json({error:e instanceof Error?e.message:'Airport lookup unavailable.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}});}
}
