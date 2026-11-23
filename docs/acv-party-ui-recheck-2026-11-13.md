# Air Canada Vacations party-form recheck — 2026-11-13 22:01 UTC

Ran `npm run check:package-infant-guidance` against the current rebuilt loopback site. The controlled Chromium flow verified provider-selected city/airport handling and child/infant party entry, derived infant ages in the browser, and asserted DOBs were not sent to the package worker. All supplier calls were intercepted (0 provider calls); the controlled test made 4 local job calls. Browser output reported `dobSent:false`, `providerCalls:0`, and `jobCalls:4`.

The form and worker continue to restrict child/infant package parties to one room. This matches the previously observed Air Canada Vacations widget behavior: with two rooms selected, its child control was disabled; with one room, child selection worked. Do not bypass that product constraint or combine separate package reservations into a synthetic multi-room total. [Prior live widget evidence](../work.md#p6-live-occupancy-recheck--2026-11-09-0004-utc).

This recheck proves local UI/request behavior only. It did not submit a live package search and does not verify current supplier occupancy acceptance, availability, property address, all fees, checkout totals, or seller price. P6 remains Partial.

## 2026-11-14 17:44 UTC live widget recheck

Re-ran `node scripts/probe-vacation-occupancy-limits.mjs` against the public Air Canada Vacations Flight + Hotel widget. The widget retained two rooms, disabled the child-add control at two rooms, then re-enabled it after returning to one room. It accepted the previously supplied actual age 7 in that one-room state. The script did not submit a search or open checkout. This current live check confirms the app's one-room child guard for this specific package widget; generic per-room fields visible in other page content are not proof that this live package widget permits child multi-room occupancy. Keep that combination unsupported and do not split or synthesize separate packages. [Current package result evidence](acv-live-package-refresh-2026-11-14-1719.md). P6 remains Partial pending a provider-authorized package flow that actually supports the required room-party shape and seller-confirmed totals.
