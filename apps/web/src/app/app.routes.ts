import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/placeholder.component').then(m => m.PlaceholderComponent),
  },
  {
    path: 'dev/ui',
    loadComponent: () => import('./pages/showcase.component').then(m => m.ShowcaseComponent),
  },
];
