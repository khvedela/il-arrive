import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 't/:token',
    loadComponent: () => import('./pages/track-page/track-page.component').then(m => m.TrackPageComponent),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found.component').then(m => m.NotFoundComponent),
  },
];
