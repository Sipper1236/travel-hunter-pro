'use client';
import {useEffect,useState} from 'react';
import BookingOptions from './BookingOptions';
import QuoteGuard from './QuoteGuard';
import ComparisonStatus from './ComparisonStatus';
import useSearchJob from './useSearchJob';
import {buildRoutePairCandidates,comparisonStorageKey} from '../lib/comparison-query.mjs';

function routeCoverageText(coverage){
  const parts=[coverage.matchingAlternatives===0?'No matching alternative itinerary was found in the returned responses.':`Showing ${coverage.alternativesShown} of ${coverage.matchingAlternatives} matching fresh CAD itineraries.`];
  if(coverage.scope==='bounded_resolved_airport_pairs'){
    const pairs=(items=[])=>items.map(pair=>`${pair.origin}–${pair.destination}`).join(', ');
    parts.push(`${coverage.alternateAirportPairsSearched} of ${coverage.alternateAirportPairsPlanned} additional resolved airport pairs returned responses without a provider stop${coverage.alternateAirportPairsSearchedList?.length?` (${pairs(coverage.alternateAirportPairsSearchedList)})`:''}.`);
    if(coverage.alternateAirportPairsAttempted>coverage.alternateAirportPairsSearched&&coverage.alternateAirportPairsAttemptedList?.length)parts.push(`Requests were attempted for ${coverage.alternateAirportPairsAttempted} pairs${pairs(coverage.alternateAirportPairsAttemptedList)?` (${pairs(coverage.alternateAirportPairsAttemptedList)})`:''}.`);
    if(coverage.alternateAirportPairsStoppedList?.length)parts.push(`The provider stopped or deferred these pair requests: ${pairs(coverage.alternateAirportPairsStoppedList)}.`);
  }
  else parts.push('Candidates came from the selected exact airport pair.');
  if(coverage.omittedMatchingAlternatives)parts.push(`${coverage.omittedMatchingAlternatives} matching itineraries were omitted by the ${coverage.displayLimit}-route display limit.`);
  parts.push(coverage.providerCompletionKnown?(coverage.providerReportedComplete?'Every provider response was marked complete.':'At least one provider response was incomplete; additional itineraries may exist.'):'Provider response completeness is unknown.');
  if(coverage.alternateAirportPairsNotSearched?.length)parts.push(`Airport pairs not searched: ${coverage.alternateAirportPairsNotSearched.map(pair=>`${pair.origin}–${pair.destination}`).join(', ')}.`);
  else if(coverage.scope==='bounded_resolved_airport_pairs'&&!coverage.alternateAirportPairsStoppedList?.length)parts.push('All additional pairs in the selected airport sets returned responses without a provider stop.');
  else if(coverage.scope!=='bounded_resolved_airport_pairs')parts.push('No alternate airport pairs were selected for this comparison.');
  parts.push('This is not exhaustive route coverage.');
  return parts.join(' ');
}

export default function SeparateTickets({offer,query,locationResolution}){
  const [selectedOffer,setSelectedOffer]=useState(offer),[alternatives,setAlternatives]=useState([]);
  useEffect(()=>{setSelectedOffer(offer);setAlternatives([]);},[offer.itineraryKey]);
  const roundTrip=query.tripType==='round-trip',lengths=[selectedOffer.segments?.length ?? 0,...(roundTrip?[selectedOffer.inbound?.segments?.length ?? 0]:[])];
  if(offer.provider!=='Ignav'||!query.travelers&&query.children>0||lengths.some(n=>n<(roundTrip?1:2)||n>4)||offer.requiresSelfTransfer)return null;
  const origin=selectedOffer.segments[0].departure_airport,destination=selectedOffer.segments.at(-1).arrival_airport;
  const origins=locationResolution?.origin?.airports?.map(airport=>airport.code).filter(code=>/^[A-Z]{3}$/.test(code))??[],destinations=locationResolution?.destination?.airports?.map(airport=>airport.code).filter(code=>/^[A-Z]{3}$/.test(code))??[];
  const routeCandidates=buildRoutePairCandidates(origins,destinations,{origin,destination});
  const scope={...query,origin,destination,routePairs:routeCandidates.pairs,mode:'segments',itineraryKey:selectedOffer.itineraryKey};
  return <Comparison key={comparisonStorageKey(scope)} scope={scope} lengths={lengths} roundTrip={roundTrip} selectedOffer={selectedOffer} alternatives={alternatives} omittedCandidatePairs={routeCandidates.omittedCandidatePairs} candidatePairs={routeCandidates.candidatePairs} onAlternatives={setAlternatives} onSelectRoute={route=>{setAlternatives(previous=>[route,...previous.filter(item=>item.itineraryKey!==route.itineraryKey)]);setSelectedOffer({...offer,itineraryKey:route.itineraryKey,segments:route.outbound.segments,...(route.inbound?{inbound:{segments:route.inbound.segments}}:{inbound:undefined})});}}/>;
}

