'use client';
import {useState} from 'react';
import useSearchJob from './useSearchJob';
import ComparisonStatus from './ComparisonStatus';
import QuoteGuard from './QuoteGuard';
import BookingOptions from './BookingOptions';
import {comparisonStorageKey} from '../lib/comparison-query.mjs';
import {ageOnDate} from '../lib/travelers.mjs';

function travelerPartitionDetails(ticket,query){
  const people=query.travelers??[],ids=new Set(ticket.travelerIds??[]);
  const segmentDates=Array.isArray(ticket.segments)&&ticket.segments.length
    ?[...new Set(ticket.segments.map(segment=>{
      const local=segment?.departure_time_local;
      return typeof local==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(local)?local.slice(0,10):null;
    }))]
    :[];
  const datesKnown=segmentDates.length>0&&segmentDates.every(Boolean);
  return (ticket.travelerIds??[]).map(id=>{
    const index=people.findIndex(person=>person.id===id),person=people[index];
    if(!person)return `Traveler identity unavailable for this ticket.`;
    let ageLabels;
    try{ageLabels=datesKnown?segmentDates.map(date=>ageOnDate(person.birthDate,date)):[];}catch{ageLabels=[];}
    const ages=ageLabels.length===segmentDates.length&&datesKnown
      ?segmentDates.map((date,dateIndex)=>`age ${ageLabels[dateIndex]} on ticket date ${date}`).join(', ')
      :'age unavailable for this ticket’s departure dates';
    const guardianIndex=people.findIndex(candidate=>candidate.id===person.guardianId);
    const guardian=guardianIndex<0?'':` · guardian Traveler ${guardianIndex+1} ${ids.has(person.guardianId)?'on this ticket':'not on this ticket'}`;
    const dependants=people.flatMap((candidate,candidateIndex)=>candidate.guardianId===person.id&&ids.has(candidate.id)?[candidateIndex+1]:[]);
    const guardianFor=dependants.length?` · guardian for ${dependants.map(number=>`Traveler ${number}`).join(', ')}`:'';
    return `Traveler ${index+1} · ${ages}${guardian}${guardianFor}`;
  }).join(' · ');
}

export default function PartyComparison({query,disabled}){
  const [data,setData]=useState(null),[error,setError]=useState('');
  const input={...query,mode:'party'};
  const search=useSearchJob({acceptJob:job=>Boolean(job.input)&&comparisonStorageKey(job.input)===comparisonStorageKey(input),onComplete:setData,onError:body=>setError(body?.error || 'Comparison failed.'),onCancelled:()=>setError('Comparison cancelled.')},{kind:'comparison',storageKey:input.travelers?'travel-hunter-identified-comparison':comparisonStorageKey(input)});
  async function compare(){setData(null);setError('');await search.start(input);}
  return <>
    <button type="button" disabled={disabled||search.busy} onClick={compare}>{search.busy?'Comparing party splits…':'Compare split-party tickets'}</button>
    <ComparisonStatus search={search}/>{error&&<p role="alert">{error}</p>}
    {data&&<div className="coverage"><strong>{data.plans.length?'Lowest same-flight booking plans':'No complete same-flight booking plan was priced'}</strong><p>{data.limitation}</p>
      {input.travelers&&<p className="note">Ages below use each ticket segment’s local departure date and the supplied birth dates. Carrier age categories, fare eligibility, and seller acceptance are not verified.</p>}
      <p className="note">{data.coverage.fareRequestsStarted} fare requests started; {data.coverage.responsesReused} saved responses reused. Request budget: {data.coverage.requestBudget}. Interrupted requests count toward the budget; transport retries and seller lookups are additional.</p>
      {data.plans.slice(0,5).map((plan,i)=><QuoteGuard offer={plan} key={plan.itineraryKey}><article className="offer"><div>
        <strong>Plan {i+1} · {plan.tickets.length} booking{plan.tickets.length===1?'':'s'}</strong>
        <p>{plan.segments[0].departure_airport} → {plan.segments.at(-1).arrival_airport}{plan.inbound?` · Return: ${plan.inbound.segments[0].departure_airport} → ${plan.inbound.segments.at(-1).arrival_airport}`:''}</p>
        <p>{plan.selfTransfer?'Includes a self-transfer; verify baggage and connection risk.':'Same exact flights across all tickets.'}</p>
        {plan.tickets.map((ticket,j)=><div key={j}><p>{ticket.travelerIds?`Travelers ${ticket.travelerIds.map(id=>query.travelers.findIndex(person=>person.id===id)+1).filter(index=>index>0).join(', ')}`:`${ticket.adults} adult${ticket.adults===1?'':'s'}`} · {ticket.currency} {ticket.price}</p>{ticket.travelerIds&&<p className="note">{travelerPartitionDetails(ticket,query)}</p>}<BookingOptions ignavId={ticket.ignavId} ownerToken={search.job?.ownerToken}/></div>)}
      </div><div className="price"><strong>{plan.currency} {plan.price}</strong><small>separate booking totals</small></div></article></QuoteGuard>)}
    </div>}
  </>;
}
