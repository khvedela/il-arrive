import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthApi, AcceptInvitationResponse } from './auth-api.service';
import { MeResponse, MeUser, MeMembership } from '@il-arrive/contracts';

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
  let router: any;

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
    router = TestBed.inject(Router) as any;
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

  it('register should set me and navigate to /onboarding', () => {
    const mockApi = TestBed.inject(AuthApi) as unknown as MockAuthApi;
    mockApi.register.mockReturnValue(of({}));
    mockApi.getMe.mockReturnValue(of(mockMe));

    service.register({ email: 'test@test.com', password: 'password', firstName: 'Test', lastName: 'User', businessName: 'Business', phone: '0612345678' }).subscribe();
    expect(service.isAuthenticated()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
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
