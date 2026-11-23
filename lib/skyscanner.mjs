import {airportTimezones,validateZonedItinerary} from './airport-timezones.mjs';
import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceJson} from './source-json.mjs';
import {rejectUnsupportedTravelerFields,skyscannerIdentityParty,ageOnDate} from './travelers.mjs';
import {flightOfferError} from './flight-offer.mjs';
import {SourceRequestError} from './source-errors.mjs';
const API = 'https://partners.api.skyscanner.net/apiservices/v3/flights/live';
const MAX_POLL_CALLS=8,MIN_POLL_INTERVAL_MS=1000,MAX_POLL_INTERVAL_MS=10000;
const iata = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function apiKeyFrom(options) {
  const key = options.apiKey ?? process.env.SKYSCANNER_API_KEY;
  if (!key) throw new Error('Skyscanner is not configured. Set SKYSCANNER_API_KEY on the server.');
  return key;
}

function pollingBudget(options){
 const maxPolls=options.maxPolls??MAX_POLL_CALLS,pollIntervalMs=options.pollIntervalMs??MIN_POLL_INTERVAL_MS;
 if(!Number.isInteger(maxPolls)||maxPolls<0||maxPolls>MAX_POLL_CALLS)throw new Error(`Skyscanner poll budget must be an integer from 0 to ${MAX_POLL_CALLS}.`);
 if(!Number.isInteger(pollIntervalMs)||pollIntervalMs<MIN_POLL_INTERVAL_MS||pollIntervalMs>MAX_POLL_INTERVAL_MS)throw new Error(`Skyscanner poll interval must be from ${MIN_POLL_INTERVAL_MS} to ${MAX_POLL_INTERVAL_MS} milliseconds.`);
 return {maxPolls,pollIntervalMs};
}

