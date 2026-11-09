import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardApi } from './dashboard-api.service';
import { InterventionsStore } from './interventions.store';
import { groupToday } from './intervention-utils';
import { makeRow } from './testing';

describe('groupToday', () => {
  const now = new Date(2026, 10, 9, 10, 0);
  const at = (h: number) => new Date(2026, 10, 9, h, 0).toISOString();

  it('splits rows into En route / En retard / À venir / Terminées', () => {
    const rows = [
      makeRow({ id: 'a', status: 'EN_ROUTE' }),
      makeRow({ id: 'b', status: 'ARRIVED' }),
      makeRow({ id: 'c', status: 'SCHEDULED', windowStart: at(7), windowEnd: at(9) }), // window over
      makeRow({ id: 'd', status: 'SCHEDULED', windowStart: at(14), windowEnd: at(16), delayMinutes: 15 }),
      makeRow({ id: 'e', status: 'SCHEDULED', windowStart: at(14), windowEnd: at(16) }),
      makeRow({ id: 'f', status: 'COMPLETED' }),
      makeRow({ id: 'g', status: 'CANCELLED' }),
    ];
    const g = groupToday(rows, now);
    expect(g.enRoute.map((r) => r.id)).toEqual(['a', 'b']);
    expect(g.late.map((r) => r.id)).toEqual(['c', 'd']);
    expect(g.upcoming.map((r) => r.id)).toEqual(['e']);
    expect(g.done.map((r) => r.id)).toEqual(['f', 'g']);
  });
});

describe('InterventionsStore', () => {
  const api = {
    today: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    members: jest.fn(),
    assign: jest.fn(),
    cancel: jest.fn(),
    reschedule: jest.fn(),
  };
  let store: InterventionsStore;
  const row = makeRow({ id: 'i1' });

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: DashboardApi, useValue: api }] });
    store = TestBed.inject(InterventionsStore);
  });

  it('loads today and flattens the status groups', async () => {
    api.today.mockReturnValue(of([{ status: 'SCHEDULED', interventions: [row] }, { status: 'COMPLETED', interventions: [makeRow({ id: 'i2', status: 'COMPLETED' })] }]));
    await store.loadToday();
    expect(store.todayState()).toBe('ready');
    expect(store.todayRows().map((r) => r.id)).toEqual(['i1', 'i2']);
  });

  it('flags an error state when today fails', async () => {
    api.today.mockReturnValue(throwError(() => new Error('boom')));
    await store.loadToday();
    expect(store.todayState()).toBe('error');
  });

  it('passes filters to the list endpoint and keeps them', async () => {
    api.list.mockReturnValue(of([row]));
    await store.loadList({ status: 'EN_ROUTE', technicianId: 'm1' });
    expect(api.list).toHaveBeenCalledWith({ status: 'EN_ROUTE', technicianId: 'm1' });
    expect(store.filters()).toEqual({ status: 'EN_ROUTE', technicianId: 'm1' });
    expect(store.listRows()).toEqual([row]);
  });

  it('select() loads the detail and keeps customer from the list row', async () => {
    api.list.mockReturnValue(of([row]));
    await store.loadList({});
    api.get.mockReturnValue(of({ intervention: { ...row, customer: undefined, status: 'EN_ROUTE' }, timeline: [] }));
    await store.select('i1');
    expect(store.selected()?.status).toBe('EN_ROUTE');
    expect(store.selected()?.customer?.name).toBe('Marie Dupont');
    await store.select(null);
    expect(store.selected()).toBeNull();
  });

  it('only lists technicians as assignable', async () => {
    api.members.mockReturnValue(of([
      { membershipId: 'm1', userId: 'u1', email: 'a@x.fr', firstName: 'A', lastName: 'A', role: 'OWNER', isTechnician: false },
      { membershipId: 'm2', userId: 'u2', email: 'b@x.fr', firstName: 'B', lastName: 'B', role: 'TECHNICIAN', isTechnician: true },
      { membershipId: 'm3', userId: 'u3', email: 'c@x.fr', firstName: 'C', lastName: 'C', role: 'OWNER', isTechnician: true },
    ]));
    await store.loadMembers();
    expect(store.technicians().map((m) => m.membershipId)).toEqual(['m2', 'm3']);
  });

  it('act() refreshes the lists on success and exposes the error on failure', async () => {
    api.today.mockReturnValue(of([{ status: 'SCHEDULED', interventions: [row] }]));
    api.get.mockReturnValue(of({ intervention: row, timeline: [] }));
    store.selectedId.set('i1');
    api.cancel.mockReturnValue(of({}));
    expect(await store.cancel('no show')).toBe(true);
    expect(api.cancel).toHaveBeenCalledWith('i1', 'no show');
    expect(api.today).toHaveBeenCalled();

    api.assign.mockReturnValue(throwError(() => ({ error: { message: 'Technician not found' } })));
    expect(await store.assign('m9')).toBe(false);
    expect(store.panelError()).toBe('Technician not found');
  });

  it('reschedule forwards the new date and window', async () => {
    api.today.mockReturnValue(of([]));
    api.get.mockReturnValue(of({ intervention: row, timeline: [] }));
    api.reschedule.mockReturnValue(of({}));
    store.selectedId.set('i1');
    await store.reschedule('d', 's', 'e');
    expect(api.reschedule).toHaveBeenCalledWith('i1', { newScheduledDate: 'd', newWindowStart: 's', newWindowEnd: 'e' });
  });
});
