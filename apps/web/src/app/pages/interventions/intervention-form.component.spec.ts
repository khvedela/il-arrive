import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DashboardApi } from '../../dashboard/dashboard-api.service';
import { InterventionFormComponent, toCreateDto, validateForm, type FormValue } from './intervention-form.component';
import { makeRow } from '../../dashboard/testing';

const tomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const valid: FormValue = {
  name: 'Marie Dupont', phone: '+33612345678', address: '12 rue de la Paix, Paris',
  coordinates: { lat: 48.87, lng: 2.32 }, date: tomorrow, window: { start: '08:00', end: '12:00' },
};

describe('validateForm', () => {
  it('accepts a complete form', () => expect(validateForm(valid)).toEqual({}));

  it('requires name, E.164 phone, a geocoded address, date and ordered window', () => {
    const e = validateForm({ ...valid, name: ' ', phone: '0612', coordinates: null, date: '', window: { start: '12:00', end: '08:00' } });
    expect(Object.keys(e).sort()).toEqual(['address', 'date', 'name', 'phone', 'window']);
  });

  it('rejects a past date', () => {
    expect(validateForm({ ...valid, date: '2020-01-01' }).date).toBeDefined();
  });

  it('does not require customer fields when editing', () => {
    expect(validateForm({ ...valid, name: '', phone: '', coordinates: null }, new Date(), true)).toEqual({});
  });
});

describe('toCreateDto', () => {
  it('builds ISO instants from the local date and window', () => {
    const dto = toCreateDto('c1', valid, '  fuite  ');
    expect(dto).toMatchObject({ customerId: 'c1', addressLat: 48.87, addressLng: 2.32, description: 'fuite' });
    expect(new Date(dto.windowStart).getHours()).toBe(8);
    expect(new Date(dto.windowEnd).getHours()).toBe(12);
  });
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('InterventionFormComponent', () => {
  const api = {
    members: jest.fn(), searchCustomers: jest.fn(), createCustomer: jest.fn(), create: jest.fn(),
    assign: jest.fn(), get: jest.fn(), update: jest.fn(), reschedule: jest.fn(), geoSearch: jest.fn(),
  };
  let router: Router;

  async function setup(id?: string, prep?: () => void) {
    jest.resetAllMocks();
    prep?.();
    api.members.mockReturnValue(of([{ membershipId: 'm1', userId: 'u1', email: 't@x.fr', firstName: 'Tom', lastName: 'Tech', role: 'TECHNICIAN', isTechnician: true }]));
    TestBed.configureTestingModule({ providers: [{ provide: DashboardApi, useValue: api }, provideRouter([])] });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(InterventionFormComponent);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await fixture.whenStable();
    await flush();
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  function fill(cmp: InterventionFormComponent) {
    cmp.name.set(valid.name);
    cmp.phone.set(valid.phone);
    cmp.address.set(valid.address);
    cmp.coordinates.set(valid.coordinates);
    cmp.date.set(valid.date);
  }

  it('shows validation errors and does not call the API when invalid', async () => {
    const { cmp, fixture, el } = await setup();
    await cmp.submit();
    fixture.detectChanges();
    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Le nom du client est requis');
    expect(el.querySelector('[role="alert"], .ia-input__error')).not.toBeNull();
  });

  it('submits on form submit (Enter): creates the customer, the intervention, assigns the technician', async () => {
    const { cmp, el } = await setup();
    fill(cmp);
    cmp.technician.set('m1');
    cmp.description.set('fuite');
    api.searchCustomers.mockReturnValue(of([]));
    api.createCustomer.mockReturnValue(of({ id: 'c9', name: valid.name, phone: valid.phone }));
    api.create.mockReturnValue(of({ intervention: makeRow({ id: 'new1' }), trackingLink: { url: 'u' } }));
    api.assign.mockReturnValue(of({}));

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await flush();
    await flush();

    expect(api.createCustomer).toHaveBeenCalledWith({ name: 'Marie Dupont', phone: '+33612345678' });
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c9', addressLabel: valid.address, description: 'fuite' }));
    expect(api.assign).toHaveBeenCalledWith('new1', { technicianMembershipId: 'm1' });
    expect(router.navigate).toHaveBeenCalledWith(['/app/interventions']);
  });

  it('reuses an existing customer with the same phone', async () => {
    const { cmp } = await setup();
    fill(cmp);
    api.searchCustomers.mockReturnValue(of([{ id: 'c1', name: 'Marie', phone: valid.phone }]));
    api.create.mockReturnValue(of({ intervention: makeRow(), trackingLink: { url: 'u' } }));
    await cmp.submit();
    expect(api.createCustomer).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1' }));
    expect(api.assign).not.toHaveBeenCalled();
  });

  it('surfaces an API failure without navigating', async () => {
    const { cmp } = await setup();
    fill(cmp);
    api.searchCustomers.mockReturnValue(of([{ id: 'c1', name: 'M', phone: valid.phone }]));
    api.create.mockImplementation(() => { throw { error: { message: 'Customer not found' } }; });
    await cmp.submit();
    expect(cmp.submitError()).toBe('Customer not found');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('typing in the address field drops stale coordinates; picking a suggestion sets them', async () => {
    const { cmp } = await setup();
    (cmp as unknown as { onAddress: (a: unknown) => void }).onAddress({ label: 'X', lat: 1, lng: 2 });
    expect(cmp.coordinates()).toEqual({ lat: 1, lng: 2 });
    expect(cmp.address()).toBe('X');
  });

  it('edit mode prefills from the API and only sends what changed', async () => {
    const r = makeRow({ id: 'e1', description: 'old', technicianMembershipId: null });
    const { cmp } = await setup('e1', () => api.get.mockReturnValue(of({ intervention: r, timeline: [] })));
    expect(cmp.editing()).toBe(true);
    expect(cmp.address()).toBe(r.addressLabel);
    api.update.mockReturnValue(of({}));
    api.assign.mockReturnValue(of({}));
    cmp.description.set('new');
    cmp.technician.set('m1');
    cmp.date.set(tomorrow);
    api.reschedule.mockReturnValue(of({}));
    await cmp.submit();
    expect(api.reschedule).toHaveBeenCalled();
    expect(api.createCustomer).not.toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('e1', { description: 'new' });
    expect(api.assign).toHaveBeenCalledWith('e1', { technicianMembershipId: 'm1' });
    expect(router.navigate).toHaveBeenCalled();
  });
});
