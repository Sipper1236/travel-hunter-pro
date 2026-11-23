import QuoteGuard from './QuoteGuard';

export default function MatrixPriceObservationCard({item}){
 return <QuoteGuard offer={item}><article className="offer matrix-observation">
  <div><span className="route">{item.origin} <span>→</span> {item.destination}</span><p>{item.departureDate}{item.returnDate?` – ${item.returnDate}`:' · one-way'}</p><p className="matrix-warning">{item.provider} price only · itinerary and filter compliance unverified</p><p className="muted">{item.travelers} · {item.cabin} · {item.details}</p><p className="muted">Observed {new Date(item.observedAt).toLocaleString()} · seller availability not confirmed</p></div>
  <div className="price"><strong>{new Intl.NumberFormat('en-CA',{style:'currency',currency:item.currency}).format(item.price)}</strong><small>{item.currency??'Currency unavailable'} · {item.priceScope??'Provider-reported total'}</small>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.linkLabel??`Open ${item.provider} search`} ↗</a>}</div>
 </article></QuoteGuard>;
}
