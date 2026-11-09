# SLA-28 re-review — APPROVE

Manager re-review on 2026-11-09 approves source revision `19d8e5680947ab2798cc5ae1d1c1dd55c13ebd6f`, present at documentation head `c10bac9`. This supersedes the earlier CHANGES REQUIRED verdict below. No outstanding findings in the reviewed console-only notification scope. No merge performed by manager; parent may proceed through its merge process.

1. **Resolved — subscriber starvation.** Reviewed `93a7f2e`: failed events persist a next-attempt deadline, bounded exponential backoff, attempt count and truncated diagnostic; eligibility/order advance past failed rows while keeping them unacknowledged. The failure update is conditional on the event still being unacknowledged. Stable event IDs preserve notification reservation deduplication after an acknowledgement failure. The matching index/migration and operator replay instructions are included. Four meaningful unit regressions cover a 205-row poison backlog, due retries across reconstructed consumers, transient reservation recovery, acknowledgement replay and capped backoff.
2. **Resolved — live acceptance and rotation evidence.** Inspected the author's complete seven-migration execution and integration output in `docs/verification/SLA-29-live-results.txt`, plus fixture/teardown corrections in `d0822f5` and `19d8e56`. Independently reran the full integration suite on the supplied dedicated PostgreSQL 16/Redis 7 services: **3 suites, 19 tests passed, exit 0, 4.857s**. This includes persisted poison-event fairness across businesses, real transition/event/worker/session paths, shared-link rotation with actual provider body resolution, revocation, quota/cap concurrency, retries/refunds, tracking-link concurrency and health.

## Independent manager verification

Ran in the supplied worktree at `c10bac9`, with the same production/test tree as `19d8e56` (intervening changes are reports only). Configuration was loaded from gitignored `.cache/sla29/test.env`; no credentials were printed or committed. `OPENSSL_CONF=/dev/null` and workspace-local TMPDIR/XDG_CACHE_HOME were used.

- PASS: `node apps/api/node_modules/prisma/build/index.js migrate status --schema apps/api/prisma/schema.prisma` — all seven migrations present; database schema up to date. Author's fresh migration deployment was inspected, not repeated on existing data.
- PASS: `node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.integration.config.js --runInBand --forceExit --cacheDirectory .cache/sla28/jest-integration` — 3/3 suites, 19/19 tests. No BullMQ missing-key/unhandled-error output. The configured `--forceExit` prints its standard advisory; this run does not establish a separate open-handle audit.
- PASS: `node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --cacheDirectory .cache/sla28/jest` — 11/11 suites, 94/94 tests.
- PASS: `node apps/api/node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json`.
- PASS: `node node_modules/eslint/bin/eslint.js '**/{src,test,libs}/**/*.ts'`.
- PASS: `git diff --check`.

Full independent rerun logs remain ignored under `.cache/sla28/rereview-{migrations,integration,unit,typecheck,lint}.log`. Matching Prisma generation, API build and integration TypeScript compile are recorded in the author's handoff; the earlier manager build and full integration rerun also exercise the changed module paths. Services are dedicated disposable test services supplied by SLA-30, not the unrelated local database. Brevo/webhook remain deferred and are outside this approval. Test-service cleanup remains with its provisioning owner; no services were stopped during review.

---

# Original review — CHANGES REQUIRED (superseded)

Reviewed SLA-10 head `5a37232698eb2ab107d12c80c91fd72556a927f2`, including the integration delta from `8fab14e` and the notification implementation against `dd4800c`. No merge approved. Previously corrected auth/base findings were not reopened. Console-only scope is respected; Brevo/webhook remain deferred.

1. **Major — failed events can permanently stop notification consumption globally.** `apps/api/src/modules/notification/notification-event-subscriber.ts:34-35,72-73` always selects the oldest 100 unacknowledged rows and leaves every failed row eligible for the next identical selection. Once 100 malformed ETA/reschedule events (or persistently failing intervention requests) occupy that prefix, no newer event from any business is ever attempted. Reproduced with the compiled real subscriber: two drains over 100 invalid ETA events followed by one healthy created event made zero handler calls and never acknowledged the healthy row. This probe uses a database double, not PostgreSQL. Add durable retry scheduling/backoff or a quarantine/dead-letter state so failed events retain diagnostics and can be retried without monopolizing the first page. Do not silently acknowledge unsuccessful reservation as success. Add regression coverage with more than one batch, failed rows followed by healthy rows, transient recovery, and stable event-ID replay.

