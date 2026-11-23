import { searchBooking, validateHotelSearch } from '../../../../lib/booking.mjs';
import { validateStay } from '../../../../lib/booking-browser.mjs';
import { resolveHotelDestination } from '../../../../lib/hotel-destination.mjs';
import { localRequest } from '../../../../lib/local-request.mjs';
import { readJsonRequest } from '../../../../lib/request-json.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  const headers={'Cache-Control':'no-store'};
  if(!localRequest(request))return Response.json({error:'Hotel search is limited to the local app.'},{status:403,headers});
  try {
    const input=await readJsonRequest(request,{maxBytes:12000,label:'Hotel'});
    if(!process.env.BOOKING_API_TOKEN||!process.env.BOOKING_AFFILIATE_ID)return Response.json(await searchBooking(input),{headers});
    validateHotelSearch({...input,airport:input.destinationAirport??input.airport});
    const query=validateStay({...input,destinationAirport:input.destinationAirport??input.airport,hotelSource:'booking-demand'});
    const destination=await resolveHotelDestination(query);
    const result=await searchBooking({airport:query.destinationAirport??destination.airport,bookerCountry:input.bookerCountry,checkin:query.checkin,checkout:query.checkout,adults:query.adults,adultAges:query.adultAges,rooms:query.rooms,childrenAges:query.childrenAges,minStars:query.minStars,roomAllocations:query.roomAllocations},{destination});
    return Response.json(result,{headers});
  }
  catch (error) { return Response.json({error:error instanceof Error ? error.message : 'Invalid request.',...(error.cityChoices?{locationChoices:error.cityChoices}:{})},{status:error.status||400,headers}); }
}
