# Il Arrive — Environments

This document describes the three deployment environments, the variables each requires, and how to run them locally.

## Environments

| Variable | Development | Staging | Production |
|---|---|---|---|
| `APP_ENV` | `development` | `staging` | `production` |
| `NODE_ENV` | — | `production` | `production` |
| `API_PORT` | `3000` | `3000` | `3000` |
| `API_HOST` | `0.0.0.0` | `0.0.0.0` | `0.0.0.0` |
| `DATABASE_URL` | `postgresql://ilarrive:ilarrive_dev@localhost:5432/ilarrive` | Managed Postgres URL | Managed Postgres URL |
| `REDIS_HOST` | `localhost` | Managed Redis host | Managed Redis host |
| `REDIS_PORT` | `6379` | `6379` | `6379` |
| `REDIS_PASSWORD` | *(empty)* | Random secret | Random secret |
| `JWT_SECRET` | `change-me-in-production` | Random secret (≥ 64 chars) | Random secret (≥ 64 chars) |
| `SESSION_SECRET` | `change-me-in-production` | Random secret (≥ 64 chars) | Random secret (≥ 64 chars) |
| `FRONTEND_WEB_URL` | `http://localhost:4200` | `https://web.staging.ilarrive.fr` | `https://app.ilarrive.fr` |
| `FRONTEND_TRACK_URL` | `http://localhost:4201` | `https://track.staging.ilarrive.fr` | `https://track.ilarrive.fr` |
| `SMTP_HOST` | `localhost` (Mailpit) | Brevo SMTP / Resend SMTP | Brevo SMTP / Resend SMTP |
| `SMTP_PORT` | `1025` | `587` | `587` |
| `SMTP_USER` | *(empty)* | SMTP username | SMTP username |
| `SMTP_PASSWORD` | *(empty)* | SMTP password | SMTP password |
| `SMTP_SECURE` | `false` | `true` | `true` |
| `SMTP_FROM` | `noreply@ilarrive.local` | `noreply@staging.ilarrive.fr` | `noreply@ilarrive.fr` |
| `SENTRY_DSN` | *(empty)* | Staging DSN | Production DSN |
| `SMS_PROVIDER` | `console` | `console` or `brevo` | `brevo` |
| `BREVO_API_KEY` | *(empty)* | Brevo dev key | Brevo production key |
| `BREVO_SENDER` | *(empty)* | Staging sender | Production sender |
| `ROUTING_PROVIDER` | `fake` | `tomtom` | `tomtom` |
| `TOMTOM_API_KEY` | *(empty)* | TomTom dev key | TomTom production key |
| `GEOCODING_PROVIDER` | `ban` | `ban` | `ban` |
| `MAP_TILES_URL` | MapTiler dev URL | MapTiler URL | MapTiler URL |
| `MAP_TILES_KEY` | MapTiler dev key | MapTiler key | MapTiler key |

### Secrets policy

- `.env.example` is committed and contains every variable with safe defaults.
- `.env` is **never** committed (listed in `.gitignore`).
- Real secrets (staging/production) live only in the hosting provider's secret manager.
- Provider API keys that are public (MapTiler tile key) are safe in the frontend; all others (TomTom, Brevo, Sentry, SMTP) are backend-only.

## Running locally

### Development (full stack)

```bash
# Start services (use `docker compose` or `docker-compose` depending on your setup)
docker compose up -d

# Install and generate Prisma client
pnpm install
pnpm db:generate

# Run all apps concurrently
pnpm dev
```

This starts PostgreSQL, Redis, and Mailpit via `docker-compose.yml`, then `pnpm dev` launches the API (port 3000), web dashboard (port 4200), and track page (port 4201). Requires Docker Desktop or equivalent running.

### Production-like (Docker images)

```bash
# Build and run all images
docker compose -f docker-compose.prod-like.yml up --build

# Run without rebuilding (images already built)
docker compose -f docker-compose.prod-like.yml up
```

This builds and runs the multi-stage Docker images for `api`, `worker`, `web`, and `track`, along with PostgreSQL, Redis, and Mailpit. The API runs on port 3000, web on 8080, track on 8081, and Mailpit UI on 8025.

Health check: `curl http://localhost:3000/health` → `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`

Both frontends are served by nginx containers: web at `http://localhost:8080`, track at `http://localhost:8081`.

### API migration

Before starting the API in staging or production, run migrations:

```bash
docker compose -f docker-compose.prod-like.yml run --rm api npx prisma migrate deploy
```

Or from the host:

```bash
pnpm -F api db:migrate deploy
```

**Never** run `prisma migrate dev` in staging or production — use `migrate deploy` which only applies pending migrations without schema prompt.

## CI environment

The CI pipeline uses a test database (`ilarrive_test`) and Redis with no password. All secrets are set to test-only values in the GitHub Actions workflow. No real provider keys reach CI.

## Generating secrets

For staging/production, generate secure secrets:

```bash
# JWT and session secrets
openssl rand -base64 64
# Redis password
openssl rand -hex 32
```
