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
  {
    path: 'tech',
    loadComponent: () => import('./tech/pages/tech-today.component').then(m => m.TechTodayComponent),
  },
  {
    path: 'tech/i/:id',
    loadComponent: () => import('./tech/pages/tech-intervention-detail.component').then(m => m.TechInterventionDetailComponent),
  },
];
