# Regional airport-pair coverage bounds — 2026-11-13 22:34 UTC

## Change

The region-pair search previously formed outside-limit pairs from only the first airport beyond each resolver's 100-airport list, even though the result separately carried more omitted airport codes. It could therefore undercount known unsearched airport combinations.

The search now deduplicates all resolver-returned airport codes from both `airports` and `uncheckedAirports`, computes the exact valid Cartesian-pair count while excluding same-airport pairs, and subtracts the selected pair set. It enumerates the omitted pair objects only when there are at most 1,000. Larger sets retain the exact count, code-set sizes, selected-pair count, and the Cartesian-product rule; the per-side coverage already carries each returned airport code. This prevents result size from growing quadratically. If a resolver reports that more candidates may exist, the result preserves that caveat.

The pair coverage UI displays the exact grouped count, known origin/destination airport counts, total valid pairs, selected pairs, and the rule needed to reconstruct every omitted pair from the listed code sets. It says when the resolver may have more candidates beyond those codes.

## Verification

- Regression with 40 origin and 40 destination airports: 1,600 known pairs, 16 selected, exactly 1,584 omitted, no large pair-object expansion, and all 36 omitted codes shown for each side.
- `node --test tests/search.test.mjs`: **16/16 passed**.
- Full `npm test`: **555/555 passed**.
- `TRAVEL_NEXT_DIST_DIR=.next-region-pair-coverage-build npm run build`: passed after the final UI change.
- `npm audit --audit-level=low`: **0 vulnerabilities** (no dependency changes followed this audit).
- Production Chromium `TRAVEL_CHECK_URL=http://127.0.0.1:3001 npm run check:region-coverage`: passed with provider calls intercepted; confirmed the 1,584 count, 40×40 basis, airport boundary/popularity disclosures, and omitted airport lists.

## Limits

The exact calculation covers only airport identities returned by the resolver. Directory, M49, country, or upstream query caps may hide candidates; the output marks that possibility. Pairs intentionally excluded from the selected search budget are not fare observations and say nothing about availability or prices.
