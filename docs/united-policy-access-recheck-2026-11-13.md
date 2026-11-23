# United Airlines child-policy access recheck — 2026-11-13 21:35 UTC

## Result

No current United Airlines child, infant, youth, unaccompanied-minor, connection, or fare rule was verified. The app must continue linking the official customer pages while marking eligibility `unverified`; do not infer ages, fare classes, infant acceptance, solo-travel rules, fees, or partner-flight eligibility.

## Checks

- The public web viewer opened [United traveling with children](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html) and [United unaccompanied minors](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html). Both exposed only a JavaScript-required shell, not policy text.
- One normal headless Chromium GET attempt per page failed with `net::ERR_HTTP2_PROTOCOL_ERROR` before DOM content loaded. No challenge was presented, no workaround/retry was attempted, and no account or traveler information was used.
- Official United search results did not expose machine-readable airline rules. United Vacations, MileagePlus Travel, third-party summaries, and agent-only content were excluded because they do not establish the current United Airlines public booking policy needed here.

## Implementation consequence

`lib/carrier-eligibility.mjs` retains the United advisory with official links and an `unverified` status. The policy-access blocker persists. Recheck only if United supplies accessible public policy text or authorized documentation that applies to the exact airline use case. No fare search, booking, or purchase occurred.

## 2026-11-14 17:39 UTC recheck

Reopened the two official customer pages through the public reader. [Traveling with children](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html) and [unaccompanied minors](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html) still returned only the JavaScript-required shell. An official-domain search surfaced the ordinary booking page and links to those two pages, but no readable current age, infant, solo-travel, connection, fee or fare rules. Search results for United Vacations and United Cruises were excluded because those are not United Airlines passenger-policy evidence. The advisory remains `unverified`; no workaround, challenge bypass, account or traveler data was used.
