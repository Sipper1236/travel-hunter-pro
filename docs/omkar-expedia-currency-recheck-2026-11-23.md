# Expedia via Omkar currency and timestamp evidence — 2026-11-23

## Request and result

One read-only YHZ–LAX economy, one-adult, one-way request for 2026-12-17 used the existing Omkar adapter and its durable source policy. The wrapper returned HTTP 200 with 85 flight records and 273 fare options. The normalizer accepted no itinerary offers and emitted no price observations.

A bounded schema-only inspection emitted aggregate counts and booleans only; no response body, traveler/flight/fare names, IDs, prices, or credential values were logged. Across the returned fare options, zero had an uppercase three-letter currency value in the inspected currency metadata fields, zero had an uppercase three-letter prefix in the inspected display fields, and zero had a CAD prefix. Of 223 inspected segment timestamp pairs, zero carried explicit UTC offsets. The adapter therefore cannot establish CAD currency or an absolute segment chronology from this response. No amount, local-time zone, or currency was inferred from destination, locale, or a dollar symbol.

## Adapter diagnostics

The Omkar normalizer now reports sanitized rejection counters for missing currency evidence, conflicting currency claims, non-CAD currency, and invalid amounts, while retaining the aggregate `unverifiedPrice` count. These diagnostics allow a future schema change to distinguish a missing currency contract from malformed pricing without retaining provider payload values. The adapter still requires explicit CAD evidence and offset-aware segment timestamps before emitting the corresponding price or itinerary evidence.

## Verification and limits

- `tests/omkar-expedia.test.mjs`: **12/12 passed** after the diagnostics change.
- Full `npm test`: **661/661 passed**; `npm run build` passed after retrying Next.js 16.4.3's security reminder.
- The most recent `npm audit --audit-level=low` still reports one moderate advisory in Next.js 16.4.3; the suggested 16.4.6 fix is outside the declared dependency range.
- The fixtures cover each currency-rejection category and preserve existing price-only behavior when itinerary timestamps are missing.
- No subsequent live request was made after adding the diagnostic fields; the recorded 2026-12-17 response was inspected only through the bounded aggregate collector.
- The wrapper is not a verified Expedia partner endpoint. Expedia Travel Redirect credentials remain absent, wrapper terms/scope are still open, and no seller availability or booking status was checked.

This is one query-shape observation, not proof that all returned dates or all wrapper responses share the same schema. The adapter remains unable to display this result as CAD. See also [the earlier duration probe and recheck](omkar-expedia-live-duration-2026-11-09.md).
