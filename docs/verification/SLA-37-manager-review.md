# SLA-37 manager review

Verdict: **CHANGES REQUIRED**. Reviewed HEAD and local main at
`87203d3a2859a7b4021f91fd31d8cf7ff43e33e4`, including the changes from
`4655c7f^` through that commit. Return these findings to rescuer-2.

1. **Blocker — position survives session end.**
   `apps/api/src/modules/tracking/tracking-eta.service.ts:82` writes the exact
   routing origin to Redis after committing its DB transaction. Arrival/stop/expiry
   can commit and delete all tracking keys between those operations. The ETA
   request then recreates `eta-origin`, retaining coordinates for 11,100 seconds
   after sharing ended, contrary to ARCHITECTURE §9. There is no subsequent
   active-session check on this write. Serialize coordinate-cache writes with
   end cleanup, or use an atomic generation/active marker protocol that rejects
   writes after termination. Cover both `fix` and `eta-origin`, including delayed
   start/end hooks and cache failure recovery. Add a deterministic regression that
   pauses after the ETA transaction, completes stop/cleanup, then resumes and
   asserts no coordinate keys remain. A TTL does not satisfy deletion at session end.

2. **Blocker — operations are not bound to the session generation.**
   `apps/api/src/modules/tracking/tracking-location.service.ts:82` and
   `tracking-eta.service.ts:69` update whichever session is currently active by
   intervention ID. `intervention.repository.ts:111-113` reuses the same session
   row on restart. A request authorized before stop can resume after stop,
   reassignment and a new en_route, write the previous technician's position into
   the new session and expose it to the customer. An old routing response can
   likewise overwrite the new ETA. The maintenance snapshot has the same issue:
   `tracking-maintenance.service.ts:40` calls `endActiveSession` by intervention
   ID, allowing an expiry decision for an old session to end a new one. Introduce
   an immutable generation token (row ID alone is insufficient while reusing the
   row); carry it through ingestion, routing, maintenance and Redis lifecycle
   operations, and condition every mutation/cleanup on that generation. Check
   status and assignment atomically with accepting the fix. Test paused ingestion,
   paused routing and paused expiry across stop/restart, including reassignment.

3. **Major — new HTTP routes are unreachable through the application.**
   `apps/api/src/modules/tracking/tracking.controller.ts:17` and
   `apps/api/src/geo/geo.controller.ts:22` use `AccessTokenGuard`, whose
   `modules/auth/guards/access-token.guard.ts:12` only checks `request.user`.
   Neither main.ts nor AppModule/AuthModule installs an authentication component
   to populate that field. A real authenticated caller therefore always gets 401.
   `apps/api/test/integration/tracking.spec.ts:60-74` supplies a test-only
   middleware, masking the missing application integration. Wire the real session
   authentication and membership resolution into the app, retaining tenant and
   assignment checks; test these routes through the actual application without
   injecting a principal or replacement authentication middleware. Include valid,
   invalid/revoked session and other-business cases. The pre-existing guard gap
   still blocks completion of the new usable tracking API.

## Verification in this review

- Read lifecycle, ingestion, routing, maintenance, Redis fanout, public projection,
  auth wiring, notification event consumption and tracking integration tests.
- Executed actual TrackingEtaService and TrackingLocationService through ts-node
  with deterministic fake dependencies, exit 0. Forced end/Redis deletion after
  the ETA transaction and before its Redis write: the coordinate key was recreated
  with `{"lat":48.8,"lng":2.3}`. Forced a generation change between authorization
  and ingestion update: the old request returned `accepted: true` and its update
  predicate contained no generation guard. Confirmed AccessTokenGuard returns
  401 for a request containing credentials but no injected principal. These are
  controlled service interleavings, not live database concurrency tests.
- Focused existing tests, exit 0: 3 suites, 32 tests passed. Command, run in
  apps/api:
  `OPENSSL_CONF=/dev/null node node_modules/jest/bin/jest.js --runInBand --watchman=false --cacheDirectory=../../.cache/review-jest src/eta/eta-staleness-policy.service.spec.ts src/routing/providers/tomtom-routing.provider.spec.ts src/routing/routing.module.spec.ts`
- The initial Node invocation could not read the system OpenSSL configuration;
  the explicit configuration above resolved that environment restriction.
  The pnpm wrapper was denied by the sandbox; Jest ran directly via Node.
  Full install/lint/typecheck/migration/live integration checks were not rerun in
  this review; the worker's reported results are not independent review evidence.

No implementation changes or branch moves were made by the reviewer.
