# Air Canada Vacations live package check — 2026-11-12 23:01 UTC

## Query and evidence path

A search was submitted through the local website and its real package worker, using the current public Air Canada Vacations widget:

- Halifax Stanfield (YHZ) to Barcelona, Spain (BCN)
- April 15–25, 2027
- One adult and one child age 7, assigned to one room
- Four-star minimum, up to two stops per direction, 20-result cap
- Canadian-dollar provider context verified by the adapter

The exact provider suggestion `Barcelona, Spain · CITY` was selected. The worker completed the widget search and inspected all 20 cards and their flight panels. The persisted job reports 20 received, 19 supported offers, one rejected card, no filter or stop rejections, and more listings beyond the selected result limit. The visible package offers included hotel names, observed CAD totals, star ratings, meal plan, cancellation text and flight summaries. Example provider observations ranged from CAD 3,235.54 (Exe Barbera Parc) to CAD 5,890.92 (H10 Art Gallery); these are dated examples, not a recommendation or current fare.

## Interpretation and limitations

Each result is an **observed estimated package total**, not a seller-refreshed checkout quote or completed booking. The cards stated taxes and fees included, but the app correctly retains the limitation that local charges may apply. Exact property addresses, room equivalence, provider acceptance of the child fare, live inventory continuity, mandatory-charge completeness and final checkout amount were not verified. At least one listing remained beyond the 20-card cap. Flight-panel inspection is evidence that panels were opened, not independent verification of ticketability or simultaneous inventory.

The status was persisted as `complete` with result status `observed`. This means the bounded widget workflow finished; it does not mean supplier availability or booking is confirmed. A temporary inline evidence collector used after the search raised a script error because it treated the DOM `innerText` property as a function. The completed job and normalized results were then read from the local database in read-only mode. This was a mistake in that one-off collector, not in the application or a checked-in browser test. No CAPTCHA challenge was solved or bypassed, no account was created, and no checkout, reservation or purchase occurred.

After the search, the rebuilt-loopback `check:package-infant-guidance` browser check passed with zero provider calls, confirming the form still enforces its one-room child boundary. A subsequent same-origin `POST /api/health` at 2026-11-12 23:13 UTC returned `ok`, one live worker, queue depth zero and no expired leases/deadlines; the earlier GET probe that timed out was not the proper browser-compatible health request.

## Coverage decision

This is new real, website-to-worker evidence for a one-room child package. It does not close work.md §17 P6: multi-room children/infants remain unsupported by the live widget; address, occupancy acceptance, full charges, checkout refresh, result pagination and broader destination/party coverage remain open. See the current adapter and UI constraints in `lib/vacation-search.mjs`, `lib/vacation-query.mjs`, and `app/VacationSearch.js`.
