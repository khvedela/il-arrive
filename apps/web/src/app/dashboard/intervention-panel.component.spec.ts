import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DashboardApi } from './dashboard-api.service';
import { InterventionsStore } from './interventions.store';
import { InterventionPanelComponent } from './intervention-panel.component';
import { makeRow } from './testing';

describe('InterventionPanelComponent', () => {
  const api = {
    get: jest.fn(), today: jest.fn(), list: jest.fn(), members: jest.fn(),
    shareMessage: jest.fn(), sendSms: jest.fn(), regenerateLink: jest.fn(),
    assign: jest.fn(), cancel: jest.fn(), reschedule: jest.fn(),
  };
  const row = makeRow({ id: 'i1' });

  async function setup(r = row) {
    jest.resetAllMocks();
    api.get.mockReturnValue(of({ intervention: r, timeline: [{ id: 'e1', type: 'intervention.created', createdAt: r.windowStart, payload: null }] }));
    api.today.mockReturnValue(of([{ status: r.status, interventions: [r] }]));
    api.list.mockReturnValue(of([r]));
    TestBed.configureTestingModule({ providers: [{ provide: DashboardApi, useValue: api }, provideRouter([])] });
    const store = TestBed.inject(InterventionsStore);
    store.todayRows.set([r]);
    store.members.set([{ membershipId: 'm1', userId: 'u1', email: 't@x.fr', firstName: 'Tom', lastName: 'Tech', role: 'TECHNICIAN', isTechnician: true }]);
    await store.select(r.id);
    const fixture = TestBed.createComponent(InterventionPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows customer, address, timeline and a French action set', async () => {
    const { el } = await setup();
    const text = el.textContent ?? '';
    expect(text).toContain('Marie Dupont');
    expect(text).toContain('12 rue de la Paix');
    expect(text).toContain('Intervention créée');
    expect(text).toContain('Copier le lien');
    expect(text).toContain('Réassigner');
  });

  it('hides mutating actions once cancelled', async () => {
    const { el } = await setup(makeRow({ status: 'CANCELLED' }));
    const text = el.textContent ?? '';
    expect(text).not.toContain('Réassigner');
    expect(text).not.toContain('Reprogrammer');
  });

  it('copies the tracking link from the share-message endpoint', async () => {
    const { cmp } = await setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    api.shareMessage.mockReturnValue(of({ text: 'hi', link: 'https://t/x', smsUri: 'sms:' }));
    await cmp.copyLink();
    expect(api.shareMessage).toHaveBeenCalledWith('i1');
    expect(writeText).toHaveBeenCalledWith('https://t/x');
  });

  it('sends an SMS and regenerates the link (new URL shown once)', async () => {
    const { cmp, fixture, el } = await setup();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    api.sendSms.mockReturnValue(of({}));
    await cmp.sendSms();
    expect(api.sendSms).toHaveBeenCalledWith('i1', 'CONFIRMATION');
    api.regenerateLink.mockReturnValue(of({ url: 'https://t/new', expiresAt: '' }));
    await cmp.regenerate();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="new-link"]')?.textContent).toContain('https://t/new');
  });

  it('reassigns, reschedules and cancels through the store', async () => {
    const { cmp, store } = await setup();
    api.assign.mockReturnValue(of({}));
    cmp.techChoice.set('m1');
    await cmp.assign();
    expect(api.assign).toHaveBeenCalledWith('i1', { technicianMembershipId: 'm1' });

    api.reschedule.mockReturnValue(of({}));
    cmp.newDate.set('2026-12-01');
    cmp.newWindow.set({ start: '13:00', end: '18:00' });
    await cmp.reschedule();
    const [id, body] = api.reschedule.mock.calls[0];
    expect(id).toBe('i1');
    expect(new Date(body.newWindowStart).getHours()).toBe(13);
    expect(new Date(body.newWindowEnd).getHours()).toBe(18);

    api.cancel.mockReturnValue(of({}));
    cmp.reason.set('client absent');
    await cmp.cancel();
    expect(api.cancel).toHaveBeenCalledWith('i1', 'client absent');
    expect(store.panelError()).toBeNull();
  });

  it('closing clears the selection', async () => {
    const { cmp, store } = await setup();
    cmp.close();
    expect(store.selectedId()).toBeNull();
  });

  it('edit() navigates to the edit form', async () => {
    const { cmp } = await setup();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    cmp.edit();
    expect(nav).toHaveBeenCalledWith(['/app/interventions', 'i1', 'edit']);
  });
});
