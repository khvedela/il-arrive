# SLA-10 review — CHANGES REQUIRED

Reviewed commits `200b886` and `0e6fc44` at HEAD `0e6fc44`.
The recorded user scope change in ARCHITECTURE.md §7 and the task thread defers Brevo and its webhook. Their absence is not a finding.

1. **Blocker — unauthenticated, unscoped intervention access.** `apps/api/src/modules/notification/notification.controller.ts:11` and `notification.service.ts:46,204`: both routes accept any intervention ID and use the unrestricted Prisma client. An unauthenticated caller knowing an ID can consume its quota or obtain a new tracking token and customer phone in the SMS URI. Add session/role checks, tenant context and technician assignment checks before lookup or side effects; fail closed until auth is available. Verify unauthenticated denial and cross-tenant/unassigned access returning 404 without creating rows or tokens.

2. **Major — quota and anti-spam checks race.** `apps/api/src/modules/notification/notification.service.ts:64,73,119,130`: history/quota are read separately from notification creation and quota increment. Concurrent distinct versions can all pass the last quota slot, five-message cap or ETA gap. Serialize policy evaluation and reservation per intervention/business in a DB transaction with appropriate locking/conditional updates and retry handling; keep unique-key dedup. Test concurrent sends across both one intervention and multiple interventions sharing a business.

3. **Major — enqueue failure permanently strands a charged notification.** `apps/api/src/modules/notification/notification.service.ts:119-149`: the row, quota and last-notified ETA are persisted before queue.add. If Redis fails or the process exits, retry returns duplicate at line 62 and never enqueues the job. Implement a durable transactional outbox/reconciler or equivalent recoverable dispatch protocol. Test Redis rejection and process interruption after reservation: eventual delivery exactly once, or a recoverable failure with accurate quota and ETA state.

4. **Major — queued SMS ignore later terminal transitions.** `apps/api/src/modules/notification/notification.service.ts:154`: deliver checks only Notification.status. A queued EN_ROUTE/ETA_UPDATE can send after the intervention completes or is cancelled, including after retry backoff. Recheck intervention eligibility immediately before provider send; preserve the one permitted cancellation notice, close suppressed rows and release reservations consistently. Test completion/cancellation between enqueue and delivery and between attempts.

5. **Major — automatic notification flow is absent.** `apps/api/src/modules/notification/notification.module.ts:20`: no subscribers or callers connect domain events to request(); the intervention module is empty in this snapshot. Merely exporting the service does not implement created/en_route/delayed/eta.updated/arrived/cancelled/rescheduled. Integrate the SLA-8 event contract, including stable event version and ETA payload, and exercise actual events through the worker/outbox. Keep this incomplete if its dependency is unavailable; do not claim acceptance from direct service calls.

6. **Major — monthly usage never renews and is not exposed.** `apps/api/src/modules/notification/notification.service.ts:193`: getUsage has no controller, and smsUsedThisPeriod only increments/refunds, with no period boundary or reset. Once a business hits quota it stays blocked next month. Implement an atomic, documented monthly period rollover and authenticated GET /business/sms-usage scoped to the caller. Verify rollover, concurrent sends at the boundary and tenant isolation. Do not block on final plan hypotheses: honor the configured Business quota.

7. **Major — tracking-link lifecycle diverges from the contract.** `apps/api/src/modules/notification/tracking-link.service.ts:16`: every render/share creates another token, using 24 bytes and expiry now + 48h. A confirmation for an appointment more than two days away therefore expires before the appointment; repeated sharing also mints independent links outside the shared regeneration/revocation flow. Use the SLA-8 tracking-link service/lifecycle (32 random bytes, hard expiry windowEnd + 48h and terminal/revocation rules) and an explicit supported resend/share strategy. Test a future appointment, regeneration/revocation and opening the generated link through the public resolver.

8. **Major — required integration and failure coverage is missing.** `apps/api/src/modules/notification/notification.service.spec.ts:10,44-48`: tests fake Prisma, queue and tracking links, then invoke deliver directly. They cannot verify DB uniqueness/locking, BullMQ retries, actual event wiring, persisted outbox or a resolvable token. Add Postgres/Redis integration coverage runnable in CI for the acceptance flow plus the concurrency, dispatch-failure, terminal and auth cases above. Add retry exhaustion/refund and idempotent delivery-status transition tests. Provide exact commands/output; unavailable local services are an environment limitation, not a substitute integration verdict.

## Verification

- PASS: `OPENSSL_CONF=/dev/null node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --cacheDirectory .review-cache/jest` — 4 suites, 24 tests.
- PASS: `OPENSSL_CONF=/dev/null node apps/api/node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json`.
- PASS: `OPENSSL_CONF=/dev/null node node_modules/eslint/bin/eslint.js "**/{src,test,libs}/**/*.ts"`.
- NOT RUN: real Postgres/Redis integration; no meaningful integration verdict available in this environment. Workspace-wide typecheck was not rerun.
- The pnpm launcher is sandbox-denied; direct local Node entrypoints were used. OPENSSL_CONF avoids Node attempting to read a sandbox-denied system configuration file.

Return these changes to rescuer, the current author/assignee, for correction and re-review. No implementation was changed by this review.
