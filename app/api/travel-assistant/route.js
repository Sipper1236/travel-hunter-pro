import {interpretTravelRequest} from '../../../lib/travel-assistant.mjs';
import {localRequest} from '../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Use the local app to interpret a travel request.'},{status:403});
 try {const input=await readJsonRequest(request,{maxBytes:4000,label:'Assistant'});return Response.json(await interpretTravelRequest(input.text),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Request could not be interpreted.'},{status:e.status||400,headers:{'Cache-Control':'no-store'}});}
}