async function request(path, { method = 'POST', body, options = {} } = {}) {
  const response = await fetchSource('Skyscanner',`${API}${path}`, {
    method,
    signal:options.signal,
    headers: { 'x-api-key': apiKeyFrom(options), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, {...options,timeoutMs:options.timeoutMs ?? 20000,retrySafe:method==='GET' || path.includes('/poll/')});
  if (!response.ok) throw new Error(`Skyscanner request failed (HTTP ${response.status}).`);
  return readBoundedSourceJson(response,{provider:'Skyscanner',maxBytes:10_000_000});
}

function completed(response) {
  const status = String(response?.status ?? '').toLowerCase();
  return ['complete', 'completed', 'result_status_complete', 'result_status_completed'].includes(status);
}

function placeCode(placeId, places) {
  const place = places?.[placeId];
  return place?.iata || (iata(placeId) ? placeId : null);
}

function timeString(value) {
  if (!value || !Number.isInteger(value.year) || !Number.isInteger(value.month) || !Number.isInteger(value.day) || !Number.isInteger(value.hour) || value.hour<0 || value.hour>23 || !Number.isInteger(value.minute) || value.minute<0 || value.minute>59 || value.second!==undefined&&(!Number.isInteger(value.second)||value.second<0||value.second>59)) return null;
  const pad = n => String(n).padStart(2, '0');
  const day=`${String(value.year).padStart(4, '0')}-${pad(value.month)}-${pad(value.day)}`;
  return date(day)?`${day}T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second ?? 0)}`:null;
}

function normalizeLeg(leg,results,origin,destination,date){
  if(!Array.isArray(leg?.segmentIds)||!leg.segmentIds.length)return null;
  const segments=leg.segmentIds.map(id=>results.segments?.[id]);
  if(segments.some(segment=>!segment))return null;
  const first = segments[0], last = segments.at(-1), places = results.places ?? {}, carriers = results.carriers ?? {};
  const from = placeCode(first.originPlaceId, places), to = placeCode(last.destinationPlaceId, places);
  const depart = timeString(first.departureDateTime), arrive = timeString(last.arrivalDateTime);
  if (from !== origin || to !== destination || depart?.slice(0, 10) !== date || !arrive || !Number.isFinite(leg.durationInMinutes)||leg.durationInMinutes<=0) return null;
  const segmentRows = segments.map(segment => ({
    from: placeCode(segment.originPlaceId, places), to: placeCode(segment.destinationPlaceId, places),
    departureAt: timeString(segment.departureDateTime), arrivalAt: timeString(segment.arrivalDateTime),
    flightNumber: segment.marketingFlightNumber || '', carrierCode: carriers[segment.marketingCarrierId]?.iata || carriers[segment.marketingCarrierId]?.displayCode || '',
    carrier: carriers[segment.marketingCarrierId]?.name || 'Airline not identified',
  }));
  if (segmentRows.some(segment => !iata(segment.from) || !iata(segment.to) || !segment.departureAt || !segment.arrivalAt)) return null;
  for (let i = 1; i < segmentRows.length; i++) if (segmentRows[i - 1].to !== segmentRows[i].from) return null;
  const airlines = [...new Set(segmentRows.map(segment => segment.carrier))];
  const via = segmentRows.slice(0, -1).map(segment => segment.to);
  return {from,to,airlines,departureDate:depart.slice(0,10),departureTime:depart.slice(11,16),arrivalDate:arrive.slice(0,10),arrivalTime:arrive.slice(11,16),durationMinutes:leg.durationInMinutes,via,segments:segmentRows};
}

function normalize(itineraryId, itinerary, results, query, sessionToken) {
  if(!Array.isArray(itinerary?.legIds)||itinerary.legIds.length!==(query.tripType==='round-trip'?2:1))return [];
  const outbound=normalizeLeg(results.legs?.[itinerary.legIds[0]],results,query.origin,query.destination,query.date);
  const inbound=query.tripType==='round-trip'?normalizeLeg(results.legs?.[itinerary.legIds[1]],results,query.destination,query.origin,query.returnDate):null;
  if(!outbound||query.tripType==='round-trip'&&!inbound)return [];
  if(query.people){
    try{for(const person of query.people)for(const segment of [...outbound.segments,...(inbound?.segments??[])])for(const local of [segment.departureAt,segment.arrivalAt]){
      const age=ageOnDate(person.birthDate,local.slice(0,10));if(age<2||person.ages[0]<18&&age!==person.ages[0]||person.ages[0]>=18&&age<18)return [];
    }}catch{return [];}
  }
  const options = itinerary.pricingOptions ?? [];
  return options.flatMap(option => {
    const divisor={PRICE_UNIT_WHOLE:1,PRICE_UNIT_CENTI:100,PRICE_UNIT_MILLI:1000,PRICE_UNIT_MICRO:1000000}[option.price?.unit];
    const rawAmount=option.price?.amount;
    if(!divisor||!(typeof rawAmount==='number'||typeof rawAmount==='string'&&/^\d+(?:\.\d+)?$/.test(rawAmount)))return [];
    const amount = Number(rawAmount)/divisor,cents=Math.round(amount*100);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents)||Math.abs(amount*100-cents)>1e-6) return [];
    const deepLink = option.items?.find(item => typeof item.deepLink === 'string')?.deepLink;
    let sourceUrl = null;
    try { const url = new URL(deepLink); if (url.protocol === 'https:') sourceUrl = url.toString(); } catch {}
    const offer={
      ...outbound,...(inbound?{inbound}:{}),
      provider: 'Skyscanner', source: 'Skyscanner Flights Live Prices API', section: 'live', observedAt: new Date().toISOString(),
      price: amount, currency: query.currency, travelers: `${query.adults} adult${query.adults === 1 ? '' : 's'}${query.childrenAges.length ? `, ${query.childrenAges.length} child${query.childrenAges.length === 1 ? '' : 'ren'} (${query.childrenAges.join(', ')})` : ''}`, cabin: query.cabin,
      sourceUrl, bookingStatus: sourceUrl ? 'Provider handoff; seller price not refreshed' : 'No booking link returned',
      fees: 'Provider-reported fare; verify inclusions and final seller price',
      skyscannerSessionToken: sessionToken, skyscannerItineraryId: itineraryId,
    };
    return [offer];
  });
}

async function queryTimezones(query,options){
 const evidence=await (options.loadTimezones??airportTimezones)({signal:options.signal});
 if(!evidence?.byCode||!evidence.byCode.has(query.origin)||!evidence.byCode.has(query.destination))throw Error('Fresh unambiguous airport timezone evidence is required for this Skyscanner route.');
 return evidence;
}

async function withTimeEvidence(offers,query,evidence){
 if(!offers.length)return offers;
 return offers.flatMap(offer=>{try{
  const validated=validateZonedItinerary(offer,evidence),legs=[validated,...(validated.inbound?[validated.inbound]:[])];
  if(legs.some(leg=>{const elapsed=(Date.parse(leg.segments.at(-1).arrival_time_utc)-Date.parse(leg.segments[0].departure_time_utc))/60000;return !Number.isInteger(elapsed)||elapsed<=0||elapsed!==leg.durationMinutes;}))return [];
  return flightOfferError(validated,query)?[]:[validated];
 }catch{return [];}});
}

