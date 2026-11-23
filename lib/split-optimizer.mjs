import { searchIgnav, itineraryKey as flightKey } from './ignav.mjs';
import {quoteFreshness} from './quote-freshness.mjs';
import {validateFilters,applyFlightFilters} from './flight-filters.mjs';
import {sourceFailure} from './source-errors.mjs';
import {ignavIdentityParty} from './travelers.mjs';

export const MAX_SPLIT_SEARCHES = 30;
const keyOf = (adults, children) => `${adults}:${children}`;
const cents=value=>{const n=Math.round(value*100);return Number.isFinite(value)&&Number.isSafeInteger(n)&&n>0&&Math.abs(value*100-n)<1e-6?n:null;};
function identity(offer,tripType){
  const outbound=flightKey({outbound:offer}),inbound=offer.inbound?flightKey({outbound:offer.inbound}):null;
  if(!outbound || (tripType==='round-trip'?!inbound:Boolean(offer.inbound)))return null;
  return inbound?JSON.stringify([outbound,inbound]):outbound;
}

function partyGroups(adults, children) {
  const groups = [];
  for (let a = 1; a <= adults; a++) for (let c = 0; c <= children && a + c <= adults + children; c++) groups.push({ adults: a, children: c });
  return groups;
}

function bestPartition(a, c, quotes, memo = new Map()) {
  if (a === 0 && c === 0) return { amount: 0, currency: null, tickets: [] };
  if (a === 0) return null; // Never propose a child-only ticket.
  const key = keyOf(a, c);
  if (memo.has(key)) return memo.get(key);
  let best = null;
  // The first remaining adult belongs to this group, removing duplicate orderings.
  for (let groupAdults = 1; groupAdults <= a; groupAdults++) {
    for (let groupChildren = 0; groupChildren <= c; groupChildren++) {
      const quote = quotes.get(keyOf(groupAdults, groupChildren));
      if (!quote) continue;
      const rest = bestPartition(a - groupAdults, c - groupChildren, quotes, memo);
      if (!rest || rest.currency && rest.currency !== quote.currency) continue;
      const amount = cents(quote.price) + rest.amount;
      if (Number.isSafeInteger(amount) && (!best || amount < best.amount)) best = { amount, currency: quote.currency, tickets: [{ adults: groupAdults, children: groupChildren, price: quote.price, currency: quote.currency, ignavId: quote.ignavId, provider: quote.provider, selfTransfer: quote.requiresSelfTransfer, observedAt:quote.observedAt, expiresAt:quote.expiresAt }, ...rest.tickets] };
    }
  }
  memo.set(key, best);
  return best;
}

