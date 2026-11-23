export default function CityChoices({choices,selected,onChoose}) {
  if (!choices) return null;
  return <fieldset className="coverage"><legend>Choose {choices.side==='origin'?'origin':'destination'} city for “{choices.value}”</legend><p>These cities have verified Wikidata location claims. Choose one, then run the search again.</p>{choices.items.map(city=><div key={city.id}><button type="button" aria-pressed={selected?.id===city.id} onClick={()=>onChoose(choices.side,city)}>{city.label} — {city.description || city.id}{selected?.id===city.id?' · selected':''}</button> <a href={city.url} target="_blank" rel="noreferrer">City evidence ↗</a></div>)}</fieldset>;
}
