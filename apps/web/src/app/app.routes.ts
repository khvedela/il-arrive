import { Routes } from '@angular/router';
import { authGuard, notTechnicianGuard, redirectIfAuthedGuard } from './core/auth.guard';

export const routes: Routes = [
  // Auth pages (redirect if already authenticated)
  {
    path: 'login',
    canActivate: [redirectIfAuthedGuard],
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [redirectIfAuthedGuard],
    loadComponent: () => import('./pages/auth/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [redirectIfAuthedGuard],
    loadComponent: () => import('./pages/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password/:token',
    canActivate: [redirectIfAuthedGuard],
    loadComponent: () => import('./pages/auth/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'accept-invitation/:token',
    canActivate: [redirectIfAuthedGuard],
    loadComponent: () => import('./pages/auth/accept-invitation.component').then(m => m.AcceptInvitationComponent),
  },

  // Dashboard shell (protected)
  {
    path: 'app',
    canActivate: [authGuard, notTechnicianGuard],
    loadComponent: () => import('./layouts/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/today/today.component').then(m => m.TodayComponent),
      },
      {
        path: 'interventions',
        loadComponent: () => import('./pages/interventions/interventions.component').then(m => m.InterventionsComponent),
      },
      {
        path: 'interventions/new',
        loadComponent: () => import('./pages/interventions/intervention-form.component').then(m => m.InterventionFormComponent),
      },
      {
        path: 'interventions/:id/edit',
        loadComponent: () => import('./pages/interventions/intervention-form.component').then(m => m.InterventionFormComponent),
      },
      {
        path: 'team',
        loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },

  // Dev UI showcase (keep for testing)
  {
    path: 'dev/ui',
    loadComponent: () => import('./pages/showcase.component').then(m => m.ShowcaseComponent),
  },
  {
    path: 'tech',
    canActivate: [authGuard],
    loadComponent: () => import('./tech/pages/tech-today.component').then(m => m.TechTodayComponent),
  },
  {
    path: 'tech/i/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./tech/pages/tech-intervention-detail.component').then(m => m.TechInterventionDetailComponent),
  },

  // Default redirect
  {
    path: '',
    loadComponent: () => import('./pages/placeholder.component').then(m => m.PlaceholderComponent),
  },
];