/** Enumerates every adult-anchored passenger split for exact matching itineraries returned by Ignav. */
export async function optimizePassengerSplits(input, options = {}) {
  if (input?.travelers !== undefined) return optimizeIdentifiedSplits(input,options);
  const adults = input?.adults, children = input?.children ?? 0;
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 9) throw new Error('Enter 1–9 travelers with at least one adult; infants are not supported in this optimizer.');
  if(children > 0) throw Error('Split-party comparison for children and youths is unavailable until age and guardian rules can be validated.');
  const tripType=input.tripType ?? 'one-way';
  if(!['one-way','round-trip'].includes(tripType))throw Error('Choose one-way or round-trip.');
  const filters=validateFilters(input.filters);
  const groups = partyGroups(adults, children), maxSearches = Math.min(options.maxSearches ?? MAX_SPLIT_SEARCHES,MAX_SPLIT_SEARCHES);
  if (!Number.isInteger(maxSearches) || maxSearches < 1 || groups.length > maxSearches) return { plans: [], exhaustive: false, searches: [], limitation: `This party requires ${groups.length} fare searches, above the per-run cap of ${maxSearches}; no searches were sent.` };

  const searcher = options.searcher ?? searchIgnav;
  const coverage = [], byItinerary = new Map();
  options.onProgress?.({stage:'comparison_party_pricing',fareRequestsPlanned:groups.length});
  for (const party of groups) {
    let result;
    try { result = await searcher({ ...input, ...party }); }
    catch (error) {
      const failure=sourceFailure('Ignav',error);
      coverage.push({ ...party, ...failure });
      return { plans: [], exhaustive: false, searches: coverage, limitation: `Optimization stopped at a source error: ${failure.reason}${failure.retryAt?` Retry after ${failure.retryAt}.`:''} No complete comparison is claimed.` };
    }
    const status = result.sources?.find(x => x.provider === 'Ignav')?.status ?? 'error';
    coverage.push({ ...party, status, offers: result.offers.length });
    if (status !== 'ok') return { plans: [], exhaustive: false, searches: coverage, limitation: 'Optimization stopped because a party quote was not verified by the source.' };
    const filtered=await applyFlightFilters(result.offers.map(o=>({...o,via:o.segments?.slice(0,-1).map(s=>s.arrival_airport),...(o.inbound?{inbound:{...o.inbound,via:o.inbound.segments?.slice(0,-1).map(s=>s.arrival_airport)}}:{})})),{...filters,maxPrice:null},options.filterOptions);
    for (const offer of filtered.offers) {
      const key=identity(offer,tripType);
      if (!key || !offer.itineraryKey || cents(offer.price)===null || offer.currency !== 'CAD' || !offer.ignavId || quoteFreshness(offer).status!=='fresh') continue;
      const candidates = byItinerary.get(key) ?? new Map();
      const composition = keyOf(party.adults, party.children), previous = candidates.get(composition);
      if (!previous || offer.price < previous.price) candidates.set(composition, offer);
      byItinerary.set(key, candidates);
    }
  }

  const plans = [];
  for (const [itineraryKey, quoteMap] of byItinerary) {
    const quoteByParty = new Map([...quoteMap].filter(([,offer])=>quoteFreshness(offer).status==='fresh'));
    const plan = bestPartition(adults, children, quoteByParty);
    if (!plan) continue;
    const price=plan.amount/100;if(filters.maxPrice!==null&&price>filters.maxPrice)continue;
    const {amount,...details}=plan,reference=quoteMap.values().next().value;
    plans.push({ itineraryKey, ...details, price, tripType, observedAt:new Date(Math.min(...plan.tickets.map(o=>Date.parse(o.observedAt)))).toISOString(), expiresAt:new Date(Math.min(...plan.tickets.map(o=>quoteFreshness(o).usableUntil))).toISOString(), segments: reference.segments, inbound:reference.inbound ?? null, selfTransfer: plan.tickets.some(ticket => ticket.selfTransfer) });
  }
  plans.sort((a, b) => a.price - b.price);
  return {
    plans, exhaustive: true, searches: coverage,
    coverage: { partyCompositions: groups.length, candidateItineraries: byItinerary.size, matchedPlans: plans.length },
    limitation: 'Exhaustive only across adult booking splits and current exact itineraries returned by Ignav, including both directions for round trips. Independent quotes may overlap seat inventory; availability and mandatory extras remain unverified. It does not search every route or independently price flight segments. Each ticket needs its own fresh seller-link lookup; child and youth splits are unsupported.',
  };
}