function offersFrom(response, query, sessionToken) {
  const results = response?.content?.results;
  if (!results?.itineraries || typeof results.itineraries !== 'object') return [];
  return Object.entries(results.itineraries).flatMap(([id, itinerary]) => normalize(id, itinerary, results, query, sessionToken));
}

function validate(input) {
  const identified=input?.travelers!==undefined?skyscannerIdentityParty(input):null;
  if(!identified)rejectUnsupportedTravelerFields(input);
  if (!iata(input?.origin) || !iata(input?.destination) || input.origin === input.destination || !date(input.date) || input.date < new Date().toISOString().slice(0, 10)) throw new Error('Skyscanner searches require different IATA codes and a valid future date.');
  const adults = identified?.adults ?? input.adults ?? 1, childrenAges = identified?.childrenAges ?? input.childrenAges ?? [];
  if (!Number.isInteger(adults) || adults < 1 || adults > 8 || !Array.isArray(childrenAges) || childrenAges.some(age => !Number.isInteger(age) || age < 2 || age > 17) || adults + childrenAges.length > 8) throw new Error('Skyscanner supports up to eight travelers; provide actual child ages.');
  if ((input.children ?? childrenAges.length) !== childrenAges.length) throw new Error('Provide each child’s actual age for Skyscanner pricing.');
  const cabin = input.cabin ?? 'economy', cabins = { economy: 'CABIN_CLASS_ECONOMY', premium_economy: 'CABIN_CLASS_PREMIUM_ECONOMY', business: 'CABIN_CLASS_BUSINESS', first: 'CABIN_CLASS_FIRST' };
  if (!cabins[cabin]) throw new Error('Unsupported cabin class.');
  const market = input.market ?? 'CA', currency = input.currency ?? 'CAD', locale = input.locale ?? 'en-CA';
  if (market !== 'CA' || currency !== 'CAD' || locale !== 'en-CA') throw new Error('Only the Canadian market, CAD, and en-CA locale are supported.');
  const tripType=input.tripType??'one-way';
  if(!['one-way','round-trip'].includes(tripType)||tripType==='round-trip'&&(!date(input.returnDate)||input.returnDate<input.date))throw Error('Choose a valid Skyscanner trip type and return date.');
  return {...(identified?{people:identified.people}:{}), origin: input.origin, destination: input.destination, date: input.date,tripType,...(tripType==='round-trip'?{returnDate:input.returnDate}:{}), adults, childrenAges, cabin, cabinCode: cabins[cabin], market, currency, locale };
}

function mergeSearchResponse(previous,next){
  if(next.status==='RESULT_STATUS_FAILED')throw new SourceRequestError('Skyscanner reported that this search failed.',{status:'temporarily_unavailable'});
  if(next.action==='RESULT_ACTION_REPLACED'||next.content?.action==='RESULT_ACTION_REPLACED')return next;
  const priorResults=previous.content?.results??{},nextResults=next.content?.results??{},results={...priorResults,...nextResults};
  for(const table of ['itineraries','legs','segments','places','carriers','agents'])if(priorResults[table]||nextResults[table])results[table]={...priorResults[table],...nextResults[table]};
  return {...previous,...next,content:{...previous.content,...next.content,results}};
}

async function pollSearch(sessionToken, initial, options,budget,onSnapshot=async()=>{}) {
  if(initial.status==='RESULT_STATUS_FAILED')throw new SourceRequestError('Skyscanner reported that this search failed.',{status:'temporarily_unavailable'});
  let response = initial,pollsRequested=0;
  await onSnapshot(response,pollsRequested);
  for (; !completed(response) && pollsRequested < budget.maxPolls;) {
    await (options.sleep ?? sleep)(budget.pollIntervalMs);
    response = mergeSearchResponse(response,await request(`/search/poll/${encodeURIComponent(sessionToken)}`, { options }));
    pollsRequested++;
    await onSnapshot(response,pollsRequested);
  }
  return {response,pollsRequested};
}

