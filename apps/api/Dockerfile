# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/ui/package.json ./libs/ui/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/api/ ./apps/api/
COPY libs/contracts/ ./libs/contracts/
COPY libs/ui/ ./libs/ui/

RUN pnpm -F @il-arrive/contracts build && \
    pnpm -F api db:generate && \
    pnpm -F api build

# ---- run stage ----
FROM node:22-alpine AS run

RUN apk add --no-cache curl

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY libs/contracts/package.json ./libs/contracts/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build /app/apps/api/node_modules/.prisma/client ./apps/api/node_modules/.prisma/client
COPY --from=build /app/libs/contracts/dist ./libs/contracts/dist

# Rebuild native modules for production deps (argon2)
RUN pnpm rebuild argon2

WORKDIR /app/apps/api

ENV NODE_ENV=production

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