/** Compare exact itineraries for traveler groups that retain every minor's guardian. */
async function optimizeIdentifiedSplits(input,options) {
  const full=ignavIdentityParty(input),people=full.people.map(({ages,...person})=>person),count=people.length,all=(1<<count)-1;
  const groups=[];
  for(let mask=1;mask<=all;mask++){
    const travelers=people.filter((_,index)=>mask&(1<<index));
    try {ignavIdentityParty({...input,travelers});groups.push({mask,travelers});} catch { /* A group without its required guardian cannot be booked here. */ }
  }
  const limit=Math.min(options.maxSearches ?? MAX_SPLIT_SEARCHES,MAX_SPLIT_SEARCHES);
  if(!Number.isInteger(limit)||limit<1||groups.length>limit)return {plans:[],exhaustive:false,searches:[],coverage:{partyCompositions:groups.length},limitation:`This party requires ${groups.length} fare searches, above the cap of ${limit}; no searches were sent.`};
  const filters=validateFilters(input.filters),byItinerary=new Map(),coverage=[];
  options.onProgress?.({stage:'comparison_party_pricing',fareRequestsPlanned:groups.length});
  for(const group of groups){
    let result;
    try{result=await (options.searcher ?? searchIgnav)({...input,travelers:group.travelers});}
    catch(error){const failure=sourceFailure('Ignav',error);coverage.push({travelerIds:group.travelers.map(p=>p.id),...failure});return {plans:[],exhaustive:false,searches:coverage,limitation:`Comparison stopped: ${failure.reason}. No complete comparison is claimed.`};}
    const status=result.sources?.find(source=>source.provider==='Ignav')?.status ?? 'error';
    coverage.push({travelerIds:group.travelers.map(p=>p.id),status,offers:result.offers.length});
    if(status!=='ok')return {plans:[],exhaustive:false,searches:coverage,limitation:'A party quote was unavailable; no complete comparison is claimed.'};
    const filtered=await applyFlightFilters(result.offers.map(o=>({...o,via:o.segments?.slice(0,-1).map(s=>s.arrival_airport),...(o.inbound?{inbound:{...o.inbound,via:o.inbound.segments?.slice(0,-1).map(s=>s.arrival_airport)}}:{})})),{...filters,maxPrice:null},options.filterOptions);
    for(const offer of filtered.offers){
      const key=identity(offer,input.tripType ?? 'one-way');
      if(!key||!offer.itineraryKey||cents(offer.price)===null||offer.currency!=='CAD'||!offer.ignavId||quoteFreshness(offer).status!=='fresh')continue;
      const quotes=byItinerary.get(key) ?? new Map(),old=quotes.get(group.mask);
      if(!old||offer.price<old.price)quotes.set(group.mask,{offer,travelerIds:group.travelers.map(p=>p.id)});
      byItinerary.set(key,quotes);
    }
  }
  const plans=[];
  for(const [itineraryKey,quotes] of byItinerary){
    const memo=new Map();
    function best(mask){
      if(mask===0)return {amount:0,tickets:[]};
      if(memo.has(mask))return memo.get(mask);
      let found=null;const first=mask&-mask;
      for(let sub=mask;sub;sub=(sub-1)&mask){
        if(!(sub&first))continue;
        const entry=quotes.get(sub);if(!entry||quoteFreshness(entry.offer).status!=='fresh')continue;
        const rest=best(mask^sub);if(!rest)continue;
        const amount=cents(entry.offer.price)+rest.amount;
        if(Number.isSafeInteger(amount)&&(!found||amount<found.amount))found={amount,tickets:[{travelerIds:entry.travelerIds,price:entry.offer.price,currency:'CAD',ignavId:entry.offer.ignavId,provider:entry.offer.provider,selfTransfer:entry.offer.requiresSelfTransfer,observedAt:entry.offer.observedAt,expiresAt:entry.offer.expiresAt},...rest.tickets]};
      }
      memo.set(mask,found);return found;
    }
    const plan=best(all);if(!plan||filters.maxPrice!==null&&plan.amount/100>filters.maxPrice)continue;
    const reference=quotes.values().next().value.offer;
    plans.push({itineraryKey,price:plan.amount/100,currency:'CAD',tickets:plan.tickets,tripType:input.tripType ?? 'one-way',observedAt:new Date(Math.min(...plan.tickets.map(t=>Date.parse(t.observedAt)))).toISOString(),expiresAt:new Date(Math.min(...plan.tickets.map(t=>quoteFreshness(t).usableUntil))).toISOString(),segments:reference.segments,inbound:reference.inbound ?? null,selfTransfer:plan.tickets.some(t=>t.selfTransfer)});
  }
  plans.sort((a,b)=>a.price-b.price);
  return {plans,exhaustive:true,searches:coverage,coverage:{partyCompositions:groups.length,candidateItineraries:byItinerary.size,matchedPlans:plans.length},limitation:'Only exact flights returned for the checked guardian-linked groups are compared. Carrier-specific eligibility, simultaneous inventory, baggage, fees and seller issuance are not verified. Confirm each traveler and booking with the seller.'};
}
