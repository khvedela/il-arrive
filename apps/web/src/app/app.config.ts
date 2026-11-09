import { EnvironmentProviders, Provider, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';
import { routes } from './app.routes';
import { AuthHttpInterceptor } from './core/auth-api.service';
import { AuthService } from './core/auth.service';

/** Restore the session before the first navigation so guards see the real auth state. */
export function restoreSession(auth: Pick<AuthService, 'bootstrap'>, pathname: string): Promise<unknown> {
  // The technician PWA (/tech) runs on its own mock API and must not trigger the dashboard auth bootstrap.
  if (pathname.startsWith('/tech')) return Promise.resolve();
  return firstValueFrom(auth.bootstrap()).catch(() => undefined);
}

export const appConfig: { providers: (Provider | EnvironmentProviders)[] } = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAppInitializer(() => restoreSession(inject(AuthService), location.pathname)),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true },
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
