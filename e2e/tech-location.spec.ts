import { test, expect } from '@playwright/test';

test.use({ permissions: ['geolocation'], geolocation: { latitude: 48.8566, longitude: 2.3522, accuracy: 20 } });

/** Test-only API stub (the PWA itself has no mock fallback): serves one SCHEDULED job and tracks its status. */
async function stubTechApi(page: import('@playwright/test').Page, onLocation: () => void) {
  let status = 'SCHEDULED';
  const row = () => ({
    id: 'int-002', customerId: 'c1', addressLabel: '4 av. Victor Hugo, Lyon', addressLat: 45.75, addressLng: 4.83,
    scheduledDate: new Date().toISOString(), windowStart: new Date().toISOString(), windowEnd: new Date(Date.now() + 3600e3).toISOString(),
    status, customer: { id: 'c1', name: 'Paul Bernard', phone: '0798765432' },
  });
  await page.route('**/api/tech/interventions/**', route => {
    const url = route.request().url();
    const m = route.request().method();
    if (url.endsWith('/location')) { onLocation(); return route.fulfill({ status: 202, json: {} }); }
    if (m === 'PATCH') {
      status = url.endsWith('/en-route') ? 'EN_ROUTE' : url.endsWith('/arrived') ? 'ARRIVED' : status;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { intervention: row(), timeline: [], customer: row().customer } });
  });
}

test('en route -> fixes posted -> arrived -> no more requests', async ({ page, context }) => {
  const posts: number[] = [];
  await stubTechApi(page, () => posts.push(Date.now()));

  await page.goto('/tech/i/int-002');
  await expect(page.getByText('Je suis en route')).toBeVisible();
  await page.getByRole('button', { name: 'Je suis en route' }).click();

  // consent explains scope before any permission prompt
  await expect(page.getByText('uniquement pendant ce trajet').first()).toBeVisible();
  await page.getByRole('button', { name: 'Partager ma position' }).click();

  await expect(page.getByText('Position partagée avec le client')).toBeVisible();
  await expect.poll(() => posts.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

  // move > 150 m -> a second fix is posted before the 20 s window
  await context.setGeolocation({ latitude: 48.8600, longitude: 2.3522, accuracy: 20 });
  await expect.poll(() => posts.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

  // touch targets >= 48px
  const box = await page.getByRole('button', { name: 'Je suis arrivé' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({ path: 'e2e/screenshots/en-route.png' });

  await page.getByRole('button', { name: 'Je suis arrivé' }).click();
  await expect(page.getByText('Position partagée avec le client')).toBeHidden();
  const countAtArrival = posts.length;
  await context.setGeolocation({ latitude: 48.87, longitude: 2.36, accuracy: 20 });
  await page.waitForTimeout(3000);
  expect(posts.length).toBe(countAtArrival);
  await page.screenshot({ path: 'e2e/screenshots/arrived.png' });
});

test('permission denied -> status-only notice', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: [] , viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await stubTechApi(page, () => undefined);
  await page.goto('http://localhost:4200/tech/i/int-002');
  await page.getByRole('button', { name: 'Je suis en route' }).click();
  await page.getByRole('button', { name: 'Partager ma position' }).click();
  await expect(page.getByText('sans la carte')).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});
