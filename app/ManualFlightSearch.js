'use client';
import {useState} from 'react';
import {calendarDatePairs} from '../lib/calendar-query.mjs';
import {googleManualUrl,manualFlightChecklist} from '../lib/manual-flight-search.mjs';

export default function ManualFlightSearch({query}){
 const [origin,setOrigin]=useState(''),[destination,setDestination]=useState(''),[dateKey,setDateKey]=useState('');
 const pairs=calendarDatePairs(query),pair=pairs.find(pair=>`${pair.date}/${pair.returnDate??''}`===dateKey);
 let checklist='',error='';
 if(origin&&destination&&pair)try{checklist=manualFlightChecklist(query,{origin,destination,...pair});}catch(problem){error=problem.message;}
 return <details className="manual-flight-search"><summary>Check this trip manually in Google Flights</summary>
  <p className="note">Choose an exact route and date combination to create a checklist. Google’s automated adapter cannot price this trip shape or party in every case. This manual check provides no verified quote or calendar coverage.</p>
  <label>Manual departure airport<input value={origin} maxLength={3} placeholder="Three-letter code" onChange={event=>setOrigin(event.target.value.toUpperCase())}/></label>
  <label>Manual arrival airport<input value={destination} maxLength={3} placeholder="Three-letter code" onChange={event=>setDestination(event.target.value.toUpperCase())}/></label>
  <p className="note">{query.origin} → {query.destination}. {query.originAirports?.length?`Departure candidates: ${query.originAirports.join(', ')}. `:''}{query.destinationAirports?.length?`Arrival candidates: ${query.destinationAirports.join(', ')}. `:''}For a region, choose a specific airport in that region.</p>
  <label>Manual date combination<select aria-label="Manual date combination" value={dateKey} onChange={event=>setDateKey(event.target.value)}><option value="">Choose dates</option>{pairs.map(pair=><option key={`${pair.date}/${pair.returnDate??''}`} value={`${pair.date}/${pair.returnDate??''}`}>{pair.date}{pair.returnDate?` → ${pair.returnDate}`:''}</option>)}</select></label>
  {error&&<p role="alert">{error}</p>}
  {checklist&&<><label>Exact trip checklist<textarea aria-label="Exact trip checklist" readOnly rows={12} value={checklist}/></label><a href={googleManualUrl} target="_blank" rel="noreferrer">Open Google Flights for manual entry ↗</a><p className="note">The link sends no traveler details. Keep this checklist open while entering your trip.</p></>}
 </details>;
}
