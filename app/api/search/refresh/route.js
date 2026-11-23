import {sourceErrorResponse} from '../../../../lib/source-errors.mjs';
import { refreshSkyscanner } from '../../../../lib/skyscanner.mjs';
import { refreshAirCanada } from '../../../../lib/air-canada.mjs';
import { localRequest } from '../../../../lib/local-request.mjs';
import {readJsonRequest} from '../../../../lib/request-json.mjs';
import {searchGoogleRoundTrip} from '../../../../lib/google-native.mjs';
import {searchExpedia} from '../../../../lib/expedia.mjs';
import {applyFlightFilters,validateFilters} from '../../../../lib/flight-filters.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  if (!localRequest(request)) return Response.json({ error: 'Provider refresh is limited to the local app.' }, { status: 403 });
  try {
    const input = await readJsonRequest(request,{maxBytes:12000,label:'Provider refresh'});
    let result;
    if (input.provider === 'Skyscanner') result = await refreshSkyscanner(input,{signal:request.signal});
    else if(input.provider==='Expedia'){
     if(!input.expediaSelection)return Response.json({error:'The exact originally observed Expedia flights are required for refresh.'},{status:400});
     result=await searchExpedia(input,{selection:input.expediaSelection,signal:request.signal});
     result.offers=(await applyFlightFilters(result.offers,validateFilters(input.filters))).offers;
     result.limitation='Expedia listings were queried again and only the exact previously observed flights were retained. A missing itinerary is not replaced. The seller checkout price remains unverified.';
    }
    else if(input.provider==='Google Flights'){
     if(process.env.TRAVEL_GOOGLE_ROUND_TRIP!=='1')return Response.json({error:'Native Google round-trip refresh is not enabled.'},{status:503,headers:{'Cache-Control':'no-store'}});
     if(!input.googleSelection)return Response.json({error:'The exact originally observed Google flights are required for refresh.'},{status:400});
     if(!input.googleBookingUrl)return Response.json({error:'The original Google booking page is required for an exact refresh.'},{status:400});
     result=await searchGoogleRoundTrip(input,{selection:input.googleSelection,bookingUrl:input.googleBookingUrl,signal:request.signal});
     result.limitation='Google rechecked the original selected itinerary and returned only exact flight matches. The displayed group price is a fresh Google observation; seller acceptance remains unverified.';
    }
    else if (input.provider === 'Air Canada NDC') result = await refreshAirCanada(input);
    else return Response.json({ error: 'This provider does not expose a refresh operation through the current adapter.' }, { status: 501, headers: { 'Cache-Control': 'no-store' } });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return sourceErrorResponse(error);
  }
}
