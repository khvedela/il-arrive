# SLA-38 review gate

Verdict: **CHANGES REQUIRED** for `f622eff` and `bb1d2e6`. Neither SHA is approved for landing by this review. Reviewed the SLA-36 diff from `102376a` and SLA-13 diff from `87203d3`, plus their auth, tenant and public projection dependencies. No merge or implementation edits made.

1. **Major — registration never establishes the browser session.**
   `apps/api/src/modules/auth/auth.controller.ts:34` returns the registration result without the session/CSRF cookies now set at login at line 43. `apps/web/src/app/core/auth.service.ts:48` immediately requests `/auth/me` and does not retain or send the returned access token. A new registration therefore creates an account but receives 401 instead of entering onboarding. Use the same cookie issuance helper for registration and login. Add an application HTTP test that registers, retains the cookies, successfully gets `/auth/me`, rejects a cookie mutation without CSRF and accepts it with the issued token.

2. **Major — the newly authenticated `/auth/me` payload breaks the web client and selects a different tenant.**
   `apps/api/src/modules/auth/auth.service.ts:150-161` omits `activeMembership` and membership `businessId`/`onboardingCompleted` required by `libs/contracts/src/auth-dto.ts`. `apps/web/src/app/core/auth.service.ts:24` dereferences `me.activeMembership.onboardingCompleted`, throwing after successful login/bootstrap. In addition, `auth.controller.ts:63` discards the middleware's selected business: the service prefers an OWNER membership while middleware defaults to the oldest membership or honors `x-business-id`. The displayed business can differ from the tenant authorizing requests. Return the shared MeResponse shape and resolve its active membership from the authenticated principal's activeBusinessId. Test multiple memberships, including an oldest TECHNICIAN membership, a newer OWNER membership and explicit header selection. Assert UI bootstrap succeeds with the actual API JSON rather than a handwritten mock. These contract gaps predate the diff, but block its claimed working browser authentication.

3. **Major — real public links cannot be exercised on localhost.**
   At `bb1d2e6`, `apps/track/src/app/services/tracking-api.service.ts:51-55` unconditionally selects mock mode for localhost/127.0.0.1. Any real generated token absent from tokenFixtureMap returns a synthetic 404 without contacting the API; known fixture tokens instead show fictional state and never subscribe to real updates. Default to real HTTP/SSE on all hosts. Keep screenshot fixtures behind explicit development/test injection or an explicit development-only opt-in. Verify the default localhost path calls HTTP and SSE with a real token and that screenshot tooling opts into fixtures intentionally.

Nonblocking follow-ups:

4. **Minor — duplicate public tracking contracts.** `libs/contracts/src/public-tracking.ts:1` lacks the top-level locationStatus and requires coordinates even for stale fixes. This does **not** by itself block these SHAs: inspection confirms `PublicTrackingService` sends top-level LIVE together with nested FRESH, matching showMap; stale fixes omit coordinates and render the stale card, and final states omit location. SLA-20 should consolidate the server and shared projection type and cover LIVE/STALE/UNAVAILABLE wire payloads in the client tests. Do not change nested FRESH blindly to LIVE.

5. **Minor — stream cancellation targets an unused field.** At `bb1d2e6`, `track-page.component.ts:1092-1114` subscribes through TrackingApi but closeEventSource only closes a component field that is never assigned. Retain/unsubscribe the RxJS subscription before replacement and on session_end, or use switchMap. Destruction is already covered by takeUntilDestroyed. Test session_end/refetch leaves no old subscription.

## Security checks

- Cookies are host-only, Path=/, SameSite=Lax, 30-day Max-Age, and Secure in production. The session is HttpOnly; the random 24-byte CSRF token is readable for double submission. Clearing uses matching attributes. CSRF comparison uses equal-length timingSafeEqual and applies to all unsafe methods with cookie auth.
- Bearer credentials take precedence and are verified independently. An invalid bearer does not fall back to a valid ambient cookie. Token lookup uses a SHA-256 digest and checks expiry; logout deletes the session.
- Membership lookup includes the verified userId and requested businessId. An unowned business leaves the principal unset. Default ordering is oldest createdAt. No tenant escape found in this lookup.
- Today's query includes both businessId and the caller's isTechnician membership ID. Detail checks business and assignment before reading customer/timeline; customer lookup includes businessId. No other-technician disclosure found in the reviewed paths. Server-local day boundaries match the stated requirement.
- Tracking page consumes the public projection only. Coordinates are not interpolated into its placeholder; the LIVE/FRESH card is EN_ROUTE-only. 404/410 clear the projection and show the corresponding message. MapLibre implementation is explicitly deferred in this review's brief.

## Independent verification

- `pnpm install --frozen-lockfile` attempted; sandbox denied `/Users/khvedela/Library/pnpm/bin/pnpm`. Thus the required fresh-install evidence is **not satisfied**. Authors must provide a fresh frozen-install rerun before final approval; installed dependencies are not fresh-install evidence.
- Passed: `OPENSSL_CONF=/dev/null TMPDIR="$PWD/.cache/sla38/tmp" node apps/api/node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --watchman=false --cacheDirectory=.cache/sla38/jest`: **17 suites, 144 tests passed**. Output: `.cache/sla38/api-tests.log`. No live PG integration, browser test or SLA-13 test rerun claimed.
- Passed controlled checks using actual AuthService/AuthController/SessionMiddleware with fake dependencies: confirmed missing activeMembership causes the exact frontend dereference to throw; registration sets no response headers; unowned business denied; invalid bearer does not fall back to cookie; default membership applied. Script/output: `.cache/sla38/review-checks.cjs` and `.cache/sla38/review-checks.log`. These are service-level reproductions, not a real browser/database run.
- Node initially could not read the system OpenSSL config; `OPENSSL_CONF=/dev/null` resolved that environment restriction. `git diff --check` passed before this document was added.

Fixes return to rescuer (auth) and rescuer-2 (tracking). Preserve the manager review gate and chief-only landing. Previous SLA-37 lifecycle findings remain outside this bounded review; this verdict does not approve those changes.
