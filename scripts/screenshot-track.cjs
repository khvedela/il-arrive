const { chromium } = require('../apps/track/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:4201';
const TOKENS = {
  confirmed: 'confirmed-abc123',
  planned_today: 'planned-today-def456',
  en_route_live: 'enroute-live-ghi789',
  en_route_stale: 'enroute-stale-jkl012',
  delay: 'delay-mno345',
  arrived: 'arrived-pqr678',
  completed: 'completed-stu901',
  cancelled: 'cancelled-vwx234',
  rescheduled: 'rescheduled-yza567',
};

const EVIDENCE_DIR = path.join(__dirname, '..', 'apps', 'track', 'evidence');

(async () => {
  const browser = await chromium.launch();
  const dir = EVIDENCE_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const [state, token] of Object.entries(TOKENS)) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/t/' + token + '?mock=1');
    await page.waitForSelector('.track-page', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, `track-${state}.png`), fullPage: true });
    console.log(`✓ ${state}: ${path.join(dir, `track-${state}.png`)}`);
    await page.close();
  }

  // Desktop viewport for a couple states
  for (const state of ['en_route_live', 'arrived', 'confirmed']) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + '/t/' + TOKENS[state]);
    await page.waitForSelector('.track-page', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, `track-${state}-desktop.png`), fullPage: true });
    console.log(`✓ ${state}-desktop: ${path.join(dir, `track-${state}-desktop.png`)}`);
    await page.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to', dir);
})().catch(err => { console.error(err); process.exit(1); });
