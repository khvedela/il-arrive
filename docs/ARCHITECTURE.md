# Il Arrive — MVP Architecture (v1, chief, 2026-11-09)

Product brief: Paperclip task SLA-2. This note is the binding technical contract for the MVP.
Anything not listed here is out of scope until the primary acceptance scenario passes end to end.

## 1. Shape

Modular monolith, TypeScript everywhere, one repo (pnpm workspaces).

```
il-arrive/
  apps/
    api/          NestJS — REST + SSE, Prisma, BullMQ workers (same process in dev, separate `worker` entrypoint in prod)
    web/          Angular — business dashboard (/app) + technician PWA (/tech), one build, service worker on /tech
    track/        Angular — public customer tracking page (/t/:token), separate tiny bundle, SSR/prerendered shell
  libs/
    contracts/    Shared TS types + zod schemas generated from/aligned with OpenAPI (DTOs, enums, SSE event payloads)
    ui/           Angular design-system library: tokens (CSS custom properties) + standalone components
  docs/
  docker-compose.yml   postgres:16, redis:7, mailpit
```

Why two Angular apps: the customer page must load fast on 3G. It must not ship dashboard code.
Budget for `track`: initial JS ≤ 120 kB gzip without the map. The map (MapLibre) is lazy-loaded only when a live position exists.

Angular: latest stable, standalone components only, signals for state (no NgRx), strict TS, `@angular/localize` with French as source locale.
NestJS: latest stable, `@nestjs/swagger` for OpenAPI at `/api/docs`, class-validator DTOs, pino structured logs, `/health` (db + redis).

## 2. Domain model (Prisma)

- `Business` — name, slug, logoUrl, phone (E.164), brandColor, plan (`SOLO|EQUIPE|BUSINESS`, default trial), smsQuotaMonthly, smsUsedThisPeriod, notification prefs (json), timezone (default Europe/Paris).
- `User` — email, passwordHash (argon2id), firstName, lastName, avatarUrl, phone.
- `Membership` — userId, businessId, role `OWNER|DISPATCHER|TECHNICIAN`. Solo pro = OWNER who is also assignable as technician (`isTechnician` flag on membership).
- `Invitation` — businessId, email, role, tokenHash, expiresAt, acceptedAt.
- `Session` — userId, tokenHash, expiresAt, userAgent, lastSeenAt (opaque session cookie, revocable).
- `Customer` — businessId, name, phone (E.164), email?  (kept minimal; no CRM).
- `Intervention` — businessId, customerId, technicianMembershipId, address (label + lat/lng from geocoding), scheduledDate, windowStart, windowEnd, description?, internalNotes?, status, delayMinutes?, delayReason?, cancelledReason?, completedAt.
- `InterventionEvent` — append-only timeline: type, actorUserId?, payload json, createdAt.
- `TrackingLink` — interventionId, tokenHash (sha256), createdAt, revokedAt, expiresAt.
- `TrackingSession` — interventionId, startedAt, endedAt, lastLat, lastLng, lastAccuracy, lastFixAt, etaAt, etaComputedAt, etaSource, lastNotifiedEtaAt. Last position only; **no position history table**.
- `Notification` — interventionId, kind, channel `SMS`, to, body, idempotencyKey (unique), provider, providerMessageId, status `QUEUED|SENT|DELIVERED|FAILED`, error, attempts, createdAt.
- `AuditLog` — businessId, actorUserId, action, targetType, targetId, ip, createdAt.

Tenant isolation: every tenant-owned row carries `businessId`. All repository access goes through a request-scoped `TenantContext`; a Prisma client extension injects `businessId` into every query on tenant models and throws if absent. Required tests: cross-tenant read/update/delete returns 404.
Technician scoping: TECHNICIAN role sees only interventions where they are assignee (enforced in the service layer, tested).

## 3. Intervention state machine

