# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY libs/ui/package.json ./libs/ui/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/web/ ./apps/web/
COPY libs/ui/ ./libs/ui/

RUN pnpm -F web build --configuration production

# ---- run stage ----
FROM nginx:alpine AS run

RUN apk add --no-cache brotli

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
