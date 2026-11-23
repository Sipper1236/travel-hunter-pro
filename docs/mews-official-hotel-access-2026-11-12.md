# Mews official-hotel access check — 2026-11-12

## Decision

Do not add a Mews production inventory adapter without a property-authorized integration path. The current application is a server-side multi-property comparison service; the public Mews Booking Engine API is not an anonymous public-rate endpoint and is not suitable for this server polling pattern.

## Current vendor requirements

- Mews' Booking Engine API supports property/date availability and pricing, but each request identifies a registered client. Mews requires the production client to be pre-registered with Mews Support; access is authorized for a known hotel/enterprise. Its custom Booking Engine API option is limited to Enterprise customers. The current operation list includes read-only availability/pricing calls and separate reservation-creation operations; this project would use only the former if an authorized integration were established.
- Mews says the Booking Engine API is designed for direct front-end clients and is unsuitable for continuous polling from one server because anti-scraping controls can reject those requests. The supported server-to-server Connector API is a separate product requiring a client token and a property-issued access token; live production onboarding includes certification and property connection.
- A public property link/widget proves only that a guest can use that property's booking flow. It does not grant this app permission to poll the property, reuse the widget's configuration, or query other Mews properties. The previously reviewed South Thompson Inn site also limited use to personal, non-commercial purposes.

## Required gate before implementation

Obtain written property authorization and Mews-approved production client registration or an applicable certified server-to-server integration, plus property-specific access/configuration, documented search rate limits, and permission for this comparison use. Then test exact stay dates, room allocations, child ages, currency, taxes/fees, current availability, cancellation/rate conditions, and direct seller handoff using read-only availability operations. Never call reservation-creation operations.

Until those conditions exist, Mews remains excluded from inventory. Reservit remains the only configured official-hotel booking-engine adapter. No Mews endpoint was called in this review and no synthetic rates were added.

## Primary vendor references

- [Mews: Ways to integrate with the Booking Engine](https://docs.mews.com/booking-engine-guide/faq/ways-to-integrate) — standalone, guest widget, and Enterprise-only custom API options.
- [Mews: Booking Engine API authentication](https://docs.mews.com/booking-engine-guide/booking-engine-api/guidelines/authentication) — pre-registering the client and authorization for a hotel/enterprise.
- [Mews: Booking Engine API usage guidelines](https://docs.mews.com/booking-engine-guide/booking-engine-api/guidelines) — front-end use and warning against continuous single-server polling.
- [Mews: Booking Engine API operations](https://docs.mews.com/booking-engine-guide/booking-engine-api/operations) — read-only availability and pricing versus reservation operations.
- [Mews: Connector API authentication](https://docs.mews.com/connector-api/guidelines/authentication) — property-specific production access tokens and certification.
