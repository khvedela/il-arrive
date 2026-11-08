# Il Arrive

Suivi en temps réel d'arrivées de techniciens pour les artisans.

## Prérequis

- Node.js 22 LTS (voir `.nvmrc`)
- pnpm (pinned in `packageManager`)
- Docker / Docker Compose

## Installation

```bash
# Lancer les services (PostgreSQL, Redis, Mailpit)
docker compose up -d

# Installer les dépendances
pnpm i

# Générer le client Prisma
pnpm db:generate

# Créer la première migration et appliquer
pnpm db:migrate

# (Optionnel) Seeder des données de développement
pnpm db:seed
```

## Développement

```bash
# Lancer API + web + track en parallèle
pnpm dev

# Lancer un seul service
pnpm dev:api     # API NestJS sur :3000
pnpm dev:web     # Dashboard Angular sur :4200
pnpm dev:track   # Page tracking sur :4201
```

## Commandes

| Commande | Description |
|---|---|
| `pnpm dev` | Lancer tous les apps |
| `pnpm build` | Build production |
| `pnpm lint` | Linter ESLint |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm test` | Tests unitaires (API) |
| `pnpm db:migrate` | Appliquer les migrations |
| `pnpm db:seed` | Seeder données dev |
| `pnpm db:studio` | Prisma Studio |

## Architecture

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le contrat technique détaillé.

```
il-arrive/
  apps/
    api/          NestJS — REST + SSE, Prisma, BullMQ workers
    web/          Angular — dashboard + PWA technicien
    track/        Angular — page de suivi client
  libs/
    contracts/    Types, DTOs et enums partagés
    ui/           Bibliothèque Angular (tokens CSS, composants)
  docs/
  docker-compose.yml
```

## Services

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| OpenAPI | http://localhost:3000/api/docs |
| Health | http://localhost:3000/health |
| Dashboard | http://localhost:4200 |
| Tracking | http://localhost:4201 |
| Mailpit | http://localhost:8025 |
