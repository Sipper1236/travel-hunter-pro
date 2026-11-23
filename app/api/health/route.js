import {getJobStore} from '../../../lib/job-store.mjs';
import {localRequest} from '../../../lib/local-request.mjs';

export const runtime='nodejs';

async function statusResponse(request){
 if(!localRequest(request))return Response.json({error:'Operational status is limited to the local app.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{
  const snapshot=getJobStore().operationalSnapshot(),queueDepth=Object.entries(snapshot.queue).filter(([key])=>key.endsWith('.queued')).reduce((sum,[,count])=>sum+count,0);
  const workerAvailable=snapshot.workers.running>0;
  const status=!workerAvailable||snapshot.expiredLeases||snapshot.expiredDeadlines?'degraded':'ok';
  return Response.json({status,...snapshot,queueDepth,workerAvailable},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return Response.json({status:'error',error:'Local operational status is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}

export async function GET(request){return statusResponse(request);}
// Same-origin browser clients use POST because browser GET fetches omit Origin.
export async function POST(request){return statusResponse(request);}
