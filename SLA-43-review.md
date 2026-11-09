# SLA-43 review — CHANGES REQUIRED

Reviewed `SLA-43-invite@d9ca4d7` against `3849263` (commits `115d465`, `d9ca4d7`). Customer creation/search is excluded by chief's scope clarification of 2026-11-09 12:10. No implementation files changed by this review.

1. **Major — apps/api/src/modules/auth/auth.controller.ts:56: activate throttling on invitation acceptance.** The public route performs Argon2 password verification for existing accounts but has no throttle guard. `ThrottlerModule.forRoot` in app.module.ts:27 only provides configuration: the submitted tree has no `ThrottlerGuard`, `APP_GUARD`, or `useGlobalGuards` registration. Therefore the reported app-wide 100/minute protection is inactive. A business owner can invite an existing account into their own business, obtain that invitation token, and repeatedly guess that account's password; failed verification does not consume the token. This also permits repeated expensive Argon2 work. Register an effective guard covering this route with an appropriate authentication attempt limit. Add an HTTP regression test using the production guard wiring: repeated wrong passwords must reach 429, issue no cookies, leave the invitation unclaimed, and allow legitimate redemption after the window. Re-run lint, typecheck, API and integration tests and attach their actual output tails.

## Verification performed

An isolated archive of the exact submitted SHA was extracted inside this task's `.cache/review-sla43`; the assigned branch was not switched or modified.

- Submitted real-Postgres integration spec: **1 suite / 5 tests passed** (2.435s), using `.cache/sla29/test.env`.
- Additional reviewer-only HTTP probe in that archive: **105 consecutive wrong-password requests all returned 401, followed by successful redemption (201)**; requests completed in 2.911s. This reproduces the missing protection. The probe imports AuthModule as the submitted integration tests do; absence of production guard registration was separately verified across the complete submitted API source.
- Angular 19.2.27's actual `loadProxyConfiguration` loaded both submitted proxy files and rewrote `/api/auth/me` to `/auth/me`. Full `ng serve` was not run.
- `git diff 3849263..d9ca4d7 --check`: passed.
- Reviewed hashed token lookup/storage, atomic conditional claim with expiry inside the membership transaction, existing-user password proof, cookie helper parity with login, DTO validation, module wiring, error filter, and email route.

Representative integration output:

```text
PASS accept-invitation.spec.ts
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        2.435 s
```

Reviewer probe output (the probe asserts the vulnerable behavior to reproduce it):

```text
PASS accept-invitation.spec.ts
✓ review probe: 105 password guesses bypass the claimed 100/minute global limit (2911 ms)
```

Cookie-only acceptance response is compatible with the current browser flow, which fetches `/auth/me` after acceptance. No additional blocker found in the submitted scope. Approval remains withheld pending finding 1.
