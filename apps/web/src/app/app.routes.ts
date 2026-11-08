import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/placeholder.component').then(m => m.PlaceholderComponent),
  },
];
