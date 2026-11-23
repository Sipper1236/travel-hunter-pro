# Frontend accessibility and implementation audit — 2026-11-14

## Scope and method

Code-level audit began against `.next-p12-archive-fd`; after the initial findings, the palette-token change was built in `.next-p13-theme-tokens` and rechecked at `http://127.0.0.1:3000`. Chromium checks blocked requests outside the loopback application; no search was submitted and no provider traffic was sent. This is a controlled browser audit, not a full WCAG conformance assessment, screen-reader test, or real-device study.

Commands/checks run:

- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:accessible-controls`
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:theme-contrast`
- `TRAVEL_CHECK_URL=http://127.0.0.1:3000 npm run check:responsive-ui`
- Additional loopback-only Playwright checks for initial-page control target dimensions and production resource transfer sizes.
- Follow-up: `TRAVEL_NEXT_DIST_DIR=.next-p13-theme-tokens npm run build` and fresh-build reruns of the three browser checks above.
- Follow-up: `TRAVEL_API_ANYTHING_HOME=/tmp/travel-hunter-pro-travel-api-anything-test-full API_ANYTHING_HOME=/tmp/travel-hunter-pro-api-anything-test-full npm test`.
- Follow-up: `npm audit --audit-level=low`.
- `impeccable detect --json app/page.js app/globals.css app/AdvancedFilters.js app/FareCalendar.js app/HotelSearch.js app/VacationSearch.js app/MemberOffers.js`

The detector exited with its single `overused-font` warning at `app/globals.css:1` for Arial. This is a low-impact false positive for a system-level body font: product display headings use Georgia, and the warning alone does not show interchangeable product identity or design drift.

## Audit Health Score

The initial audit scored 14/20 before palette migration. After the implementation and fresh-build recheck, current scores are:

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 3/4 | Current control, keyboard, and sampled contrast checks pass; assistive-technology and dynamic-state coverage is incomplete. |
| 2 | Performance | 3/4 | The local production page loaded without browser errors; observed JavaScript transfer was about 192 KB compressed, but this is a single-machine smoke measurement. |
| 3 | Responsive Design | 3/4 | No horizontal overflow at 320/375/768px or under enlarged text; all 66 sampled initial-page targets meet 44px at 320px. |
| 4 | Theming | 3/4 | Core dark/light colors now use 48 defined semantic CSS variables; some one-off state colors remain literal. |
| 5 | Implementation Integrity | 3/4 | The product has coherent travel-specific controls and disclosures; the detector's only warning is isolated and not a confirmed product mismatch. |
| **Total** | | **15/20 — Good** | Expand device/assistive-technology validation. |

## Implementation Integrity Verdict

**Pass, with a remaining maintainability gap.** The application consistently presents travel search, source coverage, fare freshness, traveler assignment, and booking handoff concepts. The interface uses reusable controls and dedicated components, and current browser checks confirm a keyboard-operable advanced-settings disclosure and live airline suggestions. The detector found only the Arial warning; it did not establish repeated design-system drift or generic placeholder content. The most-used dark/light palette is centralized in semantic CSS variables; a few isolated status and decorative colors remain literal.

## Executive Summary

- Audit Health Score after the theme change: **15/20 (Good)**.
- Verified issue counts after the follow-up: **P0 0 / P1 0 / P2 0 / P3 0**. The two issues found in the initial audit were addressed; the Arial detector warning was assessed as a false positive.
- Remaining work is evidence coverage, not a verified control failure: test screen-reader behavior and dynamic result states on physical devices.

## Detailed Findings by Severity

No verified P0–P3 product defects remain in the audited initial-page states after the implementation follow-up. The outstanding assistive-technology and physical-device coverage is listed below as a limit on the evidence, not an observed failure.

## Patterns and Systemic Issues

- Some one-off status and decorative colors still use literal values; the main surfaces, text, borders, and accents use shared dark/light palette variables.
- Compact controls are now at least 44px in the measured initial-page 320px state; dynamic result controls still need device-level remeasurement.

## Positive Findings

- The accessible-controls check counted 113 named controls, with zero unnamed controls, duplicate IDs, or broken label/reference links. It found 8 fieldsets, no missing legends, one main landmark, keyboard-operable disclosure behavior, working dynamic airline suggestions, 85 keyboard targets traversed, and zero browser errors.
- The fresh-build contrast check measured 164 visible text nodes in each theme; the minimum sampled ratio was 5.27:1 dark and 5.53:1 light, above WCAG AA's 4.5:1 normal-text threshold. It also confirmed page, text, surface, and accent variables resolve and switch by theme.
- Responsive checks passed at 320, 375, and 768px with no horizontal overflow. The page also reflowed at 200% text size with WCAG text spacing, restored the light theme after reload, and kept external traffic blocked. The focused skip link measured 189×46px.
- After the mobile-size adjustment, all 66 sampled visible initial-page controls measured at least 44px at 320px. The responsive check separately measured 17 designated compact controls; all met the 44px minimum.
- The target-size check measured 80 eligible targets at 320px and 1280px; all passed the 24×24px floor, with one inline text-link exception handled by the script.
- The local production-page resource check observed 5 script resources totaling about 192 KB transferred (about 653 KB decoded), a 10.7 KB navigation transfer, 512ms load-event completion, no page errors, and no images on the initial state. These figures are machine/build-specific and do not establish field performance.
- The detector's Arial warning is isolated; Georgia display headings and the travel-specific interface make it a false positive as a product-integrity issue.

## Coverage Limits

- Contrast covers the initial search page plus representative fixture result-card classes; it does not cover every dynamic result, error, challenge, or worker state.
- The controls check does not replace screen-reader testing, manual keyboard testing of every result workflow, or a complete WCAG audit.
- Responsive checks use Chromium emulated widths on one Linux host; they do not prove behavior on physical devices, touch hardware, browser zoom, or every dynamic result state.
- Performance timings are a single loopback production measurement and do not represent network latency, server load, or Core Web Vitals from users.
- The detector's single typography warning is not treated as a verified defect.

## Recommended Actions

1. **`$impeccable audit`**: Expand assistive-technology checks for dynamic result, error, and seller-handoff states.

## Implementation follow-up — 2026-11-14

Added semantic CSS custom properties for the core palette and values for both themes. The contrast browser check now asserts the page background and primary text tokens change between dark and light, and verifies the page, text, surface, and accent variables are present. All 48 defined variables are referenced; none are undefined or unused. `lib/booking-browser.mjs` now honors `TRAVEL_API_ANYTHING_HOME`, letting tests use temporary isolated API Anything state instead of touching the project cache. The full suite passed 599/599 with isolated test-only paths; the focused browser/cache tests passed 12/12. Fresh isolated production build passed; fresh production checks passed for contrast, accessible controls, and responsive layout; `npm audit --audit-level=low` found 0 vulnerabilities. The local server was stopped after checks. Mobile target comfort and full WCAG/assistive-technology/device coverage remain open.

The follow-up raised worker-status, location-type, filter-reset, and advanced-filter controls to at least 44px. `check:responsive-ui` now asserts the designated compact controls meet that target. Fresh build and browser checks passed after this change; 66/66 sampled visible initial-page controls meet 44px at 320px. No purchase, booking, or provider search occurred.
