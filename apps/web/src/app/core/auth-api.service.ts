import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import {
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto,
  MeResponse,
  LoginResponse,
  RegisterResponse,
} from '@il-arrive/contracts';

const API_URL = '/api';

export function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

@Injectable()
export class AuthHttpInterceptor implements HttpInterceptor {
  private router = inject(Router);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const csrf = getCsrfToken();
    const apiReq = req.clone({
      withCredentials: true,
      setHeaders: csrf ? { 'X-CSRF-Token': csrf } : {},
    });

    return next.handle(apiReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // /auth/me is the session probe (guards handle it); sms-usage 401s on a notification-only guard (SLA-47)
        // and must not log the user out — Settings degrades gracefully instead.
        const isAuthCall = /\/auth\/(login|register|reset-password|accept-invitation|me)|\/business\/sms-usage/.test(req.url);
        if (err.status === 401 && !isAuthCall) {
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      }),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private url = API_URL;

  login(dto: LoginDto): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.url}/auth/login`, dto);
  }

  register(dto: RegisterDto): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.url}/auth/register`, dto);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/auth/logout`, {});
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.url}/auth/me`);
  }

  requestPasswordReset(dto: RequestPasswordResetDto): Observable<void> {
    return this.http.post<void>(`${this.url}/auth/forgot-password`, dto);
  }

  resetPassword(dto: ResetPasswordDto): Observable<void> {
    return this.http.post<void>(`${this.url}/auth/reset-password`, dto);
  }

  changePassword(dto: ChangePasswordDto): Observable<void> {
    return this.http.patch<void>(`${this.url}/auth/password`, dto);
  }

  acceptInvitation(params: { token: string; password: string; firstName: string; lastName: string; phone?: string }): Observable<AcceptInvitationResponse> {
    return this.http.post<AcceptInvitationResponse>(`${this.url}/auth/accept-invitation`, params);
  }
}

export interface AcceptInvitationResponse {
  userId: string;
  businessId: string;
  role: string;
}
