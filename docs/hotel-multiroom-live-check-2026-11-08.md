# Hotel multi-room live check — 2026-11-08

## Scope

A single read-only search was submitted through the local Flight + Hotel page to check the existing Booking.com multi-room path with a Canada-verified Montréal destination, 2027-03-18 to 2027-03-21, two rooms, two adults (ages 37 and 39), and one child age 7 assigned to the first room. No account, reservation, checkout or purchase action was taken.

## Observed result

- Destination resolution required an explicit choice because “Montréal” matched multiple locations. The UI choice `Montreal — largest city in Quebec, Canada` resolved to Wikidata `Q340`, country `CA`.
- The job reached the Booking.com search worker and returned a partial result: room 1 of 2 was attempted, but zero room searches returned an observation, zero offers were accepted, and no common property was available. The result correctly showed no combined offer.
- The stored result reported the room as unavailable but omitted the provider failure detail. Code inspection found that `combinedBookingRooms` dropped each room's `error` while indexing results. This live record cannot recover the exact Booking.com failure, so its cause remains unknown.
- No CAPTCHA/challenge state was reported. No price, availability, fee, or seller checkout was verified.

## One-room follow-up diagnostic

After the first multi-room result and before adding timeout diagnostics, a second read-only local job searched the same verified Montréal destination/stay and the first room's exact occupancy as one room (one adult age 37, one child age 7). It remained at `searching_hotels` for the five-minute Booking.com browser cap, then returned `Search timed out. The provider may require an unsupported challenge or have no visible results.` The job reported no challenge frame, zero offers, and no provider page details. This shows the failure is not limited to combining separate rooms, but does not prove why the provider page stalled. No challenge was interacted with and no further query was sent.

## Change and verification

`lib/hotel-search.mjs` now carries each room error through aggregation and reports a reason for unavailable rooms. Coverage separates attempts, completed observations, and failures; the final limitation no longer treats an attempt as a completed observation. `lib/browser-jobs.mjs` now stops immediately on HTTP 403/429 and returns bounded timeout metadata: status, title, host/path, visible property-card count and recognized challenge markers. It never includes the query string or stores page text/captures. `tests/hotel-search.test.mjs` covers later-room and first-room failures, safe diagnostics, and immediate 429 stop. Focused hotel tests passed 15/15; final `npm test -- --test-concurrency=2` passed 500/500 (171.2s), `npm run build` passed, and `npm audit --audit-level=low` found zero vulnerabilities. Controlled `check:hotel-occupancy`, `check:hotel-room-handoff` and `check:local-stack` passed with provider requests intercepted, zero browser errors, HTTP 200, an available worker, zero queue depth, graceful shutdown and zero provider searches.

The live search was performed before this reporting fix, so repeating it immediately would spend another provider request without identifying the first failure. Future bounded searches should use the repaired source diagnostics. Multi-room availability, room-category equivalence, taxes/mandatory charges, comparable checkout totals and seller verification remain open under P4 and `work.md` §17.

## Occupancy evidence refinement — 2026-11-08

Booking.com browser cards now retain explicit count evidence: visible result text must match adult count and nights, plus child and room counts where requested. The extractor marks individual ages as **not echoed**; exact ages displayed on result cards are labeled as the search inputs. A multi-room total is withheld if any room lacks the guest-count match. Focused regressions passed, and the rebuilt occupancy browser check passed with provider requests intercepted and zero browser errors. No further live hotel request was made. This refinement does not verify age-specific rates or simultaneous room inventory.

A follow-up trust check also suppresses Booking.com child-party Flight + Hotel subtotals unless exact ages are echoed by the provider; this visible listing path currently does not provide that evidence. The hotel observation remains displayed with the requested ages clearly labeled, and the user can recheck them on Booking.com. Adult-only Flight + Hotel room totals remain eligible when every room’s visible guest counts match. The adult-only multi-room comparison path now accepts the actual adult ages entered in the hotel form when the flight search itself carries only an adult count. Focused tests passed 31/31, full suite 502/502, build passed, audit zero vulnerabilities, and the intercepted rendered occupancy check passed; no live query occurred.
