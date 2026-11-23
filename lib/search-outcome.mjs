export function emptySearchOutcome(result) {
  if (result.offers?.length) return null;
  const sources = [...(result.sources ?? []), ...(result.coverage?.checked ?? []).flatMap(check => check.sources ?? [])];
  const has = (...statuses) => sources.some(source => statuses.includes(source.status));
  if (result.coverage && !result.coverage.checked?.length) return {code:'no_airports',title:'No airport routes were searched.',message:'The geographic lookup did not resolve candidate airports for this search. Review the region coverage above or select an airport.'};
  if (has('blocked','auth','access_denied')) return {code:'access_denied',title:'A source could not grant access.',message:'Review the source status above. Access failures do not establish that no flights are available.'};
  if (has('rate','rate_limited')) return {code:'rate_limited',title:'A source reached its request limit.',message:'Wait before starting another search. No automatic repeat search was submitted.'};
  if (sources.length && sources.every(source => source.status === 'unconfigured')) return {code:'unconfigured',title:'No live flight source is configured.',message:'Configure an available source on the server before searching. No prices were retrieved.'};
  if (sources.length && sources.every(source => source.status === 'unconfigured' || source.status?.startsWith('unsupported_'))) return {code:'unsupported',title:'Configured sources do not support this search.',message:'Review the party, cabin and trip restrictions reported above, or configure a source that supports them.'};
  if (has('invalid_response') || sources.some(source => source.status === 'ok' && source.received > 0 && source.accepted === 0)) return {code:'rejected',title:'Returned fares could not be verified for this search.',message:'Incomplete or mismatched observations were excluded. Review the source validation details above.'};
  if (has('ok')) return {code:'no_matching_offers',title:'No usable fares matched this search.',message:'The sources returned no matching observations after validation and filters. This is limited source coverage; other flights may be available.'};
  return {code:'unavailable',title:'Live flight sources are unavailable.',message:'Review the source errors above and try again when the source is available. No prices were substituted.'};
}
