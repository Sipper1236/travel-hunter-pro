import {providerCapabilities} from './provider-capabilities.mjs';
import {matrixParty,validateTravelers,validateTravelerIdentities,rejectUnsupportedTravelerFields,skyscannerIdentityParty,googleRoundTripParty} from './travelers.mjs';
import {validateFilters} from './flight-filter-query.mjs';
import {validateMatrixOptions} from './matrix-options.mjs';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export const addDays=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
export const calendarProviders=[['ignav','Ignav'],['google','Google Flights'],['expedia','Expedia partner API'],['skyscanner','Skyscanner'],['air-canada','Air Canada NDC'],['ita-matrix','ITA Matrix'],['omkar-expedia','Expedia via Omkar']];
export const calendarSources=[['all','All compatible providers'],...calendarProviders];

export function calendarDatePairs(input){
  const departures=Array.from({length:(Date.parse(input.end)-Date.parse(input.start))/86400000+1},(_,i)=>addDays(input.start,i));
  if(input.tripType!=='round-trip')return departures.map(date=>({date,returnDate:null}));
  if(input.nightsMin!==undefined)return departures.flatMap(date=>Array.from({length:input.nightsMax-input.nightsMin+1},(_,i)=>({date,returnDate:addDays(date,input.nightsMin+i)})));
  if(!input.returnStart)return departures.map(date=>({date,returnDate:addDays(date,input.nights)}));
  const returns=Array.from({length:(Date.parse(input.returnEnd)-Date.parse(input.returnStart))/86400000+1},(_,i)=>addDays(input.returnStart,i));
  return departures.flatMap(date=>returns.filter(returnDate=>returnDate>=date).map(returnDate=>({date,returnDate})));
}

