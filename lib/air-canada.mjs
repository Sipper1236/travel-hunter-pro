import {fetchSource} from './source-fetch.mjs';
import {readBoundedSourceText} from './source-json.mjs';
import {rejectUnsupportedTravelerFields} from './travelers.mjs';
import { randomUUID } from 'node:crypto';
import { parse } from 'node-html-parser';

const NDC = 'http://www.iata.org/IATA/EDIST/2017.2';
const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const AGGREGATION = 'https://prod.services.atpco.net/ndcexchange/NDC/schema/v1';
const iata = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const text = (node, selector) => node?.querySelector(selector)?.text.trim() || '';
const attr = (node, name) => node?.getAttribute(name) || '';

function config(options) {
  const apiKey = options.apiKey ?? process.env.AIR_CANADA_NDC_API_KEY;
  const sellerId = options.sellerId ?? process.env.AIR_CANADA_NDC_SELLER_ID;
  const iataNumber = options.iataNumber ?? process.env.AIR_CANADA_NDC_IATA_NUMBER;
  const agencyId = options.agencyId ?? process.env.AIR_CANADA_NDC_AGENCY_ID;
  if (!apiKey || !sellerId || !iataNumber || !agencyId) throw new Error('Air Canada NDC requires its issued API key, SellerID, accredited IATA/TIDS number, and Agency ID.');
  if (!/^\d{7,8}$/.test(iataNumber)) throw new Error('AIR_CANADA_NDC_IATA_NUMBER must be the accredited 7–8 digit IATA/TIDS number.');
  const base = options.baseUrl ?? process.env.AIR_CANADA_NDC_BASE_URL ?? 'https://ndcpartners.aircanada.com/agg/ndc/17.2/v1';
  const url = new URL(base);
  if (url.protocol !== 'https:' || !['ndcpartners.aircanada.com', 'gold-ndcpartners.aircanada.com'].includes(url.hostname)) throw new Error('Air Canada NDC base URL must use an approved Air Canada host.');
  return { apiKey, sellerId, iataNumber, agencyId, base: url.toString().replace(/\/$/, '') };
}

function passengerList(adults) {
  return Array.from({ length: adults }, (_, i) => `<Passenger PassengerID="PAX-${i + 1}"><PTC>ADT</PTC></Passenger>`).join('');
}

function iataMessage({ operation, query, config: c, ids }) {
  const token = randomUUID();
  const common = `<Document><Name>NDC-Exchange-Aggregation</Name><ReferenceVersion>17.2</ReferenceVersion></Document><Party><Sender><TravelAgencySender><Name>Travel Hunter Pro</Name><IATA_Number>${esc(c.iataNumber)}</IATA_Number><AgencyID>${esc(c.agencyId)}</AgencyID></TravelAgencySender></Sender></Party>`;
  const pax = `<DataLists><PassengerList>${passengerList(query.adults)}</PassengerList></DataLists>`;
  if (operation === 'AirShopping') return `<AirShoppingRQ EchoToken="${token}" Version="2017.2" xmlns="${NDC}">${common}<Parameters><Languages><LanguageCode>en-CA</LanguageCode></Languages></Parameters><CoreQuery><OriginDestinations><OriginDestination><Departure><AirportCode>${query.origin}</AirportCode><Date>${query.date}</Date></Departure><Arrival><AirportCode>${query.destination}</AirportCode></Arrival></OriginDestination></OriginDestinations></CoreQuery>${pax}</AirShoppingRQ>`;
  return `<OfferPriceRQ EchoToken="${token}" Version="2017.2" xmlns="${NDC}">${common}<Query><Offer OfferID="${esc(ids.offerId)}" Owner="${esc(ids.owner || 'AC')}" ResponseID="${esc(ids.responseId)}"><OfferItem OfferItemID="${esc(ids.offerItemId)}"><PassengerRefs>${Array.from({ length: query.adults }, (_, i) => `PAX-${i + 1}`).join(' ')}</PassengerRefs></OfferItem></Offer></Query>${pax}</OfferPriceRQ>`;
}

