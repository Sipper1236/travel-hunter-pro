# Package worker coverage-mode validation — 2026-11-23

The package worker-result validator treated every coverage mode other than `structured_widget_response` as the rendered-card path. A red regression showed that a result with `coverage.mode: "unrecognized-provider-mode"` was accepted if it otherwise copied the browser coverage fields. This let an unknown producer/schema version inherit the weaker browser-path validation.

The validator now accepts only the two current shapes: a missing `mode` for the ordinary rendered-card path, or `structured_widget_response` for the bounded structured widget path. Any other explicit value is rejected before the path-specific checks run. Existing tests continue to prove both supported shapes.

Verification: the first red run passed 11/12 package worker tests and failed because the invalid result returned no error. After the guard, `tests/package-worker-result.test.mjs` and `tests/vacation-search.test.mjs` passed 33/33; full `npm test` passed 735/735; `TRAVEL_NEXT_DIST_DIR=.next-package-coverage-build npm run build` passed on Next.js 16.4.6; `npm audit --audit-level=low` found 0 vulnerabilities; Markdown links passed for 143 files; and `git diff --check` passed. The local site returned HTTP 200; same-origin health reported `ok`, one live worker, queue depth 0, and no expired leases/deadlines.

No provider request, live fare, booking, reservation or purchase was made. This closes one discriminator gap in the package worker schema; field-by-field schema coverage and `work.md` §17 remain open.
