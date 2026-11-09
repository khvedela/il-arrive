# E2E acceptance report (SLA-21 / SLA-55)

- Base: `main` 2584098. Candidate: branch `SLA-21-e2e` (rebased/fast-forwarded onto main, 2 commits on top; SHA recorded in the landing comment).
- Suite: `e2e/real/primary-journey.spec.ts` (Playwright, Chromium), 12 tests, serial, 3 browser contexts: owner dashboard (desktop), technician PWA (iPhone 13, mocked geolocation), customer tracking page (Pixel 7, no auth).
- Stack: real API + BullMQ worker (console SMS provider) + Postgres 16 (:55432, private DB `ilarrive_e2e`) + Redis 7 + Mailpit (SMTP :1025, HTTP :8025) + Angular dev servers for web and track behind a small `/api` gateway. Redis is a private `redis-server` on :56390, because the shared one on :56379 has other agents' BullMQ workers consuming the `notifications` queue and swallowing jobs.
- Command: `pnpm e2e` (= `pnpm -F api build && playwright test -c playwright.real.config.ts`), run from a clean start (all servers started by Playwright) three times in a row.

## UI-driven steps
register form -> login form -> Team page invite (Mailpit email) -> technician opens invite link and accepts on mobile (lands on /tech) -> create intervention form (new customer, address autocomplete, window, assign Marc) -> /tech job -> "Je suis en route" + share location -> exactly one EN_ROUTE console SMS -> customer opens SMS link -> ETA updates over SSE with no reload -> location stale (>120 s) -> "Je suis arrivé" -> "Intervention terminée" (no coordinates in public payload, session purged) -> owner dashboard shows Terminée + timeline -> "Copier le lien" manual share (clipboard, no SMS).

Non-UI shortcuts (documented in the spec): SMS quota of the new TRIAL business is set to 50 in the DB (no billing UI; see findings), the ETA/last-fix timestamps are aged in the DB instead of sleeping 60-120 s, and the external BAN geocoder behind `GET /api/geo/search` is stubbed with Playwright route interception.

## Results
- run 1: 12 passed (20.5s)
- run 2: 12 passed (19.3s)
- run 3: 12 passed (19.5s)

Last ~30 lines of run 3:

```
  ✓   4 [chromium] › e2e/real/primary-journey.spec.ts:99:3 › primary scenario (ARCHITECTURE §13) › 3. owner creates today's intervention for a new customer (name, phone, address, window) and 
  ✓   5 [chromium] › e2e/real/primary-journey.spec.ts:125:3 › primary scenario (ARCHITECTURE §13) › 4. technician opens the job from /tech, taps "Je suis en route", shares (mocked) location; 
  ✓   6 [chromium] › e2e/real/primary-journey.spec.ts:145:3 › primary scenario (ARCHITECTURE §13) › 5. customer opens the SMS link (fresh context, no auth): business, Marc, "Technicien en rou
  ✓   7 [chromium] › e2e/real/primary-journey.spec.ts:155:3 › primary scenario (ARCHITECTURE §13) › 6. Marc moves closer: ETA on the customer page updates over SSE without a reload (5.9s)
  ✓   8 [chromium] › e2e/real/primary-journey.spec.ts:170:3 › primary scenario (ARCHITECTURE §13) › 7. location stops for > 120 s: stale message + last ETA with timestamp, no marker, no coord
  ✓   9 [chromium] › e2e/real/primary-journey.spec.ts:185:3 › primary scenario (ARCHITECTURE §13) › 8. Marc taps "Je suis arrivé": customer sees "Technicien arrivé" within 2 s; position no 
  ✓  10 [chromium] › e2e/real/primary-journey.spec.ts:196:3 › primary scenario (ARCHITECTURE §13) › 9. "Intervention terminée": session ended, link shows final state only, public payload has
  ✓  11 [chromium] › e2e/real/primary-journey.spec.ts:214:3 › primary scenario (ARCHITECTURE §13) › 10. owner reloads the dashboard: the intervention is Terminé with its full timeline (137ms
  ✓  12 [chromium] › e2e/real/primary-journey.spec.ts:229:3 › primary scenario (ARCHITECTURE §13) › manual share: "Copier le lien" in the owner panel puts the tracking link on the clipboard (

  12 passed (19.5s)
```

(The `[WebServer]` 429 "One location fix every 5 seconds" and 409 "No active tracking session" lines in the full log are expected server responses that the test provokes/asserts.)

## Product bugs found while driving the UI (fixed on this branch)
1. **Address autocomplete: choosing a suggestion with the mouse did nothing.** `libs/ui` address-autocomplete never bound `(click)` on the listbox (`onListboxClick` was dead code) and the input had no `[value]` binding, so the form kept "Choisissez une adresse dans la liste" and no intervention could be created by pointer/touch. Fixed (2 lines).
2. **Technician mobile view: the fixed action bar covered the location "Arrêter" button** (no bottom padding on the page; EN_ROUTE shows 3 stacked buttons). Fixed with bottom padding on the host.

## Open findings (not fixed here; follow-up tasks recommended)
- A newly registered TRIAL business has `smsQuotaMonthly = 0`, so every SMS is `quota_exceeded` until the DB is changed (dev seed uses 50). Product decision needed.
- Tech detail header shows the previous day ("Dim. 8 nov.") for an intervention scheduled on 9 Nov with window 00:00-23:30 (scheduled date is local midnight, rendered in UTC). Cosmetic, edge case.
- The Team page lists only active members; a pending invitation is not shown (only the toast "Invitation envoyée").
- Shared-Redis isolation: BullMQ queue names are global, so concurrent agents running workers against the same Redis steal each other's jobs. Use a private Redis for e2e (CI uses its own service container).
