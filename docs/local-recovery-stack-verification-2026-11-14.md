# Local recovery and stack verification — 2026-11-14

## Checks performed

`npm run check:job-recovery` passed using a disposable isolated SQLite fixture. It exercised the documented backup, backup verification, restore-to-new-file and restored-file verification commands. A completed record remained intact; one queued job and one active hotel job were marked interrupted and were not automatically replayed; the active job's challenge data was removed; the interrupted-job interaction was marked as failed; and both backup and restored files had mode `0600`. The check reported `productionDatabaseAccessed:false` and `providerRequests:0`. Temporary files were removed by the script.

`npm run check:local-stack` passed with a temporary database, isolated Next build directory and temporary loopback port. The web app returned HTTP 200, the worker was available, health was `ok`, queue depth was zero, shutdown was graceful and the port was released. It reported `providerSearches:0`; its temporary database and build output were removed.

## Limits and next work

These checks demonstrate the local recovery CLI and development-stack supervisor using disposable data. They do not demonstrate a production restore, automated encrypted/offsite backups, external service monitoring or alerts, distributed authentication/quota enforcement, or a public-deployment security review. Keep the app local-only until those deployment gates are satisfied. P12 and `work.md` §17 remain Partial.
