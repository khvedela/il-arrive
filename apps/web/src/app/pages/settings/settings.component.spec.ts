import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { DashboardApi } from '../../dashboard/dashboard-api.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  const api = { business: jest.fn(), smsUsage: jest.fn(), updateBusiness: jest.fn() };
  const auth = { activeMembership: () => ({ role: 'OWNER', plan: 'EQUIPE' }), bootstrap: jest.fn() };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  async function setup() {
    jest.resetAllMocks();
    api.business.mockReturnValue(of({ id: 'b', name: 'Plomberie Dupont', phone: '+33100000000', brandColor: '#112233', timezone: 'Europe/Paris', logoUrl: null, plan: 'EQUIPE', notificationPrefs: null }));
    api.smsUsage.mockReturnValue(of({ quota: 100, used: 40, remaining: 60, periodStart: '' }));
    auth.bootstrap.mockReturnValue(of({}));
    TestBed.configureTestingModule({ providers: [{ provide: DashboardApi, useValue: api }, { provide: AuthService, useValue: auth }] });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('loads branding and shows the SMS quota', async () => {
    const { cmp, el } = await setup();
    expect(cmp.name()).toBe('Plomberie Dupont');
    expect(el.querySelector('[data-testid="quota"]')?.textContent).toContain('40 / 100');
  });

  it('rejects an invalid brand colour and saves a valid one', async () => {
    const { cmp } = await setup();
    cmp.color.set('red');
    await cmp.save();
    expect(api.updateBusiness).not.toHaveBeenCalled();
    cmp.color.set('#abcdef');
    api.updateBusiness.mockReturnValue(of({}));
    await cmp.save();
    expect(api.updateBusiness).toHaveBeenCalledWith({ name: 'Plomberie Dupont', phone: '+33100000000', timezone: 'Europe/Paris', brandColor: '#abcdef' });
  });
});
