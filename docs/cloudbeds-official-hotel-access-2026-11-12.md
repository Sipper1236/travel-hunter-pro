# Cloudbeds official-hotel access check — 2026-11-12

## Finding

Cloudbeds offers a guest-facing Booking Engine URL that accepts documented stay dates, currency, and adult/child counts. Its support documentation says that these values influence displayed room availability and occupancy-based pricing. The public URL is a usable handoff for a traveler, but the docs do not establish a third-party right to poll that engine as multi-property inventory, nor do they document child-age parameters, arbitrary room allocations, seller confirmation, or a reusable rate API for this application.

Cloudbeds' documented PMS API uses an integration client and requires a property user to authorize the app and grant API scopes. Technology partners need Cloudbeds partner approval and credentials. Property and group API access is provisioned by the property account; availability can depend on the property's subscription. No Cloudbeds partner account, property authorization, API credentials, or rate/occupancy contract is configured here.

## Bounded public-page observation

On 2026-11-12, one read-only HTTP GET was made to the publicly linked Cloudbeds guest engine for Black Forest Cabins in Mahone Bay, Nova Scotia, with sample dates and two adults. It returned HTTP 200 HTML and public property metadata. No form, button, room selection, checkout, or reservation action was taken. This property was discovered through public information; the observation does not establish the required four-star classification, exact child-age handling, available room inventory, a current price, or permission for automated repeated searches.

No inventory API, undocumented internal endpoint, or automated room-pricing collector was added. Reservit remains the only configured official-hotel booking-engine adapter. A public direct-booking link may be exposed as a handoff after property identity and destination are validated, but it must not be represented as a priced inventory result.

## Gate to implementation

Proceed with Cloudbeds inventory only after Cloudbeds grants partner access or a property supplies explicit app authorization, applicable API scopes, and a documented permitted comparison/search use. Obtain the required client credentials outside source control. Confirm API/engine semantics for exact dates, adult/child counts and ages, multiple rooms, CAD, taxes/fees, cancellation conditions, and rate freshness. Then test with a real authorized property and read-only availability/pricing calls; do not call reservation or payment operations.

## Primary references

- [Cloudbeds API authentication for technology partners](https://developers.cloudbeds.com/v1.2/docs/api-keys-authentication-guide-for-technology-partners) — partner client, property consent and scoped authorization.
- [Cloudbeds partner onboarding](https://developers.cloudbeds.com/v1.2/reference/ota-build-to-us-getting-started) — partnership review and credentialing steps.
- [Cloudbeds property and group API access](https://developers.cloudbeds.com/docs/property-and-group-account-api-access) — property-level authorization, account access and availability conditions.
- [Cloudbeds guest booking URL parameters](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/52705769630747-Booking-Engine-Plus-filters-FAQ) — documented public date, guest, currency and filter parameters.
- [Cloudbeds adult/child occupancy behavior](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/41908793951643-Cloudbeds-Booking-Engine-Plus-filters-and-guest-stepper-behavior) — adult and child counts can affect occupancy/pricing; a total-guest count may not.
- [Cloudbeds special booking links](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115004684433-How-to-redirect-your-guests-to-a-particular-room-type-and-or-rate-plan-in-Cloudbeds-PMS) — room-type, date, adult and child parameters, but no documented child-age parameter in this guide.

This is an access and capability finding, not live hotel availability evidence. P10 and the §17 hotel criteria remain partial.
