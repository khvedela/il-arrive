# SLA-26 re-review: CHANGES REQUIRED

Reviewed `integ/sla-24` at `d2b36ed6824230ccc611b5ee24fe33a6903a1f49` on 2026-11-09. Do not merge this revision. Findings use paths/lines at that commit.

1. **Major — invitation acceptance still does not consume the token atomically.** `apps/api/src/modules/members/accept-invitation.service.ts:61` commits membership creation separately from the invitation update at line 70. A database failure or process stop between these writes grants access but leaves `acceptedAt` null. Once an owner removes that membership, the same invitation token can restore it until expiry. This fails SLA-25 finding 2's atomic single-use requirement. A fault-injection probe against the real service reproduced both the partial grant and successful replay after simulated owner removal. Put user/membership writes and a conditional invitation claim (`acceptedAt IS NULL`, unexpired) in one transaction; require exactly one claim and roll back every write on failure. Add failure/rollback and concurrent-redemption regression tests against PostgreSQL. A transaction alone without a conditional claim/lock is insufficient for concurrent consumers.

2. **Minor — link concurrency coverage is incomplete.** `apps/api/test/integration/tracking-link-concurrency.spec.ts:36` tests concurrent rotations from no active link and a direct duplicate insertion, but omits rotations with an existing active link and rotation versus revoke, both requested in SLA-25 finding 6. `intervention.repository.ts:177` still revokes without the advisory lock used at line 168. Define and test the ordering of overlapping rotation/revocation, including returned URLs and their final validity; use the same transaction lock if revocation must participate in serialized ordering. This review does not claim a live PostgreSQL reproduction of a revocation failure. Run the migration and concurrency suite with real PostgreSQL before approval.

3. **Minor — solo-owner regression only tests the guard.** `apps/api/src/app.module.spec.ts:92` overrides InterventionService and always returns an empty list, so its OWNER 200 cannot establish membership eligibility or assignment enforcement. Add real service coverage for an assigned OWNER with `isTechnician=true`, an owner without eligibility, and an eligible but unassigned caller, including a status mutation. Inspection shows the service retains both membership and assignment checks.

## Resolved by inspection

- Global DatabaseModule exports PrismaService and AppModule imports it; local duplicate Prisma providers were removed.
- Reset/invitation issuance and lookup consistently use SHA-256 digests of random 32-byte tokens. Sequential redemption/expiry/replay tests pass. Invitation atomicity remains finding 1 above.
- Session issuance returns the raw token once, stores its digest and verifies raw tokens with expiry checks.
- Generic intervention reads now allow only OWNER/DISPATCHER; technician routes also admit eligible owners/dispatchers to service checks.
- Business/member routes have access and role guards; auth/me, logout and password changes are guarded and derive identity from the principal.
- Rotation takes a per-intervention transaction advisory lock and adds a partial unique active-link index. Database execution remains unverified.
- Deferred session middleware remains accepted scope; it is not a new finding.

## Verification and limits

Reviewed an archive of the exact commit inside the assigned worktree, without changing branches, editing the author's worktree, or moving main. Snapshot and fault-injection probe: `.paperclip/review-evidence/sla26-d2b36ed/` (local ignored evidence).

- Lint **passed**: `OPENSSL_CONF=/dev/null node node_modules/eslint/bin/eslint.js '**/{src,test,libs}/**/*.ts'` from the snapshot root.
- Default Jest run: **4 suites, 50 tests passed**. Two additional suites could not execute because the installed Prisma client lacks PasswordResetToken. This is an environment/client mismatch, not an established source defect.
- Focused token-redemption run: **3 tests passed** with ts-jest diagnostics and decorator metadata disabled to bypass unavailable branch-matched dependencies. This is behavioral evidence only, not build or Nest DI verification.
- Fault injection **passed**, confirming finding 1: `OPENSSL_CONF=/dev/null node .paperclip/review-evidence/sla26-d2b36ed/probe.cjs`. Uses the real AcceptInvitationService with a database double that fails invitation.update after successful membership.create; removes that membership, then redeems the original token successfully. No live database used.
- Typecheck/build **not verified with matching dependencies**: direct tsc reports the stale Prisma client and missing contracts/nodemailer/dotenv dependencies. pnpm is unavailable on PATH. Full AppModule startup/HTTP suite therefore unverified here.
- PostgreSQL integration **not run**: `docker compose up -d postgres` could not execute (Docker config read denied; Compose subcommand unavailable, `unknown shorthand flag: 'd' in -d`). No migration was executed.

Author action: address finding 1, complete requested regression coverage, attach branch-matched build/typecheck/test/lint/startup results and live PostgreSQL migration/concurrency results, then request re-review before merging.
