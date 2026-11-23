import {localRequest} from '../../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
import {providerCapabilities,configuredProviders} from '../../../../lib/provider-capabilities.mjs';
export const runtime='nodejs';
export async function POST(request){
 if(!localRequest(request))return Response.json({error:'Provider checks are limited to the local app.'},{status:403});
 try{const query=await readJsonRequest(request,{maxBytes:12000,label:'Provider capability'});return Response.json({providers:providerCapabilities(query,{calendar:true,configured:configuredProviders(process.env)})},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error.message},{status:error.status??400});}
}
