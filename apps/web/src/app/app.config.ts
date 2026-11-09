import { EnvironmentProviders, Provider, provideZoneChangeDetection } from '@angular/core';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';
import { routes } from './app.routes';
import { AuthHttpInterceptor } from './core/auth-api.service';

export const appConfig: { providers: (Provider | EnvironmentProviders)[] } = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true },
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
