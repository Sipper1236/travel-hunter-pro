import {configuredProviders} from '../../../../lib/provider-capabilities.mjs';
import {getJobStore,validJobOwnerToken} from '../../../../lib/job-store.mjs';
import {localRequest} from '../../../../lib/local-request.mjs';
import {validateSearchParty,validateIgnavRoundTripAge} from '../../../../lib/travelers.mjs';
import {validateFilters} from '../../../../lib/flight-filters.mjs';
import {validateVacationQuery} from '../../../../lib/vacation-query.mjs';
import {validateStay} from '../../../../lib/booking-browser.mjs';
import {validateComparisonQuery} from '../../../../lib/comparison-query.mjs';
import {validateCalendarQuery} from '../../../../lib/calendar-query.mjs';
import {validateMatrixOptions} from '../../../../lib/matrix-options.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function POST(request) {
  if(!localRequest(request))return Response.json({error:'Search jobs are limited to the local app.'},{status:403,headers});
  try {
    // Comparison jobs may carry up to 400 exact airport pairs (20 candidates
    // per side). Keep the payload bounded while allowing that validated set.
    const body=await readJsonRequest(request,{maxBytes:24000,label:'Search'}),store=getJobStore();
    if(body.action==='start'){
      if(!validJobOwnerToken(body.ownerToken))throw Error('A valid job owner capability is required.');
      const kind=body.kind ?? 'flight';
      const submittedInput=body.input&&typeof body.input==='object'&&!Array.isArray(body.input)?{...body.input}:body.input;
      if(submittedInput&&typeof submittedInput==='object')delete submittedInput.ownerToken;
      if(kind==='package')return Response.json(store.submit(validateVacationQuery(submittedInput),body.requestKey,{kind,ownerToken:body.ownerToken}),{status:202,headers});
      if(kind==='hotel')return Response.json(store.submit(validateStay(submittedInput),body.requestKey,{kind,ownerToken:body.ownerToken}),{status:202,headers});
      if(kind==='comparison')return Response.json(store.submit(validateComparisonQuery(submittedInput),body.requestKey,{kind,ownerToken:body.ownerToken}),{status:202,headers});
      if(kind==='calendar')return Response.json(store.submit(validateCalendarQuery(submittedInput,{configured:configuredProviders(process.env),deferBudget:true}),body.requestKey,{kind,ownerToken:body.ownerToken}),{status:202,headers});
      if(kind!=='flight')throw Error('Choose a supported search product.');
      const input=submittedInput;validateSearchParty(input);validateFilters(input.filters);input.matrixOptions=validateMatrixOptions(input.matrixOptions);
      validateIgnavRoundTripAge(input);
      for(const side of ['origin','destination'])if(typeof input[side]!=='string'||input[side].trim().length<2||input[side].length>60)throw Error('Enter an origin and destination.');
      const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
      if(!validDate(input.date)||input.date<new Date().toISOString().slice(0,10))throw Error('Enter a valid future departure date.');
      if(!['one-way','round-trip'].includes(input.tripType)||input.tripType==='round-trip'&&(!validDate(input.returnDate)||input.returnDate<input.date))throw Error('Choose a valid trip type and return date.');
      if(!['economy','premium_economy','business','first'].includes(input.cabin))throw Error('Choose a valid cabin.');
      return Response.json(store.submit(input,body.requestKey,{ownerToken:body.ownerToken}),{status:202,headers});
    }
    if(typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))throw Error('Invalid search job reference.');
    if(!['status','cancel','pause','resume','interact','remove'].includes(body.action))throw Error('Choose a valid search job action.');
    if(!store.authorize(body.id,body.ownerToken))return Response.json({error:'Search job was not found or has expired.'},{status:404,headers});
    const job=body.action==='status'?store.get(body.id):body.action==='interact'?store.interact(body.id,body.input,body.requestKey):body.action==='remove'?store.remove(body.id,body.ownerToken):store[body.action](body.id);
    return Response.json(job ?? {error:'Search job was not found or has expired.'},{status:job?200:404,headers});
  }catch(error){const responseHeaders={...headers};if(Number.isInteger(error.retryAfterSeconds))responseHeaders['Retry-After']=String(error.retryAfterSeconds);return Response.json({error:error.message || 'Invalid search job request.'},{status:error.status||400,headers:responseHeaders});}
}
