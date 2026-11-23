export default function RegionCoverage({coverage}) {
  if (!coverage) return null;
  const regionLink = region => region?.region?.url ? <a href={region.region.url} target="_blank" rel="noreferrer">{region.region.name} ↗</a> : region?.region?.name;
  const sourceStatus = sources => (sources ?? []).map(source => `${source.provider || 'Source'} ${source.operation || 'search'}: ${source.status}${source.reason ? ` (${source.reason})` : ''}${source.retryAt ? ` · retry after ${source.retryAt}` : ''}`).join(' · ');
  const cacheNote = region => region?.cache?.savedAt && ` · data ${region.cache.status === 'stale' ? 'from expired cache' : region.cache.status === 'hit' ? 'from cache' : 'freshly retrieved'} at ${new Date(region.cache.savedAt).toLocaleString()}`;
  const excludedCandidates = region => (region?.excludedAirports?.length > 0 || region?.popularityExclusionShortfall > 0) && <><p>Intentionally excluded from search (highest recorded passenger traffic, up to {region.popularityExclusionLimit ?? 3}): {region.excludedAirports?.length ? region.excludedAirports.map(airport=>airport.code).join(', ') : 'none; no passenger-ranked candidates were available'}.</p>{region.popularityExclusionShortfall > 0 && <p>Only {region.excludedAirports?.length ?? 0} of {region.popularityExclusionLimit ?? 3} requested airports had recorded passenger traffic. Airports with unknown popularity were retained and were not excluded based on alphabetical order.</p>}</>;
  const airportGeography = region => (region?.geographicExcludedAirportCount > 0 || region?.geographyUnknownAirportCount > 0) && <details><summary>Airport boundary omissions: {region.geographicExcludedAirportCount ?? 0} outside the boundary, {region.geographyUnknownAirportCount ?? 0} without usable coordinates</summary>{region?.geographicExcludedAirports?.length > 0 && <p>Known outside-boundary airports (up to 100): {region.geographicExcludedAirports.map(airport=>airport.code).join(', ')}.</p>}{region?.geographyUnknownAirports?.length > 0 && <p>Known airports without usable coordinates (up to 100): {region.geographyUnknownAirports.map(airport=>airport.code).join(', ')}.</p>}</details>;
  const countryCoverage = region => <>
    {region?.region?.policyVersion && <p>Geographic scope policy: {region.region.policyVersion}.</p>}
    {region?.region?.description && <p>{region.region.description}.</p>}
    {region?.region?.policyNote && <p>Scope note: {region.region.policyNote}</p>}
    {region?.region?.policySourceUrl && <p>Policy membership source: <a href={region.region.policySourceUrl} target="_blank" rel="noreferrer">official source ↗</a></p>}
    {region?.countries?.length > 0 && <p>{region.countriesScope ?? 'Countries considered'} (up to {region.countryLimit ?? region.countries.length}): {region.countries.map(country=>country.iso?`${country.name} (${country.iso})`:country.name).join(', ')}.</p>}
    {region?.countriesUnchecked?.length > 0 && <p>Known country candidates beyond the resolver limit: {region.countriesUnchecked.map(country=>country.iso?`${country.name} (${country.iso})`:country.name).join(', ')}.</p>}
    {region?.countriesUnresolved?.length > 0 && <p>Country/area records without a matching country lookup: {region.countriesUnresolved.map(country=>`${country.name} (${country.iso ?? 'no ISO code'})`).join(', ')}.</p>}
    {region?.countriesMoreAvailable && <p>The country resolver cap was reached; additional country candidates may be omitted.</p>}
    {airportGeography(region)}
  </>;
  if (coverage.side === 'both') return <div className="coverage">
    <strong>Location pair search: {regionLink(coverage.origin)} → {regionLink(coverage.destination)}</strong>
    <p>{coverage.partial?`Provider responses have arrived for ${coverage.pairsChecked} of ${coverage.pairsPlanned} planned airport pairs; other sources and pairs are still pending.`:`${coverage.pairsChecked} of ${coverage.pairsPlanned} planned airport pairs searched.`} Up to {coverage.airportLimit} candidate airports per location; coverage is not comprehensive.</p>
    <p>{coverage.origin.method} {cacheNote(coverage.origin)}. {coverage.destination.method} {cacheNote(coverage.destination)}</p>
    {countryCoverage(coverage.origin)}{excludedCandidates(coverage.origin)}{countryCoverage(coverage.destination)}{excludedCandidates(coverage.destination)}
    {coverage.origin.moreAvailable || coverage.destination.moreAvailable ? <p>Additional airports were found beyond the selected limit.</p> : null}
    {coverage.checked.length === 0 ? <p>No airport pairs were searched.</p> : coverage.checked.map((pair, i) => <p key={i}><strong>{pair.origin.code} → {pair.destination.code}</strong> — {pair.offers} fares; {sourceStatus(pair.sources)}</p>)}
    {coverage.uncheckedPairs?.length > 0 && <p>Planned pairs not searched: {coverage.uncheckedPairs.map(pair=>`${pair.origin.code} → ${pair.destination.code}`).join('; ')}.</p>}
    {coverage.uncheckedAirportPairs?.length > 0 && <details><summary>{coverage.uncheckedAirportPairs.length} known airport pairs outside the selected limits</summary><p>{coverage.uncheckedAirportPairs.map(pair=>`${pair.origin.code} → ${pair.destination.code}`).join('; ')}.</p></details>}
    {coverage.outsideSelectedPairCoverage?.outsideSelectedPairs > coverage.uncheckedAirportPairs?.length && <details><summary>{coverage.outsideSelectedPairCoverage.outsideSelectedPairs.toLocaleString('en-CA')} known airport pairs outside the selected limits</summary><p>{coverage.outsideSelectedPairCoverage.representation}</p><p>Exact count among {coverage.outsideSelectedPairCoverage.knownOriginAirportCount.toLocaleString('en-CA')} known origin airports and {coverage.outsideSelectedPairCoverage.knownDestinationAirportCount.toLocaleString('en-CA')} known destination airports: {coverage.outsideSelectedPairCoverage.knownAirportPairs.toLocaleString('en-CA')} valid candidate pairs, including {coverage.outsideSelectedPairCoverage.selectedAirportPairs.toLocaleString('en-CA')} selected pairs.</p><p>Known airport codes outside the selected limits are listed by origin and destination below. The code sets and the rule above identify each omitted pair without expanding a potentially very large Cartesian product.</p>{coverage.outsideSelectedPairCoverage.resolverMayHaveMore && <p>The resolver indicates that additional airport candidates may exist beyond these reported codes.</p>}</details>}
    {['origin','destination'].map(side=>coverage[side].uncheckedAirports?.length > 0 && <p key={side}>Additional {side} airports not selected: {coverage[side].uncheckedAirports.map(a=>a.code).join(', ')}.</p>)}
    {coverage.stoppedBySource ? <p>Search stopped early after a provider block, rate limit, authorization failure, or temporary outage.</p> : null}
  </div>;
  return <div className="coverage">
    <strong>{coverage.side === 'origin' ? 'Origin region' : 'Destination region'}: {regionLink(coverage)}</strong>
    <p>{coverage.method}</p>
    {countryCoverage(coverage)}
    {excludedCandidates(coverage)}
    {coverage.cache?.savedAt ? <p>Region data {coverage.cache.status === 'stale' ? 'from expired cache; live lookup failed' : coverage.cache.status === 'hit' ? 'from cache' : 'freshly retrieved'} · {new Date(coverage.cache.savedAt).toLocaleString()}</p> : null}
    <p>Up to {coverage.airportLimit} airports selected from the reported geographic policy and airport directories; this is not a comprehensive search. {coverage.moreAvailable ? 'Additional airports were found but not searched.' : 'The source directories may omit airports.'}</p>
    {coverage.checked.length === 0 ? <p>No airports were resolved for this region.</p> : coverage.checked.map((check, i) => <p key={i}><strong>{check.airport.code}</strong> — {check.airport.name}, {check.airport.country}: {check.offers} fares; {sourceStatus(check.sources)}</p>)}
    {coverage.uncheckedAirports?.length > 0 && <p>Resolved airports not searched: {coverage.uncheckedAirports.map(airport=>airport.code).join(', ')}.</p>}
  </div>;
}
