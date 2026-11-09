# SLA-28 review — CHANGES REQUIRED

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
