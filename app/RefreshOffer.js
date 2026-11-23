'use client';
import { useState } from 'react';

export default function RefreshOffer({ offer, query }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!['Skyscanner', 'Air Canada NDC'].includes(offer.provider)&&!(offer.provider==='Google Flights'&&offer.googleFlightSelection)&&!(offer.provider==='Expedia'&&offer.expediaFlightSelection)) return null;
  async function refresh() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/search/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        tripType: query.tripType ?? (offer.inbound?'round-trip':'one-way'),returnDate:query.returnDate ?? offer.inbound?.departureDate,requireTimeEvidence:offer.timeEvidence?.status==='directory_validated',
        provider: offer.provider, origin: query.origin, destination: query.destination, date: query.date,
        ...(query.travelers?{travelers:query.travelers}:{adults:query.adults,children:query.children,childrenAges:query.childrenAges}), cabin: offer.cabin, currency: offer.currency,
        sessionToken: offer.skyscannerSessionToken, itineraryId: offer.skyscannerItineraryId,
        airCanadaOffer: offer.airCanadaOffer,
        googleSelection:offer.googleFlightSelection,googleBookingUrl:offer.sourceUrl,filters:query.filters,
        expediaSelection:offer.expediaFlightSelection,
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Provider price refresh failed.');
      setResult(body);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const refreshed = result?.offers?.[0];
  return <div className="booking-options"><button type="button" disabled={busy} onClick={refresh}>{busy ? 'Refreshing…' : result ? 'Refresh provider price again' : 'Refresh provider price'}</button>{error && <p role="alert">{error}</p>}{result?.price != null && <p>OfferPrice: {result.currency} {result.price} · {result.status}</p>}{['Google Flights','Expedia'].includes(offer.provider)&&result&&result.offers?.length===0&&<p role="status">No current quote for the same flights was found. No replacement itinerary is shown.</p>}{refreshed && <p>Refreshed: {refreshed.currency} {refreshed.price} · seller handoff not verified</p>}{result?.limitation && <p className="note">{result.limitation}</p>}</div>;
}