function Comparison({scope,lengths,roundTrip,selectedOffer,alternatives,omittedCandidatePairs,candidatePairs,onAlternatives,onSelectRoute}){
  const identified=Boolean(scope.travelers);
  const [contiguousGroups,setContiguousGroups]=useState(false),[splitPassengers,setSplitPassengers]=useState(false),[searchLimit,setSearchLimit]=useState(100),[routeSearchLimit,setRouteSearchLimit]=useState(8);
  const [minConnectionMinutes,setMinConnectionMinutes]=useState(180);
  const [data,setData]=useState(null),[error,setError]=useState('');
  const search=useSearchJob({acceptJob:job=>Boolean(job.input)&&comparisonStorageKey(job.input)===comparisonStorageKey(scope),onComplete:result=>{setData(result);onAlternatives(result.routeAlternatives??[]);},onError:body=>setError(body?.error || 'Comparison failed.'),onCancelled:()=>setError('Comparison cancelled.')},{kind:'comparison',storageKey:comparisonStorageKey(scope)});
  useEffect(()=>{if(search.job?.input){setContiguousGroups(search.job.input.contiguousGroups);setSplitPassengers(search.job.input.splitPassengers);setSearchLimit(search.job.input.searchLimit);setRouteSearchLimit(search.job.input.routeSearchLimit??8);setMinConnectionMinutes(search.job.input.minConnectionMinutes);}},[search.job?.id,search.job?.input?.searchLimit,search.job?.input?.routeSearchLimit,search.job?.input?.contiguousGroups,search.job?.input?.splitPassengers,search.job?.input?.minConnectionMinutes]);
  const groupCount=identified?(splitPassengers?(2**scope.travelers.length)-1:1):(splitPassengers?scope.adults:1);
  const alternatePairs=scope.routePairs.filter(pair=>pair.origin!==scope.origin||pair.destination!==scope.destination),routePairSearches=Math.min(routeSearchLimit,alternatePairs.length);
  const upper=1+routePairSearches+lengths.reduce((sum,n)=>sum+(contiguousGroups?n*(n+1)/2-(roundTrip?0:1):n+(roundTrip&&n>1?1:0)),0)*groupCount;
  async function compare(){setError('');setData(null);await search.start({...scope,splitPassengers,contiguousGroups,searchLimit,routeSearchLimit,minConnectionMinutes});}
  const segmentLabel=segment=>`${segment.marketing_carrier_code} ${segment.flight_number} ${segment.departure_airport} ${segment.departure_time_utc} → ${segment.arrival_airport} ${segment.arrival_time_utc}`;
  return <div className="booking-options">
    <p className="note">Itinerary selected for refresh: {selectedOffer.segments.map(segmentLabel).join(' · ')}{selectedOffer.inbound?.segments?.length?` · Return: ${selectedOffer.inbound.segments.map(segmentLabel).join(' · ')}`:''}</p>
    <label className="note"><input type="checkbox" disabled={search.busy} checked={contiguousGroups} onChange={e=>setContiguousGroups(e.target.checked)}/> Compare contiguous ticket groupings</label>
    <label className="note"><input type="checkbox" disabled={search.busy} checked={splitPassengers} onChange={e=>setSplitPassengers(e.target.checked)}/> {identified?'Compare guardian-linked traveler booking groups on each segment':'Compare adult booking splits on each segment'}</label>
    <label className="note">Fare request budget<select disabled={search.busy} value={searchLimit} onChange={e=>setSearchLimit(Number(e.target.value))}>{[25,50,100,200].map(n=><option key={n} value={n}>{n} requests</option>)}</select></label>
    <label className="note">Alternate airport pairs<select disabled={search.busy} value={routeSearchLimit} onChange={e=>setRouteSearchLimit(Number(e.target.value))}>{[0,4,8,12,20].map(n=><option key={n} value={n}>{n} pairs</option>)}</select></label>
    <label className="note">Self-transfer buffer (minutes)<input type="number" min="180" max="1440" disabled={search.busy} value={minConnectionMinutes} onChange={e=>setMinConnectionMinutes(Number(e.target.value))}/></label>
    <button type="button" disabled={search.busy} onClick={compare}>{search.busy?'Comparing…':'Compare separate segment tickets'}</button>
    <p className="note">{`Up to ${upper} Ignav fare searches before recovery or quote refresh; budget ${searchLimit}.`} {routePairSearches?`Up to ${routePairSearches} additional pairs from the resolved airport sets may be refreshed within that budget; the request budget can reduce this count. `:''}{omittedCandidatePairs?`${candidatePairs} exact airport-pair candidates were ranked; ${omittedCandidatePairs} beyond the 400-pair request cap were omitted before search. `:''}{`A ${minConnectionMinutes}-minute self-transfer buffer and your layover limits apply.`} {roundTrip?'Includes separately quoted outbound and return tickets; the destination stay is not a connection.':''}</p>
    <ComparisonStatus search={search}/>{error&&<p role="alert">{error}</p>}
    {data&&<><p className="note">{data.limitation}</p>
      <p className="note">{data.coverage.fareRequestsStarted} fare requests started; {data.coverage.responsesReused} saved responses reused. Interrupted requests and refreshed stale quotes count toward the budget; transport retries and seller lookups are additional.</p>
      {data.status==='budget_exceeded'&&<p className="note">This comparison requires {data.coverage.estimatedSearches} fare requests; your budget is {data.coverage.searchLimit}.</p>}
      {data.coverage.uniqueTicketBlocks!==undefined&&<p className="note">{data.coverage.pricedTicketBlocks}/{data.coverage.uniqueTicketBlocks} ticket blocks priced · {data.coverage.completePlans}/{data.coverage.eligibleTicketPartitions} eligible ticket groupings priced. Coverage is limited to these observed flights.</p>}
      {data.ticketBlockCoverage?.length>0&&<details className="coverage"><summary>Ticket block coverage ({data.ticketBlockCoverage.filter(block=>block.status==='priced').length} priced, {data.ticketBlockCoverage.filter(block=>block.status==='partial').length} partial, {data.ticketBlockCoverage.filter(block=>block.status==='unpriced').length} unpriced, {data.ticketBlockCoverage.filter(block=>block.status==='not_searched').length} not searched)</summary><ul>{data.ticketBlockCoverage.map((block,index)=><li key={`${block.direction}-${block.segmentStart}-${block.segmentEnd}-${index}`}><strong>{block.direction==='inbound'?'Return':'Outbound'} · segment{block.segmentStart===block.segmentEnd?'':'s'} {block.segmentStart}{block.segmentEnd!==block.segmentStart?`–${block.segmentEnd}`:''}: {block.status.replaceAll('_',' ')}</strong><span className="muted"> — {block.exactFlights.map(flight=>`${flight.carrier} ${flight.flight} ${flight.from}–${flight.to}`).join(' · ')}; {block.fareRequests} fare request{block.fareRequests===1?'':'s'}, {block.qualifyingQuotes} qualifying fresh exact-flight quote{block.qualifyingQuotes===1?'':'s'}.{block.responses.flatMap(response=>response.sources).map((source,i)=><span key={i}> {source.provider}: {source.status}{source.received!==undefined?` (${source.accepted??0}/${source.received})`:''};</span>)}</span></li>)}</ul><p className="note">A block is priced only when a fresh CAD quote matched every observed flight, cabin, chronology and requested traveler group. Missing quotes are not evidence that the flight is unavailable for sale; a not-searched block had no fare request dispatched.</p></details>}
      {data.routeAlternativeCoverage&&<section className="coverage"><strong>Route alternative coverage</strong><p>{routeCoverageText(data.routeAlternativeCoverage)}</p>{alternatives.map(route=><QuoteGuard key={`${route.outbound.from}-${route.outbound.to}-${route.itineraryKey}`} offer={route}><div><p>CAD {route.price} · observed {new Date(route.observedAt).toLocaleString()} · outbound: {route.outbound.segments.map(segmentLabel).join(' · ')}{route.inbound?` · return: ${route.inbound.segments.map(segmentLabel).join(' · ')}`:''}</p><button type="button" disabled={search.busy} onClick={()=>onSelectRoute(route)}>Select this itinerary for comparison</button></div></QuoteGuard>)}</section>}
      {data.plans.map((plan,i)=><QuoteGuard key={i} offer={plan}><div>
        <p>Refreshed itinerary CAD {data.baseline.price}; separate fares CAD {plan.price}; difference before extras CAD {plan.differenceBeforeExtras}.</p>
        <p>{plan.connectionsMinutes?.length?`Self-transfer connections: ${plan.connectionsMinutes.join(', ')} minutes.`:'No self-transfer boundary within either direction.'}</p>
        {plan.comparison==='no_lower_price'&&<p>No lower observed price before extras.</p>}
        {plan.tickets.map((ticket,j)=><div key={j}><p>{ticket.direction==='inbound'?'Return':'Outbound'} · {ticket.travelerIds?`Travelers ${ticket.travelerIds.join(', ')}`:`${ticket.adults} adult${ticket.adults===1?'':'s'}`} · {ticket.cabin?.replaceAll('_',' ')} · {ticket.currency} {ticket.price}</p><p className="muted">Verified flight block: {ticket.segments.map(segmentLabel).join(' · ')}</p><BookingOptions ignavId={ticket.ignavId} ownerToken={search.job?.ownerToken} matchLabel="Selected ticket block"/></div>)}
      </div></QuoteGuard>)}
    </>}
  </div>;
}