2. **Major acceptance gap — updated real PostgreSQL/Redis integration remains unverified.** `apps/api/test/integration/notification.spec.ts` and `tracking-link-concurrency.spec.ts` must pass on the reviewed revision with migrations applied before merge. This is an unavailable verification, not an observed failing test. Docker CLI reports no daemon socket; a dedicated PostgreSQL 16.15 cluster downloaded inside this worktree could not initialize because the sandbox denies `shmget`. One retry with both shared-memory settings set to mmap hit the same restriction. The configured application database was not modified and no credentials were guessed. This checkout has no Git remote; no CI execution is claimed. Use a supported dedicated test environment and attach migration and full integration output. Include a dispatch-after-rotation assertion without immediately revoking, proving the actual sent body's refreshed URL resolves; the existing rotate-then-revoke test proves suppression but does not exercise that delivery branch.

## Resolved/positive observations

- Worker imports the subscriber and starts through `createApplicationContext`, enabling lifecycle hooks and BullMQ registration.
- Timeline IDs feed notification idempotency keys; acknowledgement follows successful handler return, while Redis enqueue rejection leaves the durable QUEUED row for reconciliation.
- Notification endpoints verify opaque session digests/expiry with CreateSessionService and select current database membership; tenant and technician filters remain enforced.
- Shared link advisory locking and the partial unique active-link index are used; notifications can reuse matching raw URLs, explicitly regenerate, refresh bodies at dispatch and suppress/refund after revocation.
- Dispatch rereads current intervention state under a row lock; quota reservations serialize on Business and refunds remain conditional and period-scoped.
- Event/auth/link/worker code reviewed by inspection; these observations do not substitute for database execution.

## Verification

All commands ran in the supplied checkout. Node commands use `OPENSSL_CONF=/dev/null`; pnpm is absent from PATH, so direct repository-local entrypoints were used.

- PASS: Prisma 6.19.3 client regenerated from `apps/api/prisma/schema.prisma` using `node apps/api/node_modules/prisma/build/index.js generate --schema apps/api/prisma/schema.prisma` with workspace cache paths.
- PASS: contracts built using `node libs/contracts/node_modules/typescript/bin/tsc -p libs/contracts/tsconfig.json`.
- PASS: API typecheck and build using `node apps/api/node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json` and the same command without `--noEmit`.
- PASS: root ESLint using `node node_modules/eslint/bin/eslint.js '**/{src,test,libs}/**/*.ts'`.
- PASS: 10 unit suites, 90 tests using `node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --cacheDirectory .cache/sla28/jest`.
- PASS: integration source TypeScript compilation with a temporary config extending the API config, including src/test, node/jest types and API typeRoots.
- PASS: `redis-cli ping` returned PONG. This is connectivity evidence only.
- PASS: subscriber starvation reproduction, `node .cache/sla28/subscriber-probe.cjs` (compiled implementation, database double).
- NOT RUN: migrations and real Postgres/Redis integration suite. Dedicated PG initialization failed with `FATAL: could not create shared memory segment: Operation not permitted; Failed system call was shmget(...)`, including the mmap retry. Docker returned `dial unix /var/run/docker.sock: connect: no such file or directory`. No running local dedicated database was created.

Local ignored evidence: `.cache/sla28/{unit,lint,typecheck,build,integration-typecheck,subscriber-probe,initdb,initdb-mmap}.log`; `.cache/sla28/subscriber-probe.cjs`. PostgreSQL package `@embedded-postgres/darwin-arm64@16.15.0-beta.19` SHA-512 verified against registry integrity metadata; only local test binaries were unpacked, no dependency/lockfile changes.

Author action: fix finding 1, add the regression/dispatch assertions, provide a supported dedicated database/Redis test run for finding 2, and request re-review. Do not merge pending manager approval.