function envelope(payload, sellerId) {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="${SOAP}" xmlns:ACNDC="${AGGREGATION}"><soapenv:Header/><soapenv:Body><ACNDC:NDCMSG_Envelope><NDCMSG_Header><Sender><SellerID>${esc(sellerId)}</SellerID></Sender><Recipient><Address><Company>AC</Company></Address></Recipient><SchemaType>NDC</SchemaType><SchemaVersion>YY.2017.2</SchemaVersion></NDCMSG_Header><NDCMSG_Body><NDCMSG_Payload><![CDATA[${payload}]]></NDCMSG_Payload></NDCMSG_Body></ACNDC:NDCMSG_Envelope></soapenv:Body></soapenv:Envelope>`;
}

async function call(operation, query, ids, options) {
  const c = config(options), payload = iataMessage({ operation, query, config: c, ids });
  const response = await fetchSource('Air Canada NDC',`${c.base}/${operation}`, {
    method: 'POST',
    headers: { 'x-api-key': c.apiKey, 'Content-Type': 'application/xml', Accept: 'application/xml' },
    body: envelope(payload, c.sellerId),
  }, {...options,timeoutMs:options.timeoutMs ?? 60000});
  if (!response.ok) throw new Error(`Air Canada NDC ${operation} failed (HTTP ${response.status}).`);
  return readBoundedSourceText(response,{provider:'Air Canada NDC',maxBytes:10_000_000});
}

function payloadRoot(xml) {
  const response = parse(xml);
  const payload = response.querySelector('ndcmsg_payload');
  const cdata = payload?.innerHTML?.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1];
  return parse(cdata || xml);
}

function money(node) {
  const candidates = [
    node?.querySelector('totalamount simplecurrencyprice'),
    node?.querySelector('totalprice detailcurrencyprice total'),
    node?.querySelector('totalamount total'),
  ].filter(Boolean);
  for (const value of candidates) {
    const amount = Number(value.text.trim()), currency = attr(value, 'Code') || attr(value, 'CurCode') || attr(value, 'CurrencyCode');
    if (Number.isFinite(amount) && amount > 0 && /^[A-Z]{3}$/.test(currency)) return { amount, currency };
  }
  return null;
}

function cabin(node) {
  const code = text(node, 'cabintypecode').toUpperCase();
  return ({ Y: 'economy', W: 'premium_economy', C: 'business', F: 'first', '5': 'economy', '4': 'premium_economy', '2': 'business', '1': 'first', ECONOMY: 'economy', BUSINESS: 'business', FIRST: 'first' })[code] || null;
}

function segmentMap(root) {
  const segments = new Map();
  for (const node of root.querySelectorAll('paxsegment, flightsegment')) {
    const id = attr(node, 'PaxSegmentID') || attr(node, 'SegmentKey') || text(node, 'paxsegmentid') || text(node, 'segmentkey');
    const departure = node.querySelector('dep') || node.querySelector('departure');
    const arrival = node.querySelector('arrival');
    const from = text(departure, 'airportcode'), to = text(arrival, 'airportcode');
    const dateValue = text(departure, 'date'), timeValue = text(departure, 'time');
    const arrivalDate = text(arrival, 'date') || dateValue, arrivalTime = text(arrival, 'time');
    const carrier = node.querySelector('marketingcarrierinfo');
    const flight = text(carrier, 'marketingcarrierflightnumbertext') || text(carrier, 'flightnumber') || text(node, 'marketingcarrierflightnumbertext');
    const airline = text(carrier, 'carrierdesigcode') || text(node, 'marketingcarrierdesignator');
    if (id && iata(from) && iata(to) && dateValue && timeValue && arrivalDate && arrivalTime && flight && airline) segments.set(id, { from, to, departureAt: `${dateValue}T${timeValue}`, arrivalAt: `${arrivalDate}T${arrivalTime}`, flightNumber: flight, airline });
  }
  return segments;
}

function refsIn(node) {
  return [...new Set([...node.querySelectorAll('segmentrefs,paxsegmentrefid,flightref')].flatMap(ref => ref.text.trim().split(/\s+/)).filter(Boolean))];
}

function normalizeAirShopping(xml, query) {
  const root = payloadRoot(xml), responseNode = root.querySelector('shoppingresponseid');
  const responseId = text(responseNode, 'responseid') || attr(responseNode, 'ResponseID') || text(root, 'responseid');
  const error = text(root, 'errors error description') || text(root, 'errors error');
  if (error) throw new Error(`Air Canada NDC rejected the search: ${error.slice(0, 240)}`);
  const segments = segmentMap(root), offers = [], rawOffers = root.querySelectorAll('offer');
  for (const offer of rawOffers) {
    const offerId = attr(offer, 'OfferID') || text(offer, 'offerid'), owner = attr(offer, 'Owner') || text(offer, 'owner');
    for (const item of offer.querySelectorAll('offeritem')) {
      const offerItemId = attr(item, 'OfferItemID') || text(item, 'offeritemid');
      const price = money(item);
      const routeRefs = refsIn(item);
      const itinerarySegments = routeRefs.map(id => segments.get(id)).filter(Boolean);
      const cabinClass = cabin(item);
      if (!offerId || !offerItemId || !responseId || !price || price.currency !== 'CAD' || !cabinClass || cabinClass !== query.cabin || !itinerarySegments.length) continue;
      if (itinerarySegments[0].from !== query.origin || itinerarySegments.at(-1).to !== query.destination || itinerarySegments.some((segment, i) => i && itinerarySegments[i - 1].to !== segment.from)) continue;
      if (itinerarySegments[0].departureAt.slice(0, 10) !== query.date) continue;
      offers.push({
        provider: 'Air Canada NDC', source: 'Air Canada NDC AirShopping', section: 'AirShopping', observedAt: new Date().toISOString(),
        price: price.amount, currency: price.currency, travelers: `${query.adults} adult${query.adults === 1 ? '' : 's'}`, cabin: cabinClass,
        from: query.origin, to: query.destination, airlines: [...new Set(itinerarySegments.map(segment => segment.airline))],
        departureDate: itinerarySegments[0].departureAt.slice(0, 10), departureTime: itinerarySegments[0].departureAt.slice(11, 16),
        arrivalDate: itinerarySegments.at(-1).arrivalAt.slice(0, 10), arrivalTime: itinerarySegments.at(-1).arrivalAt.slice(11, 16),
        durationMinutes: null, via: itinerarySegments.slice(0, -1).map(segment => segment.to), segments: itinerarySegments,
        bookingStatus: 'Air Canada offer observed; reprice with OfferPrice before any booking',
        fees: 'Provider total from NDC OfferItem; confirm with OfferPrice',
        airCanadaOffer: { offerId, offerItemId, responseId, owner: owner || 'AC' },
      });
    }
  }
  return { offers, responseId, received: rawOffers.length };
}

function validate(input) {
  rejectUnsupportedTravelerFields(input);
  if (!iata(input?.origin) || !iata(input?.destination) || input.origin === input.destination || !date(input.date) || input.date < new Date().toISOString().slice(0, 10)) throw new Error('Air Canada NDC requires different IATA codes and a valid future date.');
  const adults = input.adults ?? 1;
  if (!Number.isInteger(adults) || adults !== 1 || (input.children ?? 0) > 0) throw new Error('This first Air Canada NDC adapter supports one adult and no children.');
  const cabin = input.cabin ?? 'economy';
  if (!['economy', 'premium_economy', 'business', 'first'].includes(cabin)) throw new Error('Unsupported cabin class.');
  return { origin: input.origin, destination: input.destination, date: input.date, adults, cabin };
}

export async function searchAirCanada(input, options = {}) {
  const query = validate(input), xml = await call('AirShopping', query, null, options), parsed = normalizeAirShopping(xml, query);
  if (parsed.received && !parsed.offers.length) throw new Error('Air Canada returned offers, but none matched the current NDC normalization rules; no fare was imported.');
  return { offers: parsed.offers, responseId: parsed.responseId, observedAt: new Date().toISOString(), complete: false, sources: [{ provider: 'Air Canada NDC', status: 'ok', received: parsed.received, accepted: parsed.offers.length }] };
}

export async function refreshAirCanada(input, options = {}) {
  const query = validate(input), ids = input.airCanadaOffer;
  if (!ids || !['offerId', 'offerItemId', 'responseId'].every(key => typeof ids[key] === 'string' && ids[key].length > 0)) throw new Error('Run a fresh Air Canada search before repricing an offer.');
  const xml = await call('OfferPrice', query, ids, options), root = payloadRoot(xml);
  const priced = root.querySelector('pricedoffer') || root.querySelector('offerprice rs pricedoffer') || root.querySelector('offer');
  const price = money(priced);
  if (!price || price.currency !== 'CAD') throw new Error('Air Canada returned no CAD price for this selection.');
  return { status: 'refreshed', price: price.amount, currency: price.currency, limitation: 'Air Canada OfferPrice refreshed the fare; this is not a ticket or booking confirmation.' };
}