export async function searchSkyscanner(input, options = {}) {
  const query = validate(input);
  const budget=pollingBudget(options);
  apiKeyFrom(options);
  const timezones=await queryTimezones(query,options);
  const queryLeg=(origin,destination,value)=>({originPlaceId:{iata:origin},destinationPlaceId:{iata:destination},date:{year:Number(value.slice(0,4)),month:Number(value.slice(5,7)),day:Number(value.slice(8,10))}});
  const initial = await request('/search/create', { body: { query: {
    market: query.market, locale: query.locale, currency: query.currency,
    queryLegs: [queryLeg(query.origin,query.destination,query.date),...(query.tripType==='round-trip'?[queryLeg(query.destination,query.origin,query.returnDate)]:[])],
    cabinClass: query.cabinCode, adults: query.adults, ...(query.childrenAges.length ? { childrenAges: query.childrenAges } : {}),
    includeSustainabilityData: false,
  } }, options });
  if (typeof initial.sessionToken !== 'string' || !initial.sessionToken) throw new Error('Skyscanner did not return a search session.');
  const progressParty=query.people?{travelers:query.people.map(({ages,...person})=>person)}:{adults:query.adults,children:query.childrenAges.length,childrenAges:query.childrenAges};
  const progressQuery={origin:query.origin,destination:query.destination,date:query.date,cabin:query.cabin,tripType:query.tripType,returnDate:query.returnDate??null,...progressParty,filters:input.filters??{}};
  const publishPartial=async(response,pollsRequested)=>{
   if(!options.onUpdate||completed(response))return;
   try{
    const rawOffers=offersFrom(response,query,initial.sessionToken),offers=await withTimeEvidence(rawOffers,query,timezones),observedAt=new Date().toISOString();
    await options.onUpdate({query:progressQuery,offers,priceObservations:[],observedAt,complete:false,partial:true,filters:input.filters??{},sources:[{provider:'Skyscanner',status:'partial',received:rawOffers.length,accepted:offers.length,polling:{pollsRequested,maxPolls:budget.maxPolls,remainingPolls:budget.maxPolls-pollsRequested},...(rawOffers.length>offers.length?{rejected:rawOffers.length-offers.length}:{})}],limitations:['Skyscanner is still collecting this search; the displayed offers are validated partial observations.']});
   }catch{/* Progress publication must not turn a valid provider response into a failed source search. */}
  };
  const {response,pollsRequested} = await pollSearch(initial.sessionToken, initial, options,budget,publishPartial);
  const rawOffers=offersFrom(response,query,initial.sessionToken),offers=await withTimeEvidence(rawOffers,query,timezones);
  return {
    offers, observedAt: new Date().toISOString(), complete: completed(response),
    sources: [{ provider: 'Skyscanner', status: completed(response) ? 'ok' : 'partial', received: rawOffers.length, accepted: offers.length, polling:{pollsRequested,maxPolls:budget.maxPolls,remainingPolls:budget.maxPolls-pollsRequested}, ...(rawOffers.length>offers.length?{rejected:rawOffers.length-offers.length}:{}) }],
    limitation: 'Results are limited to itineraries returned by Skyscanner. Use refresh before seller handoff; the price can still change at checkout.',
  };
}

export async function refreshSkyscanner(input, options = {}) {
  if (typeof input?.sessionToken !== 'string' || input.sessionToken.length > 512 || typeof input?.itineraryId !== 'string' || input.itineraryId.length > 512) throw new Error('A recent Skyscanner session and itinerary ID are required for refresh.');
  const query = validate(input);
 const budget=pollingBudget(options);
  apiKeyFrom(options);
  const timezones=await queryTimezones(query,options);
  const refreshPathToken = input.sessionToken.endsWith('-cells1') ? input.sessionToken : `${input.sessionToken}-cells1`;
  const started = await request(`/itineraryrefresh/create/${encodeURIComponent(refreshPathToken)}`, { body: { itineraryId: input.itineraryId }, options });
  if(started.status==='RESULT_STATUS_FAILED')throw new SourceRequestError('Skyscanner reported that this refresh failed.',{status:'temporarily_unavailable'});
  if (typeof started.refreshSessionToken !== 'string' || !started.refreshSessionToken) throw new Error('Skyscanner did not return a refresh session.');
  let response = started;
  let pollsRequested=0;
  for (; !completed(response) && pollsRequested < budget.maxPolls;) {
    await (options.sleep ?? sleep)(budget.pollIntervalMs);
    response = mergeSearchResponse(response,await request(`/itineraryrefresh/poll/${encodeURIComponent(started.refreshSessionToken)}`, { method: 'GET', options }));
    pollsRequested++;
  }
  const rawOffers=offersFrom(response,query,input.sessionToken).filter(offer=>offer.skyscannerItineraryId===input.itineraryId),offers=await withTimeEvidence(rawOffers,query,timezones);
  return { status: completed(response) ? 'refreshed' : 'partial', offers, received:rawOffers.length, accepted:offers.length,polling:{pollsRequested,maxPolls:budget.maxPolls,remainingPolls:budget.maxPolls-pollsRequested},...(rawOffers.length>offers.length?{rejected:rawOffers.length-offers.length}:{}),limitation: 'The refresh is a provider quote, not guaranteed availability at the seller checkout.' };
}
