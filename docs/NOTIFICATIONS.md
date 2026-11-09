# Notifications and manual sharing

The API enqueues console SMS and serves prefilled share messages. Run the worker
alongside the API (`pnpm -F api build`, then `pnpm -F api worker`). No real SMS
adapter or delivery webhook is enabled. `/dev/sms` reads the persisted console
outbox and returns 404 in production.

## Authenticated endpoints

Use the opaque `accessToken` returned by `/auth/login` or `/auth/register` as
`Authorization: Bearer <token>`. Notification routes verify its stored digest
and expiry with the shared session service, then load the caller's current
membership. Optional `X-Business-Id` selects a business the caller belongs to;
omitting it selects the oldest membership. Client-provided roles are never used.

- `POST /interventions/:id/notify {kind}`: OWNER/DISPATCHER; tenant scoped.
- `GET /interventions/:id/share-message?kind=EN_ROUTE`: OWNER/DISPATCHER or the
  assigned TECHNICIAN; returns `{text, link, smsUri}` for copy/native share/SMS.
- `GET /business/sms-usage`: OWNER/DISPATCHER; current UTC monthly usage and quota.

Sessions that expire or are deleted stop authorizing requests immediately.

## Durable event subscription

The worker polls unacknowledged `InterventionEvent` rows every second. SLA-8
writes these timeline rows when it creates or transitions interventions. The
notification subscriber maps created, en_route, delayed, arrived, cancelled and
rescheduled events. Completed/stop_route events produce no SMS. Stable timeline
IDs are the notification idempotency versions, including repeated en-route cycles.

SLA-9 should persist `intervention.eta.updated` with `{eta: ISO8601}` (the subscriber
also accepts `etaAt`), in the same transaction as the ETA update. The worker owns
notification delivery; producers need not call the notification service. Delay
payloads use `delayMinutes`; reschedules use `newWindowStart`. For en_route, the
subscriber uses a payload ETA or the current tracking session ETA.

`notificationProcessedAt` is acknowledged after policy/reservation. On a crash
before acknowledgement, replay uses the same idempotency key. If enqueue fails,
the committed QUEUED row is recovered by the existing queue reconciler. Malformed
payloads and failed reservations stay unacknowledged. Their attempt count, last
error (up to 1000 characters), and next eligible time are stored on the event.
Retries back off exponentially from one second to one hour, with no automatic
acknowledgement or deletion. Each batch takes up to 100 eligible rows ordered by
next attempt time, then creation time and ID. Fresh work therefore progresses
before old retries even when those retries become due. Successful processing
clears the error; the attempt count remains available for diagnostics. Persisted
terminal policy outcomes (such as invalid phone or quota failure) retain their
existing notification record and acknowledgement semantics.

For operator replay after fixing a payload or dependency, leave
`notificationProcessedAt` null and set `notificationNextAttemptAt` to the current
time. For an acknowledged event, also clear `notificationProcessedAt`. Keep the
original event ID to preserve notification idempotency. Apply the event-outbox
and notification-event-retries migrations before starting the updated worker.

## Tracking links

Notifications use SLA-8's per-intervention advisory lock and single-active-link
rotation. They reuse a raw URL from an earlier notification only when its digest
matches the active, unexpired shared link. A token cannot be reconstructed from a
hash. If the active link's raw token is unavailable, issuance rotates it using the
shared service; the previous URL is revoked. Copy/share can explicitly rotate or
restore a revoked link. Dispatch refreshes a queued message after a rotation.
Revoking all links before dispatch suppresses queued messages and refunds their
reserved quota; automatic requests do not restore a revoked link. An explicit
manual send/share can restore it. Hard expiry remains windowEnd + 48 hours.

Dispatch rechecks terminal state under an intervention row lock and serializes
actual sends under the business lock. ETA delta/spacing, five-message cap and
configured quota remain in effect. A provider adapter can later implement the
`SmsProvider` interface and invoke `applyDeliveryStatus`; Brevo remains deferred.

## Verification

Run `pnpm -F api typecheck`, `pnpm lint`, `pnpm -F api test` and
`pnpm -F api test:integration`. Integration needs migrated Postgres and Redis;
use a dedicated test database. The notification suite uses its own Redis prefix.
It covers the real intervention transition -> persisted event -> worker path,
public token resolution, event replay, ETA jitter, quota/cap concurrency, retries,
refunds/recovery, terminal suppression, link rotation/revocation and real session
and tenant isolation. It does not fake authenticated principals with headers.
