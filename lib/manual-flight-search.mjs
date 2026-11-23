import {calendarDatePairs} from './calendar-query.mjs';
import {validateTravelerIdentities,validateTravelers} from './travelers.mjs';

// Manual navigation carries no passenger data. The local checklist is not a quote.
export const googleManualUrl='https://www.google.com/travel/flights?hl=en-CA&gl=CA&curr=CAD';
export function manualFlightChecklist(query,{origin,destination,date,returnDate}){
 if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination)||origin===destination)throw Error('Choose different three-letter departure and arrival airport codes.');
 for(const [side,code] of [['origin',origin],['destination',destination]])if(query[`${side}Airports`]?.length&&!query[`${side}Airports`].includes(code))throw Error('Choose an airport from this calendar’s selected candidates.');
 if(!calendarDatePairs(query).some(pair=>pair.date===date&&pair.returnDate===(returnDate??null)))throw Error('Choose an exact date combination from this calendar.');
 const dates=query.tripType==='round-trip'?[date,returnDate]:[date];
 let party;
 if(query.travelers){
  party=validateTravelerIdentities(query.travelers,dates).map((person,index)=>`Traveler ${index+1}: age ${person.ages[0]} at departure${dates.length>1?`, ${person.ages[1]} at return`:''}${person.infantSeating?`, infant ${person.infantSeating==='lap'?'on lap':'in own seat'}`:''}${person.guardianId?`, guardian traveler ${query.travelers.findIndex(candidate=>candidate.id===person.guardianId)+1}`:''}`).join('; ');
 }else{
  const counts=validateTravelers(query);
  party=`${counts.adults} adult(s), ${counts.children} child/youth traveler(s)${counts.children?` (supplied departure ages: ${counts.childrenAges.join(', ')}; verify ages for these exact dates)` : ''}`;
 }
 const filters=query.filters??{};
 return [
  `${origin} → ${destination} · ${query.tripType==='round-trip'?'Round trip':'One-way'}`,
  `Departure: ${date}${returnDate?` · Return: ${returnDate}`:''}`,
  `Party: ${party}`,
  `Cabin: ${query.cabin.replaceAll('_',' ')} · Currency: CAD`,
  `Maximum stops: ${filters.maxStops??'any'} · Maximum duration per direction: ${filters.maxDurationMinutes??'any'} minutes`,
  `Layovers: ${filters.minLayover??0} minimum / ${filters.maxLayover??'any'} maximum minutes`,
  `Airlines included: ${filters.airlinesInclude?.join(', ')||'any'} · Excluded: ${filters.airlinesExclude?.join(', ')||'none'}`,
  `Excluded connection countries: ${filters.countriesExclude?.join(', ')||'none'} · Group budget: ${filters.maxPrice==null?'none':`CAD ${filters.maxPrice}`}`,
  'Enter these details in Google Flights. Verify every flight date, passenger category, guardian/seating rule, connection, total group price and seller terms. No fields are automatically filled and no fare is imported into this calendar.',
 ].join('\n');
}
