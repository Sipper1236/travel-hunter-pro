export default function LocationResolution({resolution}) {
  if (!resolution) return null;
  return Object.entries(resolution).filter(([,scope])=>scope.kind==='city').map(([side,scope])=><div className="coverage" key={side}><strong>{side==='origin'?'Origin city':'Destination city'}: {scope.region.name}</strong><p>{scope.airports.map(airport=>`${airport.code} — ${airport.name}`).join('; ')}</p><p>{scope.method} <a href={scope.region.url} target="_blank" rel="noreferrer">City evidence ↗</a></p></div>);
}
