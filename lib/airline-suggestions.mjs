import { quoteFreshness } from './quote-freshness.mjs';

/** Build suggestions only from fresh, explicitly coded carriers in observed itineraries. */
export function buildAirlineSuggestions(offers, { now = Date.now() } = {}) {
  const carriers = new Map();
  for (const offer of Array.isArray(offers) ? offers : []) {
    if (quoteFreshness(offer, now).status !== 'fresh') continue;
    const segments = [
      ...(Array.isArray(offer.segments) ? offer.segments : []),
      ...(Array.isArray(offer.inbound?.segments) ? offer.inbound.segments : []),
    ];
    const codesInItinerary = new Set();
    for (const segment of segments) {
      const code = segment?.marketing_carrier_code || segment?.carrierCode || segment?.airline;
      if (typeof code !== 'string' || !/^[A-Z0-9]{2}$/.test(code)) continue;
      codesInItinerary.add(code);
      const entry = carriers.get(code) ?? { names: new Set(), offerCount: 0 };
      const name = segment?.marketing_carrier_name;
      if (typeof name === 'string' && name.trim()) entry.names.add(name.trim());
      carriers.set(code, entry);
    }
    for (const code of codesInItinerary) carriers.get(code).offerCount++;
  }
  return [...carriers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, entry]) => ({
      code,
      name: entry.names.size === 1 ? [...entry.names][0] : code,
      offerCount: entry.offerCount,
    }));
}
