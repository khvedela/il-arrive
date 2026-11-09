import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'pwa-installable.spec.ts',
  timeout: 60_000,
  reporter: 'list',
  webServer: { command: 'node e2e/serve-dist.mjs', url: 'http://localhost:4300', reuseExistingServer: true },
});
