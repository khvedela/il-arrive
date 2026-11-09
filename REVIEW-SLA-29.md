# SLA-29 correction handoff — live integration passed, manager review required

Verified source revision: `19d8e5680947ab2798cc5ae1d1c1dd55c13ebd6f`.

- `93a7f2e`: durable event retry fix, migration, regression and integration coverage.
- `4b04450`: initial handoff identifying unavailable environment (now resolved by SLA-30).
- `d0822f5`: enable CONFIRMATION in the poison-batch integration fixture.
- `19d8e56`: wait for active BullMQ jobs before deleting test queue keys.

No merge performed. Return these changes and results to manager for re-review.

## Corrections

Events store retry eligibility, failed-attempt count and last error. Failures stay unacknowledged and retry exponentially from one second to one hour. The query orders eligible rows by next attempt time, creation time and ID, allowing later healthy work to progress past old poison rows. The migration adds those fields and a matching composite index. Stable timeline IDs preserve reservation/replay idempotency; terminal policy outcomes retain their existing semantics.

Four unit regressions cover 205 malformed rows followed by healthy work, elapsed retry deadlines across reconstructed consumers, transient reservation recovery, stable event IDs after acknowledgement failure, and capped backoff with retained diagnostics. Integration coverage persists 105 poison rows followed by another business's healthy event, verifies diagnostics/acknowledgement, and observes its SMS delivery. Dispatch-after-shared-rotation pauses/resumes the real queue without revoking, captures the provider's actual sent body, compares it to the SENT record, and resolves the token through PublicTrackingService. Operator replay/migration requirements are documented in `docs/NOTIFICATIONS.md`.

## Live environment and migration results

Chief supplied disposable, loopback-only PostgreSQL 16 at port 55432 and Redis 7 at port 56379 in SLA-30. Secure configuration is in `.cache/sla29/test.env` (mode 0600, gitignored); no credentials are included here. These test services were used instead of the unrelated embedded PostgreSQL on port 5432. Docker's actual host socket is under the host user's `.docker/run/`, so the earlier absence of `/var/run/docker.sock` did not imply Docker was unavailable. No credential guessing or denied embedded-PG retry was required.

All seven migrations applied successfully to the fresh dedicated `ilarrive_sla29_test` database:

```text
20261109000323_init
20261109090000_sms_period_start
20261109091000_notification_dispatch_fields
20261109100500_notification_event_outbox
20261109103000_notification_event_retries
20261109120000_password_reset_token
20261109130000_tracking_link_single_active
All migrations have been successfully applied.
```

Exact live commands, run from the worktree root:

```sh
source .cache/sla29/test.env
export OPENSSL_CONF=/dev/null
export TMPDIR="$PWD/.cache/sla29"
export XDG_CACHE_HOME="$PWD/.cache/sla29"
node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.integration.config.js --runInBand --forceExit --cacheDirectory .cache/sla29/jest-integration
```

Final integration output (exit 0):

```text
PASS apps/api/test/integration/notification.spec.ts
PASS apps/api/test/integration/tracking-link-concurrency.spec.ts
PASS apps/api/test/integration/health.spec.ts
Test Suites: 3 passed, 3 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        4.277 s, estimated 5 s
```

Complete migration/final integration output is committed in `docs/verification/SLA-29-live-results.txt`. It includes expected deliberate `redis down` and malformed-event diagnostics. The configured runner uses `--forceExit`, which prints Jest's standard forced-exit advisory. The final run has no BullMQ missing-key/unhandled-error output.

The first live run passed 18/19 tests: the poison-batch fixture waited for a confirmation SMS while CONFIRMATION was disabled by default. Enabling that preference fixed the fixture without changing product policy. The next run passed 19/19 but logged a cleanup race because queue obliteration preceded completion of an active BullMQ job. Pausing and draining active jobs before obliteration fixed teardown; the final full run above passed without that error. Earlier logs remain ignored in `.cache/sla29/integration-live*.log`.

## Other verification

Node commands below use `OPENSSL_CONF=/dev/null`. pnpm is absent, so repository-local entrypoints were used.

| Command (after environment prefix) | Result |
| --- | --- |
| `node apps/api/node_modules/prisma/build/index.js generate --schema apps/api/prisma/schema.prisma` with workspace cache paths | PASS: Prisma Client 6.19.3 generated |
| `node apps/api/node_modules/prisma/build/index.js validate --schema apps/api/prisma/schema.prisma` with workspace cache paths | PASS: schema valid |
| `node apps/api/node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json` | PASS: exit 0 |
| `node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.json` | PASS: exit 0 |
| `node node_modules/eslint/bin/eslint.js '**/{src,test,libs}/**/*.ts'` | PASS: exit 0, rerun after final fixture/teardown edits |
| `node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --cacheDirectory .cache/sla29/jest` | PASS: 11 suites, 94/94 tests; production source unchanged since this run |
| `node apps/api/node_modules/typescript/bin/tsc -p .cache/sla29/integration-tsconfig.json` | PASS: exit 0, rerun after final fixture/teardown edits |
| `git diff --check` | PASS |

Integration typecheck config extends `../../apps/api/tsconfig.json`, sets `noEmit: true`, `rootDir: ../../apps/api`, `types: [node, jest]`, `typeRoots: [../../apps/api/node_modules/@types]`, and includes `../../apps/api/{src,test}/**/*.ts`. Logs/config remain in `.cache/sla29/`.

The environment blocker is resolved. Manager approval remains outstanding; console-only scope, deferred Brevo/webhook work and the no-merge gate are unchanged. Test containers remain available for re-review; teardown instructions are recorded in SLA-30.
