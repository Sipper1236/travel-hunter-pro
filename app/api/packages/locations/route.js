import {localRequest} from '../../../../lib/local-request.mjs';
import {lookupVacationSuggestions} from '../../../../lib/vacation-suggestions.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Package location lookup is limited to the local app.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{const input=await readJsonRequest(request,{maxBytes:1000,label:'Location lookup'});const result=await lookupVacationSuggestions(input,{signal:request.signal});return Response.json(result,{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error.message||'Location lookup failed.',...(error.code?{code:error.code}:{}),...(error.providerStatus?{providerStatus:error.providerStatus}:{})},{status:error.status||400,headers:{'Cache-Control':'no-store'}});}
}
