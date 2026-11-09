# SLA-45 review — CHANGES REQUIRED

Reviewed 2026-11-09. No privacy commit is approved to land. Customers commit
`64fa94af67563633ca328cd4fda5f41655fb5a2e` is already on main; its review remains
open pending SLA-48. No revert or merge performed.

## Reviewed snapshots

- Main snapshot: `6f2e4ee04eb7a5bb605f21d387f09d4bbf84763c`, containing `64fa94a`.
- Privacy snapshot: `99536e53b290a769783d84426d14a8b471615567`, containing
  `9395389a64011304067dd0ac0f76c471557fa5f3` and
  `29cc19d0a93e6fa8a334e414685fc89fbc175b8a`.
- Exported immutable snapshots with `git archive` inside the assigned workspace;
  no branch switch, main checkout access or `/tmp` worktree mutation.
- Source line references below use their respective snapshots, not a hypothetical
  combined cherry-pick. A repaired integrated candidate needs another review.

## Findings

1. **Major — customer.controller.ts:37,47; missing integration coverage (SLA-48).**
   Explicit `businessId: user.activeBusinessId` is present on create and search;
   class guards require authentication plus OWNER/DISPATCHER. Session middleware
   derives the active business and role from membership. Static inspection found
   no new tenant bypass, but there are no tests of these new endpoints. Add real
   HTTP/Postgres negatives for foreign business selection and injected businessId,
   TECHNICIAN GET/POST 403 and unauthenticated 401, with OWNER/DISPATCHER success.
   `intervention.repository.ts:31,57,88` retains parent business scoping and
   selects only intended customer/technician fields. `list-members.service.ts:43`
   adds the already scoped membership ID; no defect found in these added fields.
   Cover both projections in regression tests. Also trim names before validation
   (whitespace currently passes then becomes empty), and validate scalar `q`
   (repeated/structured query values can reach `.trim()` and throw).

2. **Blocker — main.ts:25; common/global-error.filter.ts:20;
   notification/providers/console-sms.provider.ts:16 (SLA-49).**
   Pino redaction covers only its own middleware logs. The error filter prints
   raw `/public/track/:token` URLs and exceptions to console; the SMS provider logs
   phone plus the whole message, including the raw tracking link. Both reproduced
   against production classes with synthetic fixtures. Sanitize these sinks and
   the worker as well as HTTP logs. `main.spec.ts:1` defines its own masking
   functions and imports no production logger: all its tests can pass with the
   real redaction removed. Test emitted production logs, including error paths,
   headers/cookies/CSRF, public URLs, phone and coordinates.

3. **Major — retention.service.ts:104–126 (SLA-50).**
   Anonymisation changes only customer name and intervention internalNotes.
   Phone/email, address label/coordinates, description and other free-text PII
   remain. An old job also renames a shared customer with a current job. The
   fixture probe confirms retained fields. Implement complete field eligibility
   and preserve live customer identity; add fake-clock/shared-customer tests.
   Retention is process-wide env configuration, not the per-business policy
   specified in architecture §9.

4. **Major — retention.service.ts:138–180,39–72 (SLA-50).**
   Expired links are revoked, never purged; already revoked links are excluded.
   `trackingLinkRetentionDays` is unused. Old QUEUED notification PII survives
   the status filter. Sweep errors are swallowed, allowing BullMQ to report
   success after failed cleanup. Implement bounded eligible purges, preserve
   notification quota/idempotency invariants and active sessions, and propagate
   failures for retries. Test cutoffs and ended-session position clearing. Existing
   lifecycle/maintenance position clearing predates this commit; retention adds
   no fake-clock tests. Scheduler registration is duplicated and UTC is implicit.

