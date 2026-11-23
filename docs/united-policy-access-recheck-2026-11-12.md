# United Airlines age-policy access recheck — 2026-11-12

## Result

No new United Airlines age, infant, youth, unaccompanied-minor, route, connection, or fee rule could be verified from accessible first-party policy text in this review. Do not add inferred United thresholds to the application. Keep United's carrier advisory limited to linking United's own customer pages and state that fare and itinerary eligibility remain unverified.

## First-party checks

- The [United traveling-with-children page](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html), [United unaccompanied-minors page](https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html), and [United Contract of Carriage](https://www.united.com/en/us/fly/contract-of-carriage.html) were opened through the available public page viewer. Each returned only the United Airlines page title and a message that JavaScript must be enabled; no policy terms were exposed.
- United's public [one-way booking page](https://www.united.com/en/us/book-flight/united-one-way) was readable and links to “Unaccompanied minors” and “Traveling with children.” It did not contain the rules behind those links.
- United's [Jetstream agent portal](https://jetstream.united.com/?lang=en_US) exposed a navigation label for “Unaccompanied Minors” under its booking/ticketing section but no underlying rule text. It is an agency portal, not the customer policy text; this review did not sign in, follow restricted workflow, or infer a rule from its menu.
- Search results also surfaced [United Vacations' flight FAQ](https://vacations.united.com/general/frequently-asked-questions/booking-flights/) and [United Vacations' package terms](https://vacations.united.com/general/terms/). These are separate tour-operator product documents. They were excluded from the United Airlines advisory and were not used to infer airline infant, child, youth, or UM policy.
- Search results mentioning minor ages on MileagePlus Travel, United Vacations, cruises, or other partner-supplied pages likewise do not establish United-operated-airline policy and were excluded.

## Implementation decision

The app may continue identifying United by observed operating/marketing carrier evidence and linking the two United customer policy pages. It must not map a supplied age to United's adult/child/youth fare class or assert that United will accept a lap infant, child, solo minor, connection, or partner itinerary from this evidence. Do not apply a UM fee or fare adjustment. The overall verdict must remain `unverified`, and users should confirm exact travelers, operated flights, seating and charges directly with United or the issuing seller.

## Reproduction and limits

Checked 2026-11-12 with the public web viewer. This is an access/result record, not proof that United has no applicable rules or that they are unavailable to customers. No CAPTCHA was bypassed, no account was created, and no restricted portal workflow was used. If United publishes machine-readable public customer policy text, or supplies authorized documentation that covers this app's use, recheck the exact rules and add only the supported advisory details.
