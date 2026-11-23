import {matrixParty,skyscannerIdentityParty,googleRoundTripParty,validateTravelers,expediaParty} from './travelers.mjs';
/** Query capability decisions; this module contains no credentials and is safe in the browser. */
export const flightProviders=[['ignav','Ignav'],['google','Google Flights'],['expedia','Expedia partner API'],['skyscanner','Skyscanner'],['air-canada','Air Canada NDC'],['ita-matrix','ITA Matrix'],['omkar-expedia','Expedia via Omkar']];
export function providerCapabilities(query,{calendar=false,configured}={}){
 const identified=Array.isArray(query.travelers),adults=query.adults,children=query.children??query.childrenAges?.length??0,round=query.tripType==='round-trip';
 return flightProviders.map(([id,label])=>{
  let reason,status='eligible';
  if(identified&&!['ignav','skyscanner','ita-matrix',...(round?['google']:[])].includes(id)){status='unsupported_party';reason='Identified travelers, guardian links and infant seating are not supported by this adapter.';}
  else if(round&&['air-canada','omkar-expedia'].includes(id)){status='unsupported_trip';reason='This adapter currently supports one-way searches only.';}
  else if(calendar&&id==='skyscanner'&&round&&children>0){status='unsupported_party';reason='Count-only child ages cannot establish ages on every return-flight date. Use identified birth dates for eligible non-infant family searches.';}
  else if(calendar&&id==='expedia'&&round&&children>0){status='unsupported_party';reason='Flexible Expedia calendars cannot recalculate child ages on every selected flight date. Use exact dates or select all compatible sources.';}
  else if(id==='expedia'&&children>0){try{validateTravelers(query);if(round&&!calendar)expediaParty(query);reason='Expedia listings require each child’s actual age and price ages 12–17 in its adult fare category; round-trip group totals must include both linked directions.';}catch(error){status='unsupported_party';reason=error.message;}}
  else if(id==='google'&&!round&&(adults!==1||children!==0||query.cabin&&query.cabin!=='economy')){status='unsupported_party';reason='This one-way operation supports one adult in economy only.';}
  else if(id==='air-canada'&&(adults!==1||children!==0)){status='unsupported_party';reason='The current NDC adapter supports one adult only.';}
  else if(id==='ita-matrix'&&(children>0||identified)){try{const date=calendar?query.start:query.date;const returnDate=calendar?(query.returnEnd??(query.end?new Date(Date.parse(query.end)+(query.nightsMax??query.nights??0)*86400000).toISOString().slice(0,10):query.returnDate)):query.returnDate;matrixParty({...query,date,returnDate,tripType:returnDate?'round-trip':query.tripType});if(query.cabin&&query.cabin!=='economy')throw Error('Matrix family browser searches currently require economy.');reason='Matrix sends explicit age-stable passenger categories, including validated lap/seat infant counts, and checks returned group totals. Carrier and fare eligibility remain unverified.';}catch(error){status='unsupported_party';reason=error.message;}}
  else if(id==='omkar-expedia'&&(adults!==1||children!==0)){status='unsupported_party';reason='Omkar supports one adult only; group prices cannot be inferred.';}
  else if(id==='expedia'&&adults+children>6||id==='skyscanner'&&adults+children>8){status='unsupported_party';reason='Party exceeds this adapter’s traveler limit.';}
  else if(calendar&&id==='skyscanner'&&(children>0&&query.start!==query.end)){status='unsupported_trip';reason='This calendar adapter cannot verify child ages across multiple departure dates.';}
  if(status==='eligible'&&identified&&id==='skyscanner'){try{skyscannerIdentityParty({...query,date:query.date??query.start,tripType:'one-way',returnDate:undefined});reason='Identified non-infant families supported; exact ages are checked for each trip and observed flight date.';}catch(error){status='unsupported_party';reason=error.message;}}
  if(status==='eligible'&&id==='google'&&round){
   try{
    const date=calendar?(query.start??query.date):query.date;
    const latest=calendar?query.returnEnd??(query.end&&Number.isInteger(query.nightsMax??query.nights)?new Date(Date.parse(query.end)+(query.nightsMax??query.nights)*86400000).toISOString().slice(0,10):query.returnDate??date):query.returnDate;
    googleRoundTripParty({...query,date,returnDate:identified&&calendar?date:latest,cabin:query.cabin??'economy'});
    reason='Native economy non-infant returns examine up to three eligible outbounds, stopping at the first matching complete itinerary. Coverage is bounded; phone-only seller options are labeled.';
    if(configured&&configured.googleRoundTrip!==true){status='unconfigured';reason='Native Google round-trip browser search is not enabled on this server.';}
   }catch(error){status='unsupported_party';reason=error.message;}
  }
  if(status==='eligible'&&configured&&configured[id]!==true){status='unconfigured';reason='Provider access is not configured on this server.';}
  return {id,label,status,eligible:status==='eligible',reason:reason??'Query shape supported; returned quotes still require validation.'};
 });
}
export function configuredProviders(env){return {ignav:Boolean(env.IGNAV_API_KEY),google:true,googleRoundTrip:env.TRAVEL_GOOGLE_ROUND_TRIP==='1',expedia:Boolean(env.EXPEDIA_TRAVEL_REDIRECT_KEY&&env.EXPEDIA_TRAVEL_REDIRECT_AUTHORIZATION),skyscanner:Boolean(env.SKYSCANNER_API_KEY),'air-canada':Boolean(env.AIR_CANADA_NDC_API_KEY&&env.AIR_CANADA_NDC_SELLER_ID&&env.AIR_CANADA_NDC_IATA_NUMBER&&env.AIR_CANADA_NDC_AGENCY_ID),'ita-matrix':true,'omkar-expedia':Boolean(env.OMKAR_API_KEY)};}
