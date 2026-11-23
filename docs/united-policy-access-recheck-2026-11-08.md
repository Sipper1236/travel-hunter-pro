# United child-travel policy access recheck — 2026-11-08

**Checked:** 2026-11-08 22:52 UTC  
**Scope:** Current United Airlines (UA) child, infant, and unaccompanied-minor rules for a Canadian-origin application. Read-only public-page inspection only.

## Follow-up check — 2026-11-09 00:53 UTC

The official [United children page](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html) and [United unaccompanied-minors page](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html) were opened again through the current public-page viewer. Each exposed only a JavaScript-disabled shell, with no policy details. Official search results returned material for United Vacations, which is a separate package product and cannot establish United Airlines ticket rules. No age bands, infant terms, charges, itinerary restrictions, or codeshare rules can be safely added. The implementation remains linked to United's official pages and continues to state `unverified`.

## Official sources checked

- [United Airlines: traveling with children](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html)
- [United Airlines: unaccompanied minors](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html)
- [United Airlines: contract of carriage](https://www.united.com/en/us/fly/contract-of-carriage.html)

The current page viewer returned only United's JavaScript-required shell for both child-travel and unaccompanied-minor pages. The contract-of-carriage page did not expose a usable current rule in this inspection. No detailed United airline age band, infant threshold, fare category, fee, connection rule, or codeshare acceptance rule could be verified from the accessible official page content.

## Scope exclusions

Search results also exposed United Vacations pages describing a separate package product and third-party summaries of airline policy. Neither is treated as a United Airlines policy source. In particular, a United Vacations child selector or package limitation cannot establish airline ticket eligibility, and third-party summaries cannot replace the inaccessible airline rule.

## Implementation consequence

No United age or eligibility rule should be added to `lib/carrier-eligibility.mjs` from this recheck. Keep the current source-linked advisory and `unverified` eligibility state. The official source-access blocker is unchanged; confirm exact age, flight, operating carrier, fare, seating, and charges with United before representing a traveler as eligible. No CAPTCHA or sign-in flow was accessed, no traveler data was submitted, and no booking was made.