```
SCHEDULED ──en_route──▶ EN_ROUTE ──arrived──▶ ARRIVED ──complete──▶ COMPLETED
   │  ▲                    │
   │  └──── stop_route ────┘   (technician cancels travel; session ends, back to SCHEDULED)
   └─────────── cancel (from SCHEDULED/EN_ROUTE/ARRIVED) ──▶ CANCELLED
reschedule: SCHEDULED/EN_ROUTE → SCHEDULED with new date/window (ends any session)
delay: overlay (delayMinutes + reason) on SCHEDULED/EN_ROUTE, not a state
```
Transitions live in one pure function (`transition(intervention, action, actor)`) with exhaustive unit tests; every transition writes an `InterventionEvent` and publishes a realtime event.

Customer-facing labels (track page): `Rendez-vous confirmé` (SCHEDULED, not today) → `Intervention prévue` (SCHEDULED, today) → `Technicien en route` → `Technicien arrivé` → `Intervention terminée`; plus `Rendez-vous annulé`, `Rendez-vous déplacé`, `Retard signalé` banners.

## 4. Tracking links

- Token: 32 random bytes, base64url (43 chars). Only the SHA-256 hash is stored. URL: `https://<track-host>/t/<token>`.
- Generated at intervention creation. Business can copy, resend (SMS) or regenerate (revokes old).
- Public endpoint `GET /public/track/:token` returns a **customer-safe projection** only: business identity, technician first name + avatar, status, window, address label, ETA (+computedAt), delay, approximate position (only while EN_ROUTE and fix is fresh), contact phone. Never internal notes, never other interventions, never history.
- Position is returned only while status = EN_ROUTE. Rounded to 4 decimals (~10 m) — no trail, no heading history.
- After COMPLETED/CANCELLED: final status visible for 24 h, then 410 "Ce lien a expiré". Hard expiry: windowEnd + 48 h. Revoked → 410.
- Rate limit public endpoints per IP and per token (Redis, `@nestjs/throttler` with Redis storage). Unknown token → 404 with uniform timing.

## 5. Location + ETA

Technician PWA, honest constraints: **foreground only**. `navigator.geolocation.watchPosition` while the en-route screen is open; Screen Wake Lock API when available; clear UI "Position partagée avec le client" + stop button. If the page is backgrounded the stream stops; customer sees stale handling below. No background tracking claims in UI or marketing copy.

- Client sends `POST /tech/interventions/:id/location` at most every 20 s, or sooner if moved > 150 m; drops fixes with accuracy > 200 m.
- Server accepts only if intervention is EN_ROUTE, caller is the assignee, session active. Otherwise 409 and client stops watching.
- Server stores last fix on `TrackingSession` (+ Redis for fanout), never a history.
- ETA recompute when: session start; ≥ 60 s since last compute AND (moved > 500 m OR ETA older than 3 min). Hard cap 1 routing call / 60 s / session.
- `RoutingProvider` interface: `route(from, to, departAt) → { durationSec, distanceM, trafficAware: boolean }`. Adapters: `TomTomRoutingProvider` (recommended primary: traffic-aware, good EU coverage), `FakeRoutingProvider` (tests/dev only; flagged `etaSource=fake` and shown in UI as "estimation de démonstration" — never in production config).
- Geocoding: `GeocodingProvider` interface, adapter `BanGeocodingProvider` (api-adresse.data.gouv.fr — free, authoritative for French addresses) used for address autocomplete at intervention creation.
- Staleness: fix older than 120 s → `locationStatus=STALE`; customer page hides the marker, shows "Position non disponible depuis HH:MM" and the last ETA with "estimée à HH:MM". Never extrapolate a position or ETA.
- Session auto-expiry: ended on ARRIVED/COMPLETED/CANCELLED/reschedule, or after 3 h EN_ROUTE without arrival (job sweeps; status stays EN_ROUTE but location sharing stops). Position fields nulled at session end.

## 6. Realtime

SSE (one-way, proxy-friendly, trivially reconnects):
- `GET /public/track/:token/events` — customer projection deltas.
- `GET /app/events` — dashboard stream for the business (auth cookie).
Fanout via Redis pub/sub channel per intervention/business so multiple API instances work. Clients reconnect with `Last-Event-ID`; on reconnect they refetch the full projection (simple, correct). Heartbeat every 25 s.

