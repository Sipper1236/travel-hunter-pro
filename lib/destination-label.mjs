/** Short, user-facing provenance for a destination classification result. */
export function destinationMethodLabel(detection) {
  if (detection?.method === 'Versioned local geographic policy') return 'versioned local geographic policy';
  if (detection?.model === 'laya-local') return 'Wikidata checked by local Laya';
  if (detection?.model === 'starting') return 'Wikidata; local model starting';
  if (/^Three-letter code/i.test(detection?.method ?? '')) return 'IATA code; source will validate it';
  if (detection?.method === 'Selected by traveler') return 'type selected manually';
  if (/^Wikidata/i.test(detection?.method ?? '')) return 'Wikidata classification';
  return detection?.method || 'classification source unavailable';
}
