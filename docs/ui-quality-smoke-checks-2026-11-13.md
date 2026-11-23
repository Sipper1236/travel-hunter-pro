# P13 UI quality smoke checks — 2026-11-13

## Current local evidence

All checks below used the loopback site and intercepted provider/job boundaries; no live travel search ran.

- `npm run check:accessible-controls`: 112 named controls, no unnamed controls, duplicate IDs or broken references; eight fieldsets, all with legends; one main landmark; keyboard disclosure passed; no browser errors.
- `npm run check:responsive-ui`: 320, 375 and 768 CSS-pixel viewports had no horizontal overflow. Light-theme preference persisted after reload. Provider traffic was blocked; no browser errors.
- `npm run check:theme-contrast`: 161 visible text samples per theme. Lowest sampled contrast was 5.27:1 in dark mode and 5.53:1 in light mode; no failures in its visible initial-search/representative-card scope.
- `npm run check:search-settings`: Matrix max-stop, price, duration, departure-window, sort, airline and airport-limit settings were preserved in the submitted query. One airline suggestion rendered; the provider request was intercepted. The job owner capability was sent and restored.
- `npm run check:flight-default`: passed on both the dev site (`:3000`) and isolated production build (`:3102`). Both showed one normal flight job, no automatic comparison, no reload re-enqueue, and comparison only after explicit selection. Browser/provider boundaries were intercepted; app CSP violations and page errors were zero. Next devtools emitted 33 inline-style policy events in dev only; production emitted zero. No policy relaxation was made.

## Check-harness correction

The initial default-flight run timed out because its nonce assertion included every HTML `<script>` element. Next dev injects a HMR client and an empty overlay shell without app nonces. After correcting that assertion, the browser check exposed 33 inline-style CSP events from Next's devtools bundle, not the app. The check now ignores only that identified devtools style event and empty/non-executable script shells, while preserving nonce requirements for executable application scripts and failing on other CSP violations. Production evidence still requires nonced app scripts and has zero policy violations.

## Remaining coverage

The skip-link addition and fresh current checks are documented in [the keyboard skip-link evidence](p13-keyboard-skip-link-2026-11-13.md). These are controlled Chromium smoke checks, not a WCAG conformance audit. They do not cover screen-reader output, full keyboard traversal of every dynamic control, browser zoom/reflow to 400%, reduced-motion behavior, touch targets, OS high-contrast modes, or physical mobile devices. P13 remains Partial until those applicable checks and any discovered fixes are completed.

## Production-site recheck — 2026-11-13 21:34 UTC

Against the current loopback production site, sequential reruns passed:

- `npm run check:accessible-controls`: 112 named controls; no unnamed controls, duplicate IDs or broken references; eight labeled fieldsets; keyboard disclosure and dynamic airline suggestion checks passed; 85 keyboard targets traversed; zero browser errors; external requests blocked; no search submitted.
- `npm run check:responsive-ui`: 320/375/768 widths, no horizontal overflow; light-theme preference restored after reload; provider traffic blocked; zero browser errors.
- `npm run check:theme-contrast`: 162 visible text samples for each theme; no failures; minimum sampled contrast 5.27:1 dark and 5.53:1 light; external requests blocked; zero browser errors.

This refreshed the smoke evidence only. Scope limitations above remain; no WCAG or assistive-technology conformance claim is made.
