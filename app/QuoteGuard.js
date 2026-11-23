'use client';
import {useEffect,useState} from 'react';
import {quoteFreshness} from '../lib/quote-freshness.mjs';

export default function QuoteGuard({offer,children}) {
  const [now,setNow] = useState(null);
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),15000);return ()=>clearInterval(timer);},[]);
  const freshness = now === null ? null : quoteFreshness(offer,now);
  if (freshness && freshness.status !== 'fresh') return <div className="notice" role="status">{freshness.reason} Run a new search to check this price again.</div>;
  return children;
}
