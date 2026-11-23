import {quoteFreshness} from './quote-freshness.mjs';

const historicalQuery={origin:'YHZ',destination:'LAX',date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',adults:1,children:0,childrenAges:[],cabin:'economy'};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

/** Match an exact read-only seller-check target without accepting unknown party fields. */
export function isExactIgnavSellerQuery(query,expected=historicalQuery){
 if(!query||!expected||!['one-way','round-trip'].includes(expected.tripType)||! /^[A-Z]{3}$/.test(expected.origin)||! /^[A-Z]{3}$/.test(expected.destination)||expected.origin===expected.destination||!validDate(expected.date))return false;
 if(expected.tripType==='round-trip'&&(!validDate(expected.returnDate)||expected.returnDate<expected.date))return false;
 return query.origin===expected.origin&&query.destination===expected.destination&&query.date===expected.date&&query.tripType===expected.tripType&&query.adults===1&&query.children===0&&Array.isArray(query.childrenAges)&&query.childrenAges.length===0&&!Object.hasOwn(query,'travelers')&&query.cabin==='economy'&&(expected.tripType!=='round-trip'||query.returnDate===expected.returnDate);
}

/** Choose a recent, usable CAD Ignav offer before a read-only seller handoff. */
export function lowestFreshIgnavOffer(result,now=Date.now()){
 return result?.offers?.filter(offer=>{
  const cents=Math.round(offer?.price*100);
  return offer?.provider==='Ignav'&&offer.currency==='CAD'&&typeof offer.ignavId==='string'&&offer.ignavId.length>0&&Number.isSafeInteger(cents)&&cents>0&&Math.abs(offer.price*100-cents)<1e-6&&quoteFreshness(offer,now).status==='fresh';
 }).sort((a,b)=>a.price-b.price)[0]??null;
}
