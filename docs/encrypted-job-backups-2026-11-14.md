# Authenticated encrypted local backups — 2026-11-14

## Commands

Generate a separate key file once:

```sh
npm run jobs:database -- keygen <new-owner-only-key-file>
```

Set `TRAVEL_JOB_BACKUP_KEY_FILE` to that file for encrypted operations:

```sh
TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> npm run jobs:database -- backup-encrypted <new-archive-file>
TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> npm run jobs:database -- verify-encrypted <archive-file>
TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> npm run jobs:database -- restore-encrypted <archive-file> <new-database-file>
```

The source database is selected by `TRAVEL_JOB_DB` or the existing default. The archive uses AES-256-GCM with a random 96-bit nonce and a 128-bit authentication tag. Verification decrypts into a private temporary directory, authenticates the complete archive, then checks SQLite integrity, foreign keys and required schema. Restore writes only to a new destination; queued/running/paused records are marked interrupted, challenge data is removed, and no work is replayed automatically. JSON output contains metadata only.

The generated key is 32 random bytes represented as hex. Key files must be regular non-symlink files owned by the current user with owner-only permissions (`0600`); archive and restored database files are also `0600`. Never commit the key, print it, or store it with the archive. The existing plaintext `backup`/`verify`/`restore` commands remain available for compatibility and are not implicitly encrypted.

Key reads open the file without following symlinks, verify ownership and permissions on the opened descriptor, and read no more than 129 bytes. This bounds memory use and closes the path-check/open race; oversized, malformed and linked key paths fail closed. Encrypted archive verification and restore likewise open the archive once without following symlinks, validate type and size from that descriptor, and decrypt from the same descriptor so a later path replacement cannot redirect the stream.

## Verification

- `node --test tests/job-database-backup.test.mjs` — 3/3 passed. Coverage includes wrong key, modified GCM tag, unsafe key permissions, oversized and symlinked key files, symlinked archive refusal, refusal to overwrite, sensitive-data absence in ciphertext/CLI output, restored completed result, and no replay of incomplete work.
- `npm run check:job-recovery` — passed both plaintext and encrypted keygen/backup/verify/restore paths against disposable SQLite data; completed data survived, two unfinished jobs were interrupted, permissions were `0600`, production DB access was false and provider request count was zero.
- `npm run check:local-stack` — passed on a temporary database and port; HTTP 200, worker available, queue 0, graceful shutdown, port released, no provider searches.
- After bounded no-follow key and archive reads, `npm test` — 599/599 passed (84.3s).
- `TRAVEL_NEXT_DIST_DIR=.next-p12-archive-fd npm run build` — passed on Next.js 16.4.3.
- `npm audit --audit-level=low` — 0 vulnerabilities. `.env.local` remains mode `0600`.

## Remaining limits

This supplies authenticated local archive files, not automatic retention/scheduling, encrypted offsite transport/storage, independent key escrow, production-data restore evidence, external monitoring or a deployment security review. Losing the key makes an encrypted archive unrecoverable. Store the key independently and keep the application local-only until the remaining P12 and §17 deployment gates pass.

The separate local secrets check found `.env.local` mode `0644`; it was corrected to `0600`. The scan reported environment file names and permissions only; `.env.example` assignment metadata was checked without printing values. This does not encrypt `.env.local` or rotate credentials.