export function validateCalendarQuery(input,{configured,deferBudget=false}={}){
  if(!input)throw Error('Enter travelers for the calendar.');
  for(const side of ['origin','destination'])if(typeof input[side]!=='string'||!input[side].trim()||input[side].length>100)throw Error('Enter the selected origin and destination.');
  for(const side of ['originType','destinationType'])if(input[side]!==undefined&&!['auto','place','region'].includes(input[side]))throw Error(`Choose a valid ${side}.`);
  const airportSet=(side)=>{
    const supplied=input[`${side}Airports`];
    const type=input[`${side}Type`]??'auto';
    if((type==='region'||['auto','place'].includes(type)&&!/^[A-Z]{3}$/.test(input[side]))&&(!Array.isArray(supplied)||supplied.length===0))return [];
    const values=supplied===undefined?[input[side]]:supplied;
    if(!Array.isArray(values)||values.length<1||values.length>20||values.some(code=>typeof code!=='string'||!/^[A-Z]{3}$/.test(code))||new Set(values).size!==values.length)throw Error(`Choose one to twenty unique three-letter ${side} airport codes.`);
    return [...values];
  };
  const originAirports=airportSet('origin'),destinationAirports=airportSet('destination');
  const airportLimit=input.airportLimit??10;
  if(!Number.isInteger(airportLimit)||airportLimit<1||airportLimit>20)throw Error('Choose a calendar airport-candidate limit from 1 to 20.');
  if(originAirports.length>airportLimit||destinationAirports.length>airportLimit)throw Error(`Choose no more than ${airportLimit} airport candidates for either location.`);
  const routePairs=originAirports.flatMap(origin=>destinationAirports.filter(destination=>origin!==destination).map(destination=>({origin,destination})));
  const unresolvedLocation=!originAirports.length||!destinationAirports.length;
  if(!routePairs.length&&!unresolvedLocation)throw Error('Choose at least one different origin and destination airport pair.');
  if(!validDate(input.start)||input.start<new Date().toISOString().slice(0,10)||!validDate(input.end)||input.end<input.start||(Date.parse(input.end)-Date.parse(input.start))/86400000>30)throw Error('Choose a valid future departure range of at most 31 days.');
  const tripType=input.tripType ?? 'one-way',cabin=input.cabin ?? 'economy';
  if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
  if(!['economy','premium_economy','business','first'].includes(cabin))throw Error('Choose a valid cabin.');
  const hasReturnRange=input.returnStart!==undefined&&input.returnStart!==null&&input.returnStart!=='' || input.returnEnd!==undefined&&input.returnEnd!==null&&input.returnEnd!=='';
  const hasNightRange=input.nightsMin!==undefined||input.nightsMax!==undefined;
  if(hasNightRange&&(hasReturnRange||tripType!=='round-trip'||!Number.isInteger(input.nightsMin)||!Number.isInteger(input.nightsMax)||input.nightsMin<0||input.nightsMax>365||input.nightsMax<input.nightsMin))throw Error('Choose a minimum and maximum stay from 0 to 365 nights, without a return-date range.');
  const nightRange=hasNightRange?{nightsMin:input.nightsMin,nightsMax:input.nightsMax}:{};
  const nights=hasReturnRange||hasNightRange?null:input.nights ?? null;
  if(hasReturnRange&&(tripType!=='round-trip'||!validDate(input.returnStart)||!validDate(input.returnEnd)||input.returnEnd<input.returnStart||(Date.parse(input.returnEnd)-Date.parse(input.returnStart))/86400000>30))throw Error('Choose a valid return range of at most 31 days for a round trip.');
  if(!hasNightRange&&!hasReturnRange&&(tripType==='round-trip'&&(!Number.isInteger(nights)||nights<0||nights>365)||tripType==='one-way'&&nights!==null))throw Error('Round-trip calendars require a stay length from 0 to 365 nights or a return range; one-way calendars use no stay length.');
  if(tripType==='round-trip'&&!hasReturnRange&&!validDate(addDays(input.end,hasNightRange?input.nightsMax:nights)))throw Error('The return date is outside the supported calendar range.');
  const datePairs=calendarDatePairs({start:input.start,end:input.end,tripType,nights,...nightRange,...(hasReturnRange?{returnStart:input.returnStart,returnEnd:input.returnEnd}:{})});
  if(!datePairs.length)throw Error('Choose a return date on or after at least one departure date.');
  const source=input.source??'ignav';
  if(!calendarSources.some(([id])=>id===source))throw Error('Choose a supported flight source for the exact calendar.');
  if(input.travelers&&source!=='ignav'&&source!=='all'&&source!=='skyscanner'&&source!=='ita-matrix'&&!(source==='google'&&tripType==='round-trip'))throw Error(`${calendarSources.find(([id])=>id===source)[1]} calendar searches do not support identified travelers yet.`);
  if(source==='google'&&tripType==='one-way'&&(cabin!=='economy'||input.adults!==1||input.children!==0))throw Error('Google Flights calendars currently support one-way economy searches for one adult only on the one-way path.');
  if(source==='expedia'&&tripType==='round-trip'&&input.children>0)throw Error('Expedia flexible calendars cannot recalculate child ages on every selected flight date; use exact-date searches or an adult-only calendar.');
  if(source==='air-canada'&&tripType!=='one-way')throw Error('Air Canada NDC calendars currently support one-way searches only.');
  if(source==='omkar-expedia'&&(tripType!=='one-way'||input.adults!==1||input.children!==0))throw Error('Expedia via Omkar calendars currently support one-way searches for one adult only.');
  if(source==='ita-matrix')for(const pair of datePairs)matrixParty({...input,date:pair.date,returnDate:pair.returnDate,tripType});
  const filters=validateFilters(input.filters);
  let party;
  if (input.travelers !== undefined) {
    if(source==='skyscanner')skyscannerIdentityParty({...input,date:input.start,tripType:'one-way'});
    rejectUnsupportedTravelerFields({...input,travelers:undefined});
    if (['adults','children','childrenAges'].some(field=>input[field] !== undefined)) throw Error('Use either identified travelers or passenger counts, not both.');
    const people=validateTravelerIdentities(input.travelers,[input.start]);
    party={travelers:people.map(({ages,...person})=>person)};
  } else {
    if(!Number.isInteger(input.adults)||!Number.isInteger(input.children))throw Error('Enter explicit adult and child counts for the calendar.');
    party=validateTravelers(input);
  }
  if(source==='skyscanner'){
    if(tripType==='round-trip'&&party.children>0)throw Error('Skyscanner round-trip child searches require identified birth dates to validate ages on each flight date.');
    if(party.adults+party.children>8)throw Error('Skyscanner calendars support up to eight travelers.');
    if(party.children&&input.start!==input.end)throw Error('Skyscanner calendars need a supplied exact child age for every travel date; use a single departure date or adults only across a date range.');
  }
  if(source==='google'&&tripType==='round-trip')googleRoundTripParty({...party,date:input.start,returnDate:party.travelers?input.start:datePairs.map(pair=>pair.returnDate).sort().at(-1),tripType,cabin});
  const planned=unresolvedLocation?null:datePairs.length*routePairs.length*(source==='all'?Math.max(1,providerCapabilities({...input,cabin,tripType,filters},{calendar:true,configured}).filter(row=>row.eligible).length):1),searchLimit=input.searchLimit ?? 250;
  if(!Number.isInteger(searchLimit)||searchLimit<1||searchLimit>250)throw Error('Choose a provider/date search budget from 1 to 250.');
  if(!deferBudget||planned===null||planned<=250){
    if(planned!==null&&(!Number.isSafeInteger(planned)||planned>250))throw Error(`The selected airports, dates and providers require ${planned} exact provider/date searches, above the 250-request calendar cap. Reduce the dates, airport sets or provider count.`);
    if(planned!==null&&searchLimit<planned)throw Error(`This calendar requires ${planned} exact provider/date searches to cover every selected route and date. Choose a request budget from ${planned} to 250.`);
  }
  const matrixOptions=validateMatrixOptions(input.matrixOptions);
  if(['ita-matrix','all'].includes(source)&&matrixOptions.expandDetailedItineraries)throw Error('Detailed Matrix itinerary expansion is only available for a fixed-date single-airport search.');
  return {source,origin:input.origin.trim(),destination:input.destination.trim(),originType:input.originType ?? 'auto',destinationType:input.destinationType ?? 'auto',originAirports,destinationAirports,airportLimit,routePairs,start:input.start,end:input.end,tripType,nights,...nightRange,...(hasReturnRange?{returnStart:input.returnStart,returnEnd:input.returnEnd}:{}),cabin,...party,filters,matrixOptions,searchLimit};
}

/** A saved calendar follows route/party/filters; its range and budget restore from the job. */
export function calendarStorageKey(input){
  const f=input.filters ?? {};
  const m=input.matrixOptions??{};
  return `travel-hunter-calendar:${JSON.stringify([input.source ?? 'ignav',input.origin,input.destination,input.originAirports ?? [input.origin],input.destinationAirports ?? [input.destination],input.airportLimit??10,input.tripType ?? 'one-way',input.cabin ?? 'economy',input.travelers ?? null,input.adults,input.children,input.childrenAges ?? [],f.maxStops ?? null,f.maxPrice ?? null,f.maxDurationMinutes ?? null,f.sort ?? 'price',f.minLayover ?? null,f.maxLayover ?? null,f.airlinesInclude ?? [],f.airlinesExclude ?? [],f.countriesExclude ?? [],m.maxExtraLegsRelativeToMinimum??1,m.allowAirportChanges??true])}`;
}
