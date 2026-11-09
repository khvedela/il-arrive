import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { Router } from '@angular/router';


import { AuthService, homeRouteFor } from './auth.service';
import { authGuard, notTechnicianGuard } from './auth.guard';
import { restoreSession } from '../app.config';
import { AuthApi } from './auth-api.service';
import { MeResponse } from '@il-arrive/contracts';

const mockMe: MeResponse = {
  user: { id: 'u1', email: 'test@test.com', firstName: 'Test', lastName: 'User', phone: '0612345678', avatarUrl: null },
  memberships: [{
    id: 'm1', businessId: 'b1', name: 'Test Business', slug: 'test-business',
    logoUrl: null, phone: '0123456789', brandColor: null, plan: 'trial',
    role: 'OWNER', isTechnician: true, onboardingCompleted: false,
  }],
  activeBusinessId: 'b1',
  activeMembership: {
    id: 'm1', businessId: 'b1', name: 'Test Business', slug: 'test-business',
    logoUrl: null, phone: '0123456789', brandColor: null, plan: 'trial',
    role: 'OWNER', isTechnician: true, onboardingCompleted: false,
  },
};

class MockAuthApi {
  login = jest.fn().mockReturnValue(NEVER);
  register = jest.fn().mockReturnValue(NEVER);
  logout = jest.fn().mockReturnValue(NEVER);
  getMe = jest.fn().mockReturnValue(NEVER);
  requestPasswordReset = jest.fn().mockReturnValue(NEVER);
  resetPassword = jest.fn().mockReturnValue(NEVER);
  acceptInvitation = jest.fn().mockReturnValue(NEVER);
}

describe('AuthService', () => {
  let service: AuthService;
  let router: { navigate: jest.Mock };

  beforeEach(() => {
    const routerSpy = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthApi, useClass: MockAuthApi },
        { provide: Router, useValue: routerSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    router = TestBed.inject(Router) as unknown as typeof router;
  });

  it('should start unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.activeMembership()).toBeNull();
  });

  it('bootstrap should set me on success', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.getMe.mockReturnValue(of(mockMe));

    service.bootstrap().subscribe();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('test@test.com');
    expect(service.activeMembership()?.name).toBe('Test Business');
  });

  it('login should set me and navigate to /app', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.login.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of(mockMe));

    service.login({ email: 'test@test.com', password: 'password' }).subscribe();
    expect(service.isAuthenticated()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/app']);
  });

  it('register should set me and navigate to /app', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.register.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of(mockMe));

    service.register({ email: 'test@test.com', password: 'password', firstName: 'Test', lastName: 'User', businessName: 'Business', phone: '0612345678' }).subscribe();
    expect(service.isAuthenticated()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/app']);
  });


  const techMe: MeResponse = {
    ...mockMe,
    activeMembership: { ...mockMe.activeMembership, role: 'TECHNICIAN' },
    memberships: [{ ...mockMe.memberships[0], role: 'TECHNICIAN' }],
  };

  it('homeRouteFor routes by role', () => {
    expect(homeRouteFor('TECHNICIAN')).toBe('/tech');
    expect(homeRouteFor('OWNER')).toBe('/app');
    expect(homeRouteFor('DISPATCHER')).toBe('/app');
  });

  it('login as technician navigates to /tech', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.login.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of(techMe));
    service.login({ email: 'a@b.c', password: 'password' }).subscribe();
    expect(router.navigate).toHaveBeenCalledWith(['/tech']);
  });

  it('acceptInvitation as technician navigates to /tech and exposes homeRoute', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.acceptInvitation.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of(techMe));
    service.acceptInvitation({ token: 't', password: 'password', firstName: 'A', lastName: 'B' }).subscribe();
    expect(router.navigate).toHaveBeenCalledWith(['/tech']);
    expect(service.homeRoute()).toBe('/tech');
  });

  it('acceptInvitation as dispatcher navigates to /app', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.acceptInvitation.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of({ ...mockMe, activeMembership: { ...mockMe.activeMembership, role: 'DISPATCHER' } }));
    service.acceptInvitation({ token: 't', password: 'password', firstName: 'A', lastName: 'B' }).subscribe();
    expect(router.navigate).toHaveBeenCalledWith(['/app']);
  });

  it('notTechnicianGuard redirects technicians to /tech and lets owners through', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.getMe.mockReturnValue(of(techMe));
    service.bootstrap().subscribe();
    expect(TestBed.runInInjectionContext(() => notTechnicianGuard({} as never, {} as never))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/tech']);

    mockApi.getMe.mockReturnValue(of(mockMe));
    service.bootstrap().subscribe();
    expect(TestBed.runInInjectionContext(() => notTechnicianGuard({} as never, {} as never))).toBe(true);
  });

  it('cold /tech: authGuard passes after session restore, redirects to /login without one', async () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.getMe.mockReturnValue(of(techMe));
    await restoreSession(service);
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(true);

    service['_me'].set(null);
    mockApi.getMe.mockReturnValue(throwError(() => ({ status: 401 })));
    await restoreSession(service);
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout should clear me and navigate to /login', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.getMe.mockReturnValue(of(mockMe));
    service.bootstrap().subscribe();
    expect(service.isAuthenticated()).toBe(true);

    mockApi.logout.mockReturnValue(of(undefined));
    service.logout().subscribe();
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
