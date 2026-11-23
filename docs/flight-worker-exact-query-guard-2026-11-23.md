# Flight worker exact-query integrity — 2026-11-23

The durable flight-result validator now binds persisted and streamed results to the submitted party and filter envelope. Count-based results must retain adult/child counts and every actual child age. Identified-party results must retain each traveler ID, DOB, guardian assignment, and infant seating choice; count fields cannot replace an identified party. The validator also normalizes and compares the submitted filters, rejecting changed or unsupported fields.

Skyscanner's incomplete-search progress now carries the validated identified-party assignment in local result metadata. DOBs and identities remain out of the upstream API request. This lets the worker guard validate progressive results without weakening the provider payload privacy boundary.

Regression coverage proves acceptance of matching count and identified parties and rejection of changed/missing ages, DOBs, guardians, infant seating, or filters. It also checks that Skyscanner progress preserves the exact identified assignment while the mocked upstream request contains no traveler identity or DOB.

Verification on the current tree: focused flight-worker, Skyscanner, and location-streaming suites passed 30/30; full `npm test` passed **719/719**; `npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found **0 vulnerabilities**; Markdown links passed for 134 files. No live provider request was made. This closes only the flight query-envelope gap; strict schemas and source evidence for calendar, comparison, hotel, and package workers, plus live seller/eligibility evidence, remain open under `work.md` §16–17.