5. **Major — business.service.ts:139–183;
   intervention.service.ts:187–198 (SLA-51).**
   Deletion/audit is **partial, not absent**: 99536e5 adds `deleteCustomer` and
   intervention deletion audit. No controller calls `deleteCustomer`; it only
   renames the customer and changes notes, leaving contact PII and dependent
   links/notifications/sessions. Intervention hard deletion already cascades
   dependent rows through schema relations, but its new success audit is written
   before tenant-scoped deletion. Missing/foreign IDs and failed deletes can leave
   false success records. Expose owner erasure, perform complete tenant-scoped
   cleanup and make mutation/audit atomic. Role-change audit already exists in
   `members/update-member-role.service.ts:46`; verify rather than duplicate it.

6. **Major — notification/sms-templates.ts:50;
   intervention/public-tracking.service.ts:8;
   libs/contracts/src/public-tracking.ts:4; docs/design/copy.md (SLA-49).**
   Required SMS/tracking transparency copy and privacy-info projection field are
   **missing** from these commits. Add documented French copy and shared contract
   coverage. SLA-44 owns the existing frontend privacy page; reuse that work.

7. **Major — intervention.service.spec.ts:45–59, diff of 99536e5 (SLA-51).**
   Four existing technician authorization/list/today tests were removed and two
   ForbiddenException checks weakened to generic Error. Restore them and add
   erasure/tenant/audit rollback coverage. The higher overall test count is not
   evidence of preserved authorization coverage.

8. **Major — common/prisma.service.ts:5 (SLA-52).**
   Original SLA-41 item 5 remains missing: unrestricted PrismaClient, without an
   enforced repository-only access rule. Customer controller uses it directly.
   Add a minimal enforceable boundary with explicit auth/global-maintenance
   exceptions and cross-tenant negative tests. Do not infer a demonstrated
   customer bypass from this architectural gap.

## Phone dedup decision

Follow the original SLA-8 contract: find-or-create by exact E.164 phone **within
one business**, never globally. Return the existing row without silently replacing
its identity. Make concurrent creation safe and document conflict behavior;
identical phones in different businesses remain independent. Current POST always
inserts, so client-side search alone cannot enforce this. SLA-48 owns implementation
and non-destructive handling of pre-existing duplicates.

## Verification

Fresh `pnpm install --frozen-lockfile` succeeded on both exact snapshots with
pnpm 12.16.1 and Node 26.13.0. Each install used a new node_modules tree.
Then `pnpm -F api test --runInBand` (including Prisma generation and contracts
build) and `pnpm -F api typecheck` passed on both:

| Snapshot | Unit suites | Unit tests | API typecheck |
|---|---:|---:|---|
| main 6f2e4ee | 17/17 | 144/144 | pass |
| privacy 99536e5 | 18/18 | 151/151 | pass |

Commands used local pnpm with PATH pointing at the downloaded 12.16.1 binary,
`OPENSSL_CONF=/dev/null`, workspace TMPDIR and XDG_CACHE_HOME to accommodate
sandbox restrictions. Initial pretest attempts stopped on external cache access
and missing pnpm in lifecycle PATH; both were corrected before the successful runs.
No source changes were made to either test snapshot.

`SLA-45-review-probes.cjs` exercises actual provider/error-filter/retention classes
with synthetic values and fake Prisma. Run from repository root after preparing
and installing the privacy snapshot:

```
OPENSSL_CONF=/dev/null node docs/verification/SLA-45-review-probes.cjs .review-tmp/privacy/apps/api
```

It reproduced both logging leaks and incomplete retention. These are defect
reproductions, not integration acceptance. Full Postgres/Redis integration, lint,
browser tests and an integrated cherry-pick were not run in this review. No SHA
is approved, so the mandatory fresh-unit prerequisite was met for both inspected
candidates without turning either green suite into approval.

## Follow-up and landing gate

- SLA-48: rescuer-2 — customers integration/roles, dedup and validation.
- SLA-49: backend — logging and API consent notice.
- SLA-50: backend — retention completeness/retries/purges.
- SLA-51: backend — erasure/audit and restored authorization tests.
- SLA-52: backend — enforced tenant access boundary.

CHANGES REQUIRED goes to the authors and these children. After they return exact
commits and fresh check evidence, manager must review the resulting candidate
before chief lands it. Do not merge 9395389, 29cc19d or 99536e5 as approved work.
