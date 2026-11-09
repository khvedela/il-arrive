import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthApi, AcceptInvitationResponse, AuthHttpInterceptor } from './auth-api.service';
import { LoginDto, RegisterDto, MeResponse, LoginResponse, RegisterResponse } from '@il-arrive/contracts';

const API_URL = '/api';

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

describe('AuthApi', () => {
  let api: AuthApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApi,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
    api = TestBed.inject(AuthApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should login and return response', () => {
    const dto: LoginDto = { email: 'test@test.com', password: 'password' };
    const mockLogin: LoginResponse = {
      user: mockMe.user,
      memberships: mockMe.memberships,
      activeBusinessId: 'b1',
    };

    api.login(dto).subscribe((res) => {
      expect(res).toEqual(mockLogin);
    });

    const req = httpMock.expectOne(`${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.withCredentials).toBe(true);
    req.flush(mockLogin);
  });

  it('should register and return response', () => {
    const dto: RegisterDto = { email: 'test@test.com', password: 'password', firstName: 'Test', lastName: 'User', businessName: 'Test Business', phone: '0612345678' };
    const mockRegister: RegisterResponse = {
      user: mockMe.user,
      memberships: mockMe.memberships,
      activeBusinessId: 'b1',
    };

    api.register(dto).subscribe((res) => {
      expect(res).toEqual(mockRegister);
    });

    const req = httpMock.expectOne(`${API_URL}/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush(mockRegister);
  });

  it('should get me', () => {
    api.getMe().subscribe((res) => {
      expect(res).toEqual(mockMe);
    });

    const req = httpMock.expectOne(`${API_URL}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMe);
  });

  it('should logout', () => {
    api.logout().subscribe((res) => {
      expect(res).toBeUndefined();
    });

    const req = httpMock.expectOne(`${API_URL}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('adds CSRF header from cookie and redirects to /login on 401', () => {
    document.cookie = 'csrf_token=abc123';
    api.getMe().subscribe({ error: () => undefined });
    const req = httpMock.expectOne(`${API_URL}/auth/me`);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('abc123');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('does not redirect on 401 from /auth/login', () => {
    api.login({ email: 'a@b.c', password: 'x' }).subscribe({ error: () => undefined });
    httpMock.expectOne(`${API_URL}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
});
