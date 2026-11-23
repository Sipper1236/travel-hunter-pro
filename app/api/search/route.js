import {executeFlightSearch} from '../../../lib/search-request.mjs';
import {localRequest} from '../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../lib/request-json.mjs';
export const runtime='nodejs';
export async function POST(request) {
  const headers={'Cache-Control':'no-store'};
  if(!localRequest(request))return Response.json({error:'Flight searches are limited to the local app.'},{status:403,headers});
  try {
    const input=await readJsonRequest(request,{maxBytes:12000,label:'Flight search'});
    return Response.json(await executeFlightSearch(input,{allowExpanded:true}),{headers});
  }catch(error){
    if(error.cityChoices)return Response.json({error:error.message,locationChoices:{side:error.locationSide,value:error.locationValue,items:error.cityChoices}},{status:422,headers});
    return Response.json({error:error.message || 'Invalid request.',originDetection:error.originDetection,destinationDetection:error.destinationDetection},{status:error.status || 400,headers});
  }
}
