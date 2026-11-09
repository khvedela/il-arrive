import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, of, throwError } from 'rxjs';
import { mergeMap, tap, finalize } from 'rxjs/operators';
import { AuthApi, AcceptInvitationResponse } from './auth-api.service';
import { MeResponse, MeUser, MeMembership, LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto } from '@il-arrive/contracts';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authApi = inject(AuthApi);
  private router = inject(Router);

  private _me = signal<MeResponse | null>(null);
  private _loading = signal(false);

  me = computed<MeResponse | null>(() => this._me());
  user = computed<MeUser | null>(() => this._me()?.user ?? null);
  activeMembership = computed<MeMembership | null>(() => this._me()?.activeMembership ?? null);
  isAuthenticated = computed(() => !!this._me());
  isLoading = computed(() => this._loading());

  onBootstrap = effect(() => {
    const me = this._me();
    if (me && !me.activeMembership.onboardingCompleted) {
      // Navigate to onboarding if not completed
    }
  });

  bootstrap(): Observable<unknown> {
    this._loading.set(true);
    return this.authApi.getMe().pipe(
      tap((me) => this._me.set(me)),
      finalize(() => this._loading.set(false)),
    );
  }

  login(dto: LoginDto): Observable<MeResponse> {
    return this.authApi.login(dto).pipe(
      mergeMap(() => this.authApi.getMe()),
      tap((me) => {
        this._me.set(me);
        this.router.navigate(['/app']);
      }),
    );
  }

  register(dto: RegisterDto): Observable<MeResponse> {
    return this.authApi.register(dto).pipe(
      mergeMap(() => this.authApi.getMe()),
      tap((me) => {
        this._me.set(me);
        this.router.navigate(['/onboarding']);
      }),
    );
  }

  logout(): Observable<void> {
    return this.authApi.logout().pipe(
      tap(() => {
        this._me.set(null);
        this.router.navigate(['/login']);
      }),
    );
  }

  requestPasswordReset(dto: RequestPasswordResetDto): Observable<void> {
    return this.authApi.requestPasswordReset(dto);
  }

  resetPassword(dto: ResetPasswordDto): Observable<void> {
    return this.authApi.resetPassword(dto).pipe(
      tap(() => this.router.navigate(['/login'])),
    );
  }

  acceptInvitation(params: { token: string; password: string; firstName: string; lastName: string; phone?: string }): Observable<MeResponse> {
    return this.authApi.acceptInvitation(params).pipe(
      mergeMap(() => this.authApi.getMe()),
      tap((me) => {
        this._me.set(me);
        this.router.navigate(['/app']);
      }),
    );
  }
}
