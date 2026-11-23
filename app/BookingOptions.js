'use client';

import {useState} from 'react';

function freshnessLabel(status){
 if(status==='fresh')return 'fresh';
 if(status==='stale')return 'stale';
 if(status==='future')return 'timestamp is ahead of the application clock';
 return 'not established';
}

export default function BookingOptions({ignavId,ownerToken,matchLabel='Original search itinerary'}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/search/booking-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ignavId,ownerToken})});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Booking-link lookup failed.');
   setData(body);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 const priceEvidence=data?.linkedPriceEvidenceStatus==='provider_reported_verified'?'provider-reported verified status; seller checkout not verified':data?.linkedPriceEvidenceStatus==='provider_reported_unverified'?'provider-reported unverified status':'no linked price supplied';
 return <div className="booking-options">
  <button type="button" disabled={busy} onClick={load}>{busy?'Loading provider handoff…':data?'Refresh provider handoff links':'Load provider handoff links'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<p>Seller handoff: linked price evidence has {priceEvidence}. Linked price freshness: {freshnessLabel(data.linkedPriceFreshnessStatus)}. Seller availability: not checked. Booking status: not booked; this app has not reserved or purchased anything.</p>}
  {data&&<p>Provider response timestamp: {data.observedAt||'not supplied'}; response freshness: {freshnessLabel(data.providerResponseFreshnessStatus)}. This timestamp applies to the handoff response, not an individual seller link price.</p>}
  {data&&<p>{matchLabel} match: {data.itineraryMatch}. {data.itineraryMatch==='matched'?'The provider-returned flights and cabin match the stored selection.':data.itineraryMatch==='mismatch'?'The flights or cabin differ; seller links were suppressed.':'The flight or cabin comparison could not be completed; seller links were suppressed.'}</p>}
  {data&&<p>Provider-reported itinerary coverage: {data.coverageStatus}{data.expectedCoverage.length?` · covered ${data.coveredCoverage.join(', ')||'none'} of ${data.expectedCoverage.join(', ')}`:' · expected legs could not be established from the response'}. This describes Ignav’s returned purchase plan, not seller availability.</p>}
  {data?.itinerary?.price&&<p>Ignav itinerary price: {data.itinerary.price.currency} {data.itinerary.price.amount} (provider status: {data.itinerary.price.status}; may be the earlier search quote)</p>}
  {data&&<p>Baggage counts: {data.baggage?`Ignav reports carry-on ${data.baggage.carryOn??'not supplied'}, checked ${data.baggage.checked??'not supplied'}`:'not supplied by Ignav'}. Provider-reported counts do not establish the seller’s current allowance or fees.</p>}
  {data&&<p>Mandatory charges: not itemized in this response; confirm the final total with the seller.</p>}
  {data?.bookingOptions.map((option,i)=><div key={i}>
   <p>Option {i+1} covers: {option.legs.length?option.legs.join(' and '):option.legIndexes.length?option.legIndexes.map(index=>`leg ${index+1}`).join(' and '):'coverage not supplied'}</p>
   {option.links.map((link,j)=><p key={j}><a href={link.url} target="_blank" rel="noreferrer">{link.provider} ({link.host}) ↗</a>{link.price?` · ${link.price.currency} ${link.price.amount} for this option (provider status: ${link.price.status}; freshness not established)`:' · price not supplied'} · {link.specificity==='exact_flight'?'Link intended to select the flight':link.specificity==='search_results'?'Link opens search results':'Link selection behavior unknown'}</p>)}
  </div>)}
  {data&&<p className="note">{data.limitation}</p>}
 </div>;
}
