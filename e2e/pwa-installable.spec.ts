import { test, expect } from '@playwright/test';

// Requires `pnpm -F web build` then the static server on :4300 (see playwright.pwa.config.ts).
test('PWA installability: manifest, icons, service worker', async ({ page, request }) => {
  await page.goto('http://localhost:4300/tech');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(`http://localhost:4300/${href}`)).json();
  expect(manifest.name).toBe('Il Arrive');
  expect(manifest.start_url).toBe('/tech');
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    expect((await request.get(`http://localhost:4300/${icon.src}`)).ok()).toBe(true);
  }
  const swReady = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(() => r(null), 40000))]);
    return !!reg;
  });
  expect(swReady).toBe(true);
});
