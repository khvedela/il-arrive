# SLA-29 correction handoff — live integration blocked

Implementation revision: `93a7f2e` (based on SLA-28 review `ab71d51`, which already contains required SLA-10 head `5a37232698eb2ab107d12c80c91fd72556a927f2`). No branch switch or merge performed. Manager re-review is required; no merge approval is claimed.

## Corrections

- Events store retry eligibility, failed-attempt count and last error. Failures stay unacknowledged and retry exponentially from one second to one hour. The query orders eligible rows by next attempt time, creation time and ID, so old poison retries cannot repeatedly occupy the oldest page ahead of fresh work. The new migration adds these fields and replaces the pending-event index with a matching composite index.
- Four regression tests cover 205 malformed rows followed by healthy work, elapsed retry deadlines across reconstructed consumers, transient reservation recovery, stable event IDs after acknowledgement failure, and capped backoff with retained diagnostics. Existing terminal policy/FAILED notification outcomes retain their prior semantics; an exception during reservation is never acknowledged.
- Integration coverage adds 105 poison rows followed by another business's healthy event and inspects persisted diagnostics. A separate rotation test pauses the real queue, rotates via the shared service, resumes delivery without revoking, captures the body at the provider boundary, compares it to the SENT record, and resolves the actual sent token through PublicTrackingService.
- Operator replay steps and migration requirements are documented in `docs/NOTIFICATIONS.md`. Console provider only; deferred adapters and auth findings were not reopened.

## Verification on the implementation revision

Commands were run from the worktree root. Node commands use `OPENSSL_CONF=/dev/null`. pnpm is absent, so the repository-local entrypoints were used.

| Command (after the environment prefix) | Result |
| --- | --- |
| `node apps/api/node_modules/prisma/build/index.js generate --schema apps/api/prisma/schema.prisma` with `TMPDIR="$PWD/.cache/sla29" XDG_CACHE_HOME="$PWD/.cache/sla29"` | PASS: Prisma Client 6.19.3 generated |
| `node apps/api/node_modules/prisma/build/index.js validate --schema apps/api/prisma/schema.prisma` with the same workspace cache variables | PASS: schema is valid |
| `node apps/api/node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json` | PASS: exit 0, no diagnostics |
| `node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.json` | PASS: exit 0, no diagnostics |
| `node node_modules/eslint/bin/eslint.js '**/{src,test,libs}/**/*.ts'` | PASS: exit 0, no diagnostics |
| `node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --cacheDirectory .cache/sla29/jest` | PASS: 11 suites, 94/94 tests (baseline: 10 suites, 90/90) |
| `node apps/api/node_modules/typescript/bin/tsc -p .cache/sla29/integration-tsconfig.json` | PASS: exit 0, no diagnostics |
| `git diff --check` | PASS: exit 0 |
| `redis-cli ping` | PASS: `PONG` (connectivity only) |

The integration typecheck config extends `../../apps/api/tsconfig.json`, sets `noEmit: true`, `rootDir: ../../apps/api`, `types: [node, jest]`, `typeRoots: [../../apps/api/node_modules/@types]`, and includes `../../apps/api/{src,test}/**/*.ts`. Ignored logs/config are in `.cache/sla29/`.

## Required acceptance still unavailable — not a failing-test verdict

**NOT RUN:** migrations against a real dedicated PostgreSQL database and the complete real PostgreSQL/Redis integration suite. New integration assertions are compiled but have no live pass verdict.

Current capability check: `/var/run/docker.sock` is absent; no dedicated test URL, database URL, CI flag or GitHub repository was supplied in this run's process environment; `git remote` prints no remotes. The app's `.env` database credentials were already rejected in the earlier author run. Per the assignment, no credential guessing or repeat of the previously denied embedded-Postgres `shmget`/mmap startup attempts was made. No external CI run is claimed.

**Unblock action (environment owner/chief):** supply a reachable dedicated PostgreSQL test database with credentials authorized for schema migrations and test writes, alongside reachable Redis, or provide a configured CI runner/repository that can execute this revision with both services. Do not send credentials in task comments. A local PostgreSQL runner also requires the shared-memory capability previously denied by the sandbox.

Once that capability is available, set `DATABASE_URL` to the dedicated test database and `REDIS_HOST`/`REDIS_PORT` for the test Redis, then from the worktree root run:

```sh
export OPENSSL_CONF=/dev/null
export TMPDIR="$PWD/.cache/sla29"
export XDG_CACHE_HOME="$PWD/.cache/sla29"
node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.integration.config.js --runInBand --forceExit --cacheDirectory .cache/sla29/jest-integration
```

Attach complete migration and integration output, including notification and tracking-link-concurrency suites, then return to manager for approval. No merge until that acceptance and manager review are complete.
