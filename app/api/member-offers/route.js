import {localRequest} from '../../../lib/local-request.mjs';
import {checkMemberSources} from '../../../lib/member-offers.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Member checks are limited to the local app.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{
  const sources=await checkMemberSources(await readJsonRequest(request,{maxBytes:1000,label:'Member check'}),{signal:request.signal});
  return Response.json({sources,limitation:'Membership, card eligibility and a comparable trip-specific rate have not been verified. No discount has been applied.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error.message || 'Could not check member sources.'},{status:error.status||400,headers:{'Cache-Control':'no-store'}});}
}
