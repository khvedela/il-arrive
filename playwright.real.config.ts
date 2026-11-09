import { defineConfig, devices } from '@playwright/test';

// Real-backend acceptance (ARCHITECTURE §13): API + worker + Postgres + Redis, console SMS provider only.
// Requires DATABASE_URL / REDIS_HOST / REDIS_PORT in the environment and `pnpm -F api build` having run (the root `pnpm e2e` script builds first).
export const PORTS = { api: 3300, worker: 3301, web: 4400, track: 4401, webUi: 4410, trackUi: 4411 };
export const URLS = {
  api: `http://127.0.0.1:${PORTS.api}`,
  web: `http://127.0.0.1:${PORTS.web}`,
  track: `http://127.0.0.1:${PORTS.track}`,
};

const apiEnv = {
  NODE_ENV: 'development',
  JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-jwt-secret',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret',
  API_PORT: String(PORTS.api),
  API_HOST: '127.0.0.1',
  SMS_PROVIDER: 'console',
  ROUTING_PROVIDER: 'fake',
  FRONTEND_WEB_URL: URLS.web,
  FRONTEND_TRACK_URL: URLS.track,
  SMTP_HOST: process.env.SMTP_HOST ?? '127.0.0.1',
  SMTP_PORT: process.env.SMTP_PORT ?? '1025',
};
const reuse = !!process.env.E2E_REUSE_SERVERS; // local debugging only; the acceptance runs start everything fresh

export default defineConfig({
  testDir: './e2e/real',
  outputDir: 'e2e/results',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node apps/api/dist/main.js', url: `${URLS.api}/health`, env: apiEnv, reuseExistingServer: reuse, timeout: 60_000 },
    { command: `node e2e/real/worker-runner.mjs ${PORTS.worker}`, url: `http://127.0.0.1:${PORTS.worker}`, env: apiEnv, reuseExistingServer: reuse, timeout: 60_000 },
    { command: `pnpm -F web exec ng serve --port ${PORTS.webUi} --host 127.0.0.1`, url: `http://127.0.0.1:${PORTS.webUi}`, reuseExistingServer: reuse, timeout: 240_000 },
    { command: `pnpm -F track exec ng serve --port ${PORTS.trackUi} --host 127.0.0.1`, url: `http://127.0.0.1:${PORTS.trackUi}`, reuseExistingServer: reuse, timeout: 240_000 },
    { command: `node e2e/real/gateway.mjs ${PORTS.web} ${PORTS.webUi} ${PORTS.api}`, url: `${URLS.web}/`, reuseExistingServer: reuse, timeout: 60_000 },
    { command: `node e2e/real/gateway.mjs ${PORTS.track} ${PORTS.trackUi} ${PORTS.api}`, url: `${URLS.track}/`, reuseExistingServer: reuse, timeout: 60_000 },
  ],
});
