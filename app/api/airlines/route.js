import {searchAirlineDirectory} from '../../../lib/airline-directory.mjs';
import {localRequest} from '../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
import {sourceErrorResponse} from '../../../lib/source-errors.mjs';

export const runtime='nodejs';

export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Airline lookup is limited to the local app.'},{status:403});
 try{
  const {query}=await readJsonRequest(request,{maxBytes:2000,label:'Airline lookup'});
  return Response.json(await searchAirlineDirectory(query,{signal:request.signal}),{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error.sourceStatus)return sourceErrorResponse(error);
  return Response.json({error:error instanceof Error?error.message:'Airline lookup unavailable.'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
 }
}
