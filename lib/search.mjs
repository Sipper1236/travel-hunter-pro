import {fetchSource} from './source-fetch.mjs';
import {rejectUnsupportedTravelerFields} from './travelers.mjs';
import {sourceFailure} from './source-errors.mjs';
import {getJobStore} from './job-store.mjs';
import { call } from 'api-anything';
import { flightOfferError } from './flight-offer.mjs';

const place = /^[\p{L}\p{M} .,'-]{2,60}$/u;
export function validateQuery(input, today = new Date().toISOString().slice(0, 10)) {
  rejectUnsupportedTravelerFields(input);
  if (!input || typeof input !== 'object') throw new Error('Provide a search request.');
  const origin = typeof input.origin === 'string' ? input.origin.trim() : '';
  const destination = typeof input.destination === 'string' ? input.destination.trim() : '';
  if (!place.test(origin) || !place.test(destination)) throw new Error('Enter an airport code or city name for both places.');
  const date = input.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date < today) throw new Error('Enter a valid departure date that is today or later.');
  if (input.tripType !== 'one-way' || input.cabin !== 'economy' || input.adults !== 1 || input.children !== 0) throw new Error('This source currently supports one-way, economy searches for one adult only.');
  return { origin, destination, date, tripType: 'one-way', cabin: 'economy', adults: 1, children: 0 };
}
const code = x => typeof x === 'string' && /^[A-Z]{3}$/.test(x);
const time = x => Array.isArray(x) && x.length >= 1 && x.length <= 2 && (x[0] == null || Number.isInteger(x[0]) && x[0] >= 0 && x[0] <= 23) && (x[1] == null || Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= 59) ? `${String(x[0] ?? 0).padStart(2,'0')}:${String(x[1] ?? 0).padStart(2,'0')}` : null;
export function normalize(item, query, observedAt, section) {
  if (!item || !Number.isFinite(item.price) || item.price <= 0 || !code(item.from) || !code(item.to) || !Array.isArray(item.airline) || !item.airline.length || !item.airline.every(x => typeof x === 'string' && x.trim()) || !Number.isInteger(item.durationMinutes) || item.durationMinutes <= 0) return null;
  const departureTime = time(item.departureTime), arrivalTime = time(item.arrivalTime);
  if (!departureTime || !arrivalTime || !Array.isArray(item.arrivalDate) || item.arrivalDate.length !== 3 || !item.arrivalDate.every(Number.isInteger)) return null;
  const arrivalDate = item.arrivalDate.map((v,i) => String(v).padStart(i === 0 ? 4 : 2, '0')).join('-');
  if (!Number.isFinite(Date.parse(`${arrivalDate}T00:00:00Z`)) || new Date(`${arrivalDate}T00:00:00Z`).toISOString().slice(0,10) !== arrivalDate || arrivalDate < query.date) return null;
  const via = item.via ?? [];
  if (!Array.isArray(via) || !via.every(code)) return null;
  const url = new URL('https://www.google.com/travel/flights');
  url.search = new URLSearchParams({ q: `Flights from ${query.origin} to ${query.destination} on ${query.date} one way`, 'hl': 'en-CA', gl: 'CA', curr: 'CAD' }).toString();
  const currency=typeof item.currency==='string'&&/^[A-Z]{3}$/.test(item.currency)?item.currency:undefined;
  return { source: 'Google Flights via api-anything', section, observedAt, price: item.price, ...(currency?{currency}:{}), travelers: '1 adult', cabin: 'economy', from: item.from, to: item.to, airlines: item.airline, departureDate: query.date, departureTime, arrivalDate, arrivalTime, durationMinutes: item.durationMinutes, via, sourceUrl: url.toString(), bookingStatus: 'Unconfirmed; search page only', fees: 'Taxes and baggage inclusions not independently verified' };
}
// Keep the package's parser and request Canadian locale/currency; a request alone does not prove the response currency.
export function canadianFetch(url, init) {
  const target = new URL(url);
  if (target.hostname === 'www.google.com' && target.pathname === '/travel/flights') {
    target.searchParams.set('curr', 'CAD');
    target.searchParams.set('gl', 'CA');
    target.searchParams.set('hl', 'en-CA');
  }
  return fetchSource('Google Flights',target,init,{retrySafe:false,timeoutMs:15000});
}
export async function searchFlights(input, run = call, {fetchImpl=canadianFetch}={}) {
  const query = validateQuery(input);
  const observedAt = new Date().toISOString();
  const statuses = [], offers = [];
  for (const operation of ['search', 'top']) {
    let result,transportError;
    const observedFetch=async (...args)=>{try{return await fetchImpl(...args);}catch(error){transportError=error;throw error;}};
    try { result = await run('google-flights', operation, { origin: query.origin, destination: query.destination, date: query.date }, { maxTier: 1, timeoutMs: 15000, fetchImpl: observedFetch }); }
    catch (error) { statuses.push({...sourceFailure('Google Flights',transportError ?? error),operation}); break; }
    if (!result.ok) {
      if(transportError?.sourceStatus){statuses.push({...sourceFailure('Google Flights',transportError),operation});break;}
      statuses.push({ operation, status: result.class || 'error', reason: result.reason || 'Source unavailable.' });
      if (['rate','blocked','auth'].includes(result.class)) {if(run===call)getJobStore().deferSource('Google Flights',Date.now()+(result.class==='rate'?60000:300000),result.class);break;}
      continue;
    }
    if (!Array.isArray(result.data)) { statuses.push({ operation, status: 'error', reason: 'Unexpected source response.' }); continue; }
    const normalized = result.data.map(item => normalize(item, query, observedAt, operation)).filter(offer => offer && !flightOfferError(offer, query));
    statuses.push({ operation, status: 'ok', received: result.data.length, accepted: normalized.length, partial: Boolean(result.truncated) });
    offers.push(...normalized);
  }
  offers.sort((a,b) => a.price-b.price);
  return { query, observedAt, offers, sources: statuses, complete: statuses.length === 2 && statuses.every(s => s.status === 'ok' && !s.partial && s.received === s.accepted), limitations: ['One-way, one adult, economy, CAD only.', 'This is a source observation, not a confirmed booking. Prices can change.', 'Search-page links are not individual booking links.', 'Coverage is limited to the returned Google Flights lists; not an exhaustive market search.'] };
}