## 7. Notifications (SMS)

> **Scope change (user, 2026-11-09):** this is not a production build. No real SMS provider in this phase — build the full notification pipeline (interface, queue, policy, outbox, delivery tracking model) with `ConsoleSmsProvider` only; a real adapter is a later backlog task. Manual link sharing (copy / native share sheet / `sms:` deep link opening the user's own phone with prefilled text) is the primary way to reach customers for now. Email uses a free SMTP setup only (Mailpit locally).

- `SmsProvider` interface: `send(to, body, idempotencyKey) → {providerMessageId}` + delivery-status webhook parser. Adapters: `ConsoleSmsProvider` (dev, logs + Mailpit-style inbox page at `/dev/sms`). Real provider adapter (Brevo/OVH/Twilio) deferred to a later task.
- BullMQ queue `notifications`, retries with exponential backoff (3 attempts), failures recorded on `Notification`.
- Kinds: CONFIRMATION, EN_ROUTE, DELAY, ETA_UPDATE, ARRIVED, CANCELLED, RESCHEDULED.
- Dedup: unique `idempotencyKey = interventionId:kind:version`.
- Thresholds: ETA_UPDATE only if |newEta − lastNotifiedEta| ≥ 15 min AND ≥ 20 min since last SMS for this intervention. Max 5 SMS per intervention. Per-business prefs toggle each kind (defaults: CONFIRMATION off—manual, EN_ROUTE on, DELAY on, ETA_UPDATE on, ARRIVED off, CANCELLED on, RESCHEDULED on).
- Quota: per-plan monthly SMS quota on `Business`; over quota → no send, dashboard banner, manual link sharing still works.
- Phones: `libphonenumber-js`, default region FR, store E.164, display national format.
- Copy is French, ≤ 160 GSM-7 chars where possible, includes business name and link. Example: `Marc (Plomberie Martin) est en route. Arrivée estimée vers 10h42. Suivi : https://…/t/…`

Transactional email (invites, password reset): `MailProvider` interface; generic `SmtpMailProvider` — Mailpit in dev, any free SMTP tier via env otherwise. No paid provider.

## 8. Auth

- Email + password (argon2id), opaque session token in `HttpOnly; Secure; SameSite=Lax` cookie, sessions table (revocable), 30-day sliding for technicians on their phone.
- CSRF: SameSite + custom header requirement on mutating requests.
- Invitations by email link (single use, 7 days). Password reset by email link (1 h).
- Roles guard: `@Roles('OWNER','DISPATCHER')` etc. OWNER: everything incl. billing/branding/members. DISPATCHER: interventions + technicians view. TECHNICIAN: own interventions + status actions.
- Login/registration/reset rate-limited.

## 9. Privacy / GDPR / CNIL

- Geolocation only between "Je suis en route" and arrival/stop — explicit per-session action by the technician, visible indicator, stop control. No tracking outside sessions, no history, no dashboard "trail" view. This matches CNIL guidance (no permanent tracking, employee can disable, purpose-limited).
- Retention: positions deleted at session end; interventions + customer PII anonymised 12 months after completion (configurable per business, job); notifications bodies purged after 90 days; audit log 12 months.
- Owner can delete a customer (anonymise their interventions) and export business data (JSON) — MVP: delete; export later.
- Audit log: member invite/remove/role change, link regenerate/revoke, intervention cancel, data deletion, branding change.
- Secrets only via env (`.env.example` committed, never `.env`). Provider keys never reach the frontend except the public map tile key.
- Documents to write before launch (not code): privacy notice for customers (linked from the track page), technician information notice, DPA/sub-processor list.

## 10. Billing (deferred, modelled only)

`plan`, `trialEndsAt`, `smsQuotaMonthly` fields exist; no payment integration in MVP. Stripe Billing is the intended provider later (behind `BillingProvider`). Plan hypotheses: Solo €9 (1 tech, 50 SMS), Équipe €29 (≤5 techs, 250 SMS), Business €59 (≤20 techs, 600 SMS) — to validate.

## 11. Infra

- `docker compose up` → postgres, redis, mailpit; `pnpm dev` runs api + web + track. `pnpm db:migrate` (prisma migrate), `pnpm db:seed` (dev seed is clearly separate from app code; the app never relies on seed data).
- Config via `@nestjs/config` + zod-validated env; envs: development, staging, production.
- CI (GitHub Actions): install, lint, typecheck, unit, api integration tests against service containers, Playwright e2e for the acceptance scenario, build. 
- Error monitoring: Sentry SDK behind `SENTRY_DSN` (no-op if unset).
- Deployment (later, needs user approval): one EU host (e.g. Scaleway/Clever Cloud/Fly Paris), managed Postgres + Redis, api + worker containers, static hosting/CDN for web and track. No Kubernetes.

## 12. Provider decisions needing user sign-off before any account/signup

| Need | Recommendation | Alternative |
|---|---|---|
| Email | **Decided (user, 2026-11-09): free only for now.** Generic SMTP adapter; Mailpit locally; any free SMTP tier (e.g. Brevo free 300/day, Resend free) via env when real delivery is wanted | — |
| SMS | **Deferred (user, 2026-11-09)** — added later. MVP uses `ConsoleSmsProvider` + manual link sharing | Brevo, OVHcloud SMS, Twilio |
| Routing w/ traffic | TomTom Routing API | Google Routes API, HERE |
| Geocoding | BAN (api-adresse.data.gouv.fr), free | — |
| Map tiles | MapTiler (MapLibre GL) | OpenFreeMap (free, no traffic) |
| Payments | Stripe (post-MVP) | Mollie |
| Hosting | Scaleway (Paris) | Clever Cloud, Fly.io |

Until then all development uses the dev adapters; nothing is hardcoded to a provider.

## 13. Primary acceptance scenario (e2e, Playwright, against real backend + DB)

1. Register "Plomberie Martin" (owner), set logo/phone/color.
2. Invite technician Marc; Marc accepts and logs in on mobile viewport.
3. Owner creates intervention (customer, phone, BAN-geocoded address, today, 8–12, Marc) in < 30 s of interaction.
4. Marc opens /tech, taps "Je suis en route", grants (mocked) geolocation; EN_ROUTE SMS appears in dev SMS outbox with a link.
5. Customer opens link (new context, no auth): sees business, Marc, "Technicien en route", ETA; map marker visible.
6. Marc's mocked position moves closer; ETA on customer page updates via SSE without reload.
7. Location stops arriving > 120 s (clock-controlled): customer sees stale message + last ETA with timestamp, no marker.
8. Marc taps "Je suis arrivé": customer page shows "Technicien arrivé" within 2 s; position no longer returned by API.
9. Marc taps "Intervention terminée": session ended, link shows final state only; `GET /public/track/:token` contains no coordinates.
10. Owner dashboard shows the intervention as completed with its full timeline.

## Customers API (SLA-48)

- `GET/POST /customers` are OWNER/DISPATCHER only and always scoped to the session's active business (`x-business-id` must be a membership, otherwise 401); body/query `businessId` is ignored.
- `POST /customers` is find-or-create by exact E.164 phone **within the business** (201 created / 200 existing, existing row returned unchanged, never overwritten). Same phone in another business is an independent customer.
- Concurrency: creates take a transaction-scoped Postgres advisory lock keyed on `(businessId, phone)`. No unique index is added, so existing duplicate rows cannot break a migration; if legacy duplicates exist the oldest (`createdAt`, then `id`) is returned. A future unique index `(businessId, phone)` would first need a reviewed, non-destructive merge of duplicates (re-pointing `Intervention.customerId`) — deliberately out of scope here.
- `name` is trimmed before validation; whitespace-only is 400. `q` must be a single string (repeated `q` is 400).
- Tests: `apps/api/test/integration/customer-tenancy.spec.ts`.
