import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['pwa-installable.spec.ts', 'real/**'],
  reporter: 'list',
  use: { baseURL: 'http://localhost:4200', ...devices['iPhone 13'], browserName: 'chromium' },
  webServer: {
    command: 'pnpm -F web dev',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
