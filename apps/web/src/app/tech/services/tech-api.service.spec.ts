import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import {
  TechApi,
  TechApiService,
  ACTION_TO_STATUS,
  VALID_TRANSITIONS,
  toTechIntervention,
  type ApiIntervention,
} from './tech-api.service';

const row: ApiIntervention = {
  id: 'i1',
  customerId: 'c1',
  addressLabel: '12 rue de la Paix, Paris',
  addressLat: 48.87,
  addressLng: 2.32,
  scheduledDate: '2026-11-09T00:00:00.000Z',
  windowStart: new Date(2026, 10, 9, 8, 0).toISOString(),
  windowEnd: new Date(2026, 10, 9, 12, 0).toISOString(),
  status: IS.SCHEDULED,
  description: null,
  delayMinutes: null,
  customer: { id: 'c1', name: 'Marie Dupont', phone: '0612345678' },
};

describe('toTechIntervention', () => {
  it('maps the API row and customer, formats the window in local time', () => {
    const m = toTechIntervention(row);
    expect(m).toMatchObject({
      id: 'i1',
      customerName: 'Marie Dupont',
      customerPhone: '0612345678',
      windowStart: '08:00',
      windowEnd: '12:00',
      scheduledDate: '2026-11-09',
      lat: 48.87,
    });
    expect(m.delayMinutes).toBeUndefined();
    expect(m.description).toBeUndefined();
  });

  it('derives the delay ETA from windowEnd + delayMinutes', () => {
    const m = toTechIntervention({ ...row, delayMinutes: 30, delayReason: 'Traffic' });
    expect(m).toMatchObject({ delayMinutes: 30, delayReason: 'Traffic', delayEta: '12:30' });
  });
});

describe('transition tables', () => {
  it('has no technician cancel action', () => {
    expect(Object.keys(ACTION_TO_STATUS)).toEqual(['en_route', 'arrived', 'complete', 'stop_route']);
    expect(VALID_TRANSITIONS[IS.SCHEDULED]).toEqual(['en_route']);
    expect(VALID_TRANSITIONS[IS.EN_ROUTE]).toEqual(['arrived', 'stop_route']);
    expect(VALID_TRANSITIONS[IS.ARRIVED]).toEqual(['complete']);
    expect(VALID_TRANSITIONS[IS.COMPLETED]).toEqual([]);
  });
});

describe('TechApi / TechApiService over HTTP', () => {
  let http: HttpTestingController;
  let api: TechApi;
  let service: TechApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TechApi);
    service = TestBed.inject(TechApiService);
  });

  afterEach(() => http.verify());

  it('fetchToday GETs /api/tech/interventions/today and maps rows', async () => {
    const p = firstValueFrom(service.fetchToday());
    http.expectOne('/api/tech/interventions/today').flush({ date: '2026-11-09', interventions: [row] });
    const res = await p;
    expect(res.date).toBe('2026-11-09');
    expect(res.interventions[0].customerName).toBe('Marie Dupont');
  });

  it('fetchIntervention uses the detail customer', async () => {
    const p = firstValueFrom(service.fetchIntervention('i1'));
    http.expectOne('/api/tech/interventions/i1').flush({ intervention: { ...row, customer: undefined }, timeline: [], customer: row.customer });
    expect((await p).customerName).toBe('Marie Dupont');
  });

  it('performAction PATCHes (204, no body) then re-reads server state', async () => {
    const p = firstValueFrom(service.performAction('i1', 'en_route'));
    const patch = http.expectOne('/api/tech/interventions/i1/en-route');
    expect(patch.request.method).toBe('PATCH');
    patch.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/tech/interventions/i1').flush({ intervention: { ...row, status: IS.EN_ROUTE }, customer: row.customer });
    const res = await p;
    expect(res.success).toBe(true);
    expect(res.intervention?.status).toBe(IS.EN_ROUTE);
  });

  it.each([
    ['arrived', 'arrived'],
    ['complete', 'complete'],
    ['stop_route', 'stop'],
  ] as const)('%s maps to PATCH .../%s', async (action, path) => {
    const p = firstValueFrom(service.performAction('i1', action));
    http.expectOne(`/api/tech/interventions/i1/${path}`).flush(null, { status: 409, statusText: 'Conflict' });
    const res = await p;
    expect(res).toMatchObject({ success: false, rolledBack: true });
  });

  it('reportDelay PATCHes delay body then re-reads', async () => {
    const p = firstValueFrom(service.reportDelay('i1', 15, 'Traffic'));
    const patch = http.expectOne('/api/tech/interventions/i1/delay');
    expect(patch.request.body).toEqual({ delayMinutes: 15, delayReason: 'Traffic' });
    patch.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/tech/interventions/i1').flush({
      intervention: { ...row, delayMinutes: 15, delayReason: 'Traffic' },
      customer: row.customer,
    });
    expect((await p).intervention?.delayEta).toBe('12:15');
  });

  describe('sendLocation', () => {
    const fix = { lat: 1, lng: 2, accuracy: 10, timestamp: Date.UTC(2026, 10, 9, 10, 0, 0) };

    it('POSTs an ISO timestamp and resolves ok on 202', async () => {
      const p = api.sendLocation('i1', fix);
      const req = http.expectOne('/api/tech/interventions/i1/location');
      expect(req.request.body).toEqual({ lat: 1, lng: 2, accuracy: 10, timestamp: '2026-11-09T10:00:00.000Z' });
      req.flush({}, { status: 202, statusText: 'Accepted' });
      expect(await p).toBe('ok');
    });

    it('resolves conflict on 409', async () => {
      const p = api.sendLocation('i1', fix);
      http.expectOne('/api/tech/interventions/i1/location').flush({}, { status: 409, statusText: 'Conflict' });
      expect(await p).toBe('conflict');
    });

    it.each([404, 500])('resolves error (not conflict) on %s', async status => {
      const p = api.sendLocation('i1', fix);
      http.expectOne('/api/tech/interventions/i1/location').flush({}, { status, statusText: 'x' });
      expect(await p).toBe('error');
    });
  });
});
