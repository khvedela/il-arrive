# SLA-48 review — CHANGES REQUIRED

Reviewed commit: `a2aea15b29b3b27894d1fd6728c9822f4ccd3352`.

1. **Blocker — `apps/api/src/common/global-error.filter.ts:20` (submitted revision).** The new log statement references `reqId`, which is neither declared nor imported. This prevents a clean TypeScript build and throws a ReferenceError when the error filter handles an exception. Revert this unrelated edit or commit a corrected implementation, then provide fresh typecheck evidence for the exact submitted commit. Uncommitted changes in the working copy are not part of this review.
2. **Major — `apps/api/test/integration/customer-tenancy.spec.ts:46,108`; `docs/ARCHITECTURE.md:163`.** The test app omits production's `forbidNonWhitelisted: true` (`src/main.ts:24`). Its injected body `businessId` test expects 201, but production rejects this unknown field with 400. Match production validation, assert the rejected request persists no rows, then use a valid request to prove creation in the active business. Keep the query injection assertion. Update the docs to distinguish rejected body fields from ignored query fields. Preserve production validation strictness.
3. **Major — integration verification.** The handoff reports failures in notification and tracking suites without determining whether they are regressions. Supply a passing full integration run with test prerequisites satisfied, or exact failure output plus a reproducible comparison against the prior revision showing the same failures under the same prerequisites. Do not modify production data or other task worktrees. State any remaining environment limitations explicitly.

The tenant-scoped advisory lock, deterministic legacy-duplicate selection, unchanged existing identity, and separate customers across businesses look correct on inspection. No unique index or destructive migration is introduced.

Reviewer verification: customer-tenancy suite passes **10/10**, real HTTP and Postgres, with the test's current validation configuration. Command from workspace root:

```sh
OPENSSL_CONF=/dev/null TMPDIR="$PWD/.review-tmp" DATABASE_URL=postgresql://test:test@localhost:5432/ilarrive_test /Users/khvedela/.nvm/versions/node/v26.13.0/bin/node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.integration.config.js --runInBand --forceExit --testPathPattern=customer-tenancy
```

The first attempt without `OPENSSL_CONF=/dev/null` could not start Node because sandbox policy denied the system OpenSSL config. The adjusted command completed successfully. Full integration and submitted-revision typecheck were not rerun by reviewer; the committed undefined identifier was verified directly via `git show`. Concurrent uncommitted changes to the global filter and console SMS provider were left untouched.
