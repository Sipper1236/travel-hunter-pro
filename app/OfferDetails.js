import {carrierEligibilityGuidance} from '../lib/carrier-eligibility.mjs';

export default function OfferDetails({offer,query}) {
 const count=Array.isArray(query?.travelers)?query.travelers.length:Number(query?.adults)+Number(query?.children??0);
 const segments=[...(offer.segments??[]),...(offer.inbound?.segments??[])];
 const observed=Date.parse(offer.observedAt);
 const eligibility=carrierEligibilityGuidance(offer,query);
 return <details><summary>Price and source details</summary>
  <p>Group price: CAD {offer.price.toFixed(2)}{Number.isInteger(count)&&count>0?` · CAD ${(offer.price/count).toFixed(2)} average per traveler (${count} ${count===1?'traveler':'travelers'}).`:''}</p>
  <p>Data source: {offer.source||offer.provider||'Not supplied'}. Seller: {offer.seller||'Not identified in this observation'}.</p>
  <p>Observed: {Number.isFinite(observed)?new Date(observed).toISOString():'Not supplied'}. Quote expiry: {offer.expiresAt||'Not supplied'}.</p>
  <p>Cabin: {offer.cabin||query?.cabin||'Not supplied'}. {query?.travelers?'Identified party; verify each traveler’s eligibility with the seller.':`Child ages: ${query?.childrenAges?.length?query.childrenAges.join(', '):'None supplied'}.`}</p>
  <p>{offer.bookingStatus||'Ticket issuance and final seller price have not been confirmed.'}</p>
  {offer.googleBookingMode==='phone'&&<p>Agent requirement: call {offer.seller||'the named airline'} for this quote; online seller totals may differ.</p>}
  {offer.googleBookingMode==='online'&&<p>Booking path: continue through Google booking options to {offer.seller||'the listed seller'}; checkout price and eligibility are not verified.</p>}
  {offer.splitTicket===true&&<p className="note">Expedia marks this itinerary as separate tickets for each traveler; connection and rebooking protections may differ. Confirm the details with Expedia.</p>}
  <p>{offer.fees||'Tax, baggage and ancillary inclusions not supplied.'}</p>
  {eligibility&&<section className="note" aria-label="Carrier child and youth guidance">
   <strong>Child/youth eligibility: {eligibility.status}.</strong>
   {eligibility.carriers?.length ? eligibility.carriers.map(carrier=><div key={carrier.code}>
    <p><strong>{carrier.name}:</strong> {carrier.message}</p>
    {carrier.sources.length>0&&<ul>{carrier.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>}
   </div>) : <p>{eligibility.message}</p>}
  </section>}
  {segments.length>0&&<ul>{segments.map((s,i)=><li key={i}>{s.marketing_carrier_code||s.marketingCarrier||'Carrier unavailable'} {s.flight_number||s.flightNumber||''} · {s.departure_airport||'Airport unavailable'} → {s.arrival_airport||'Airport unavailable'} · {s.departure_time_local||s.departure_time_utc||'Time unavailable'} → {s.arrival_time_local||s.arrival_time_utc||'Time unavailable'}</li>)}</ul>}
 </details>;
}
