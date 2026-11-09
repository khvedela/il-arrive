import { test, expect, devices, type BrowserContext, type Page } from '@playwright/test';
import { Api, PASSWORD, URLS, db, inviteLinkFor, localDate, postFix, smsOutbox, uid } from './helpers';

/**
 * ARCHITECTURE §13 primary scenario against the real API + worker + Postgres + Redis + Mailpit (console SMS only).
 * Three browser contexts: owner dashboard (desktop), technician PWA (mobile, mocked geolocation), customer tracking page (no auth).
 * Every step is driven through the UI. Direct DB access is limited to (a) the SMS quota of the new TRIAL business (no billing UI in the MVP),
 * (b) the test "clock" (ETA/last-fix timestamps, so the test does not sleep 60-120 s), (c) reading back server state for assertions.
 * The only network stub is the external address geocoder (BAN) behind GET /api/geo/search.
 */
const WEB = 'http://127.0.0.1:4400';
const PARIS_FAR = { latitude: 48.8, longitude: 2.25, accuracy: 20 }; // ~9 km from the job
const PARIS_NEAR = { latitude: 48.8666, longitude: 2.3299, accuracy: 20 }; // ~300 m from the job

test.describe.serial('primary scenario (ARCHITECTURE §13)', () => {
  let ownerCtx: BrowserContext, techCtx: BrowserContext, customerCtx: BrowserContext;
  let owner: Api, tech: Api;
  let ownerPage: Page, techPage: Page, customerPage: Page;
  const suffix = uid();
  const businessName = `Plomberie Martin ${suffix}`;
  const ownerEmail = `owner-${suffix}@e2e.test`;
  const techEmail = `marc-${suffix}@e2e.test`;
  const customerPhone = '+33698765432';
  let businessId = '';
  let job = { id: '' };
  let smsLink = '';

  test.beforeAll(async ({ browser }) => {
    ownerCtx = await browser.newContext({ baseURL: WEB, permissions: ['clipboard-read', 'clipboard-write'] });
    techCtx = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: WEB,
      permissions: ['geolocation'],
      geolocation: PARIS_FAR,
    });
    customerCtx = await browser.newContext({ ...devices['Pixel 7'], baseURL: URLS.track }); // never authenticated
    owner = new Api(ownerCtx.request);
    tech = new Api(techCtx.request);
    ownerPage = await ownerCtx.newPage();
    techPage = await techCtx.newPage();
    customerPage = await customerCtx.newPage();
    // external geocoder (BAN) is not reachable/deterministic in CI: stub only GET /geo/search, everything else hits the real API
    await ownerPage.route('**/api/geo/search*', (route) =>
      route.fulfill({ json: [{ label: '12 rue de la Paix, 75002 Paris', lat: 48.8686, lng: 2.3316, score: 0.97 }] }),
    );
  });

  test.afterAll(async () => {
    await Promise.all([ownerCtx?.close(), techCtx?.close(), customerCtx?.close()]);
    await db.$disconnect();
  });

  test('1. owner registers a business through the register form and lands in the dashboard', async () => {
    await ownerPage.goto('/register');
    await ownerPage.getByLabel("Nom de l'entreprise").fill(businessName);
    await ownerPage.getByLabel('Prénom').fill('Jean');
    await ownerPage.getByLabel('Nom de famille').fill('Martin');
    await ownerPage.getByLabel('Email').fill(ownerEmail);
    await ownerPage.getByLabel('Téléphone').fill('+33612345678');
    await ownerPage.getByLabel('Mot de passe').fill(PASSWORD);
    await ownerPage.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(ownerPage).toHaveURL(/\/app/);
    const biz = await db.business.findFirstOrThrow({ where: { name: businessName } });
    businessId = biz.id;
    // A freshly registered TRIAL business has smsQuotaMonthly = 0 (-> quota_exceeded on every SMS); the dev seed uses 50, so do the same.
    await db.business.update({ where: { id: businessId }, data: { smsQuotaMonthly: 50 } });
  });

  test('1b. owner logs out and back in through the login form', async () => {
    await ownerCtx.clearCookies();
    await ownerPage.goto('/login');
    await ownerPage.getByLabel('Email').fill(ownerEmail);
    await ownerPage.getByLabel('Mot de passe').fill(PASSWORD);
    await ownerPage.getByRole('button', { name: 'Se connecter' }).click();
    await expect(ownerPage).toHaveURL(/\/app/);
  });

  test('2. owner invites technician Marc from the Team page; Marc accepts the emailed link on his phone and lands on /tech', async () => {
    await ownerPage.goto('/app/team');
    await ownerPage.getByLabel('Email').fill(techEmail);
    await ownerPage.getByLabel('Rôle').first().selectOption({ label: 'Technicien' }).catch(async () => {
      await ownerPage.getByRole('combobox', { name: 'Rôle' }).first().click();
      await ownerPage.getByRole('option', { name: 'Technicien' }).click();
    });
    await ownerPage.getByRole('button', { name: 'Inviter' }).click();
    await expect(ownerPage.getByText('Invitation envoyée')).toBeVisible();

    const link = await inviteLinkFor(techEmail);
    await techPage.goto(link);
    await techPage.getByLabel('Prénom').fill('Marc');
    await techPage.getByLabel('Nom de famille').fill('Durand');
    await techPage.getByLabel('Téléphone (optionnel)').fill('+33611223344');
    await techPage.getByLabel('Mot de passe').fill(PASSWORD);
    await techPage.getByRole('button', { name: "Accepter l'invitation" }).click();
    await expect(techPage).toHaveURL(/\/tech/, { timeout: 15_000 });
    await expect(techPage).not.toHaveURL(/\/app/);
  });

  test('3. owner creates today\'s intervention for a new customer (name, phone, address, window) and assigns Marc, all in the form', async () => {
    await ownerPage.goto('/app/interventions/new');
    await ownerPage.getByLabel('Nom du client').fill('Marie Dupont');
    await ownerPage.getByLabel('Téléphone du client').fill(customerPhone);
    await ownerPage.getByRole('combobox', { name: 'Adresse' }).fill('12 rue de la Paix');
    await ownerPage.getByRole('option', { name: /12 rue de la Paix, 75002 Paris/ }).click();
    await ownerPage.getByLabel('Date', { exact: true }).fill(localDate());
    await ownerPage.getByLabel('Créneau (début–fin)').fill('00:00');
    await ownerPage.locator('input[type="time"]').nth(1).fill('23:30');
    await ownerPage.getByLabel('Technicien').selectOption({ label: 'Marc Durand' }).catch(async () => {
      await ownerPage.getByRole('combobox', { name: 'Technicien' }).click();
      await ownerPage.getByRole('option', { name: 'Marc Durand' }).click();
    });
    await ownerPage.getByLabel('Description').fill('Fuite sous évier');
    await ownerPage.getByRole('button', { name: "Créer l'intervention" }).click();
    await expect(ownerPage).toHaveURL(/\/app\/interventions$/);
    await expect(ownerPage.getByText('Marie Dupont').first()).toBeVisible();

    const i = await db.intervention.findFirstOrThrow({ where: { businessId }, include: { customer: true } });
    job = { id: i.id };
    expect(i.status).toBe('SCHEDULED');
    expect(i.customer.phone).toBe(customerPhone);
    expect(i.technicianMembershipId).not.toBeNull();
    expect(i.addressLat).not.toBeNull();
  });

  test('4. technician opens the job from /tech, taps "Je suis en route", shares (mocked) location; exactly one EN_ROUTE SMS in the console outbox', async () => {
    await techPage.goto('/tech');
    await techPage.getByRole('link', { name: /MARIE DUPONT/i }).first().click();
    await expect(techPage).toHaveURL(new RegExp(`/tech/i/${job.id}`));
    await techPage.getByRole('button', { name: 'Je suis en route' }).click();
    await expect(techPage.getByText('uniquement pendant ce trajet').first()).toBeVisible();
    await techPage.getByRole('button', { name: 'Partager ma position' }).click();
    await expect(techPage.getByText('Position partagée avec le client')).toBeVisible();

    await expect
      .poll(async () => (await smsOutbox(owner, job.id)).filter((n) => n.kind === 'EN_ROUTE' && n.status === 'SENT').length, { timeout: 30_000 })
      .toBe(1);
    const [sms] = (await smsOutbox(owner, job.id)).filter((n) => n.kind === 'EN_ROUTE');
    expect(sms.provider).toBe('console');
    expect(sms.to).toBe(customerPhone);
    const m = sms.body.match(/https?:\/\/\S+\/t\/\S+/);
    expect(m, sms.body).not.toBeNull();
    smsLink = m![0];
  });

  test('5. customer opens the SMS link (fresh context, no auth): business, Marc, "Technicien en route", ETA, map card', async () => {
    await customerPage.goto(smsLink);
    await expect(customerPage.getByText('Technicien en route').first()).toBeVisible();
    await expect(customerPage.getByText('Marc', { exact: true })).toBeVisible();
    await expect(customerPage.getByText(`Technicien · Plomberie Martin ${suffix}`)).toBeVisible();
    await expect(customerPage.locator('.eta-hero__value')).not.toHaveText('—');
    await expect(customerPage.locator('.map-card')).toBeVisible();
    expect((await customerCtx.cookies()).filter((c) => /session|csrf/i.test(c.name))).toHaveLength(0);
  });

  test('6. Marc moves closer: ETA on the customer page updates over SSE without a reload', async () => {
    await customerPage.evaluate(() => ((window as unknown as { __noReload: number }).__noReload = 1));
    const before = await customerPage.locator('.eta-hero__meta').innerText();
    // test clock: the ETA recompute interval is 60 s; make the last computation "old" instead of sleeping
    await db.trackingSession.updateMany({ where: { interventionId: job.id }, data: { etaComputedAt: new Date(Date.now() - 120_000) } });
    await techCtx.setGeolocation(PARIS_NEAR);
    await expect.poll(async () => customerPage.locator('.eta-hero__meta').innerText(), { timeout: 45_000 }).not.toBe(before);
    expect(await customerPage.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
    const pub = await (await customerCtx.request.get(`${URLS.api}/public/track/${smsLink.split('/t/')[1]}`)).json();
    expect(pub.locationStatus).toBe('LIVE');
    // ETA jitter policy: a few minutes of ETA movement must not trigger extra SMS
    const sent = (await smsOutbox(owner, job.id)).filter((n) => n.status === 'SENT');
    expect(sent.map((n) => n.kind)).toEqual(['EN_ROUTE']);
  });

  test('7. location stops for > 120 s: stale message + last ETA with timestamp, no marker, no coordinates in the API', async () => {
    await techPage.getByRole('button', { name: 'Arrêter' }).click(); // Marc stops sharing; EN_ROUTE status stays
    await db.trackingSession.updateMany({ where: { interventionId: job.id }, data: { lastFixAt: new Date(Date.now() - 130_000) } });
    const token = smsLink.split('/t/')[1];
    await expect(customerPage.getByText(/Position non disponible depuis/)).toBeVisible({ timeout: 60_000 });
    await expect(customerPage.locator('.map-card')).toHaveCount(0);
    await expect(customerPage.locator('.eta-hero__value')).not.toHaveText('—');
    const pub = await (await customerCtx.request.get(`${URLS.api}/public/track/${token}`)).json();
    expect(pub.locationStatus).toBe('STALE');
    expect(pub.location.lat).toBeUndefined();
    expect(pub.location.lng).toBeUndefined();
    expect(pub.location.lastFixAt).toBeTruthy();
    expect(pub.eta).toBeTruthy();
  });

  test('8. Marc taps "Je suis arrivé": customer sees "Technicien arrivé" within 2 s; position no longer returned', async () => {
    await techPage.getByRole('button', { name: 'Je suis arrivé' }).click();
    await expect(customerPage.getByText('Technicien arrivé').first()).toBeVisible({ timeout: 2_000 + 500 });
    const pub = await (await customerCtx.request.get(`${URLS.api}/public/track/${smsLink.split('/t/')[1]}`)).json();
    expect(pub.status).toBe('ARRIVED');
    expect(pub.location).toBeUndefined();
    expect(JSON.stringify(pub)).not.toMatch(/"lat"|"lng"|latitude|longitude/i);
  });

  test('9. "Intervention terminée": session ended, link shows final state only, public payload has no coordinates', async () => {
    await techPage.getByRole('button', { name: 'Intervention terminée' }).click();
    await expect(customerPage.getByText('Terminé').first()).toBeVisible({ timeout: 10_000 });
    const raw = await (await customerCtx.request.get(`${URLS.api}/public/track/${smsLink.split('/t/')[1]}`)).text();
    const pub = JSON.parse(raw);
    expect(pub.status).toBe('COMPLETED');
    expect(raw).not.toMatch(/"lat"|"lng"|latitude|longitude|"location"/i);
    const session = await db.trackingSession.findUnique({ where: { interventionId: job.id } });
    expect(session?.endedAt).not.toBeNull();
    expect(session?.lastLat ?? null).toBeNull(); // last position purged with the session
    expect(session?.lastLng ?? null).toBeNull();
    // the technician can no longer send fixes
    const late = await postFix(tech, job.id, 48.86, 2.33);
    expect(late.status()).toBe(409);
    // still exactly one SMS for the whole journey
    expect((await smsOutbox(owner, job.id)).filter((n) => n.status === 'SENT').map((n) => n.kind)).toEqual(['EN_ROUTE']);
  });

  test('10. owner reloads the dashboard: the intervention is Terminé with its full timeline', async () => {
    await ownerPage.goto('/app/interventions');
    await ownerPage.getByText('Marie Dupont').first().click();
    await expect(ownerPage.getByText('Terminé').first()).toBeVisible();
    const full = await owner.json(await owner.get(`/interventions/${job.id}`));
    expect(full.intervention.status).toBe('COMPLETED');
    const types: string[] = full.timeline.map((e: { type: string }) => e.type);
    for (const t of ['intervention.created', 'intervention.assigned', 'intervention.en_route', 'intervention.arrived', 'intervention.completed']) {
      expect(types, JSON.stringify(types)).toContain(t);
    }
    const idx = (t: string) => types.indexOf(t);
    expect(idx('intervention.en_route')).toBeLessThan(idx('intervention.arrived'));
    expect(idx('intervention.arrived')).toBeLessThan(idx('intervention.completed'));
  });

  test('manual share: "Copier le lien" in the owner panel puts the tracking link on the clipboard (no SMS involved)', async () => {
    const before = (await smsOutbox(owner, job.id)).length;
    await ownerPage.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(ownerPage.getByText('Lien copié')).toBeVisible();
    const clip = await ownerPage.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/\/t\/\S+/);
    expect((await smsOutbox(owner, job.id)).length).toBe(before);
  });
});
