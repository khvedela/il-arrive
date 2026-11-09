import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IaUIModule } from '@il-arrive/ui';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IaUIModule],
  template: `
    <div class="shell">
      <aside class="shell__sidebar">
        <div class="shell__brand">
          @if (auth.activeMembership()?.logoUrl) {
            <img [src]="auth.activeMembership()!.logoUrl" [alt]="auth.activeMembership()!.name" class="shell__logo" />
          } @else {
            <div class="shell__logo-fallback">{{ auth.activeMembership()?.name?.[0] ?? 'IA' }}</div>
          }
          <span class="shell__brand-name">{{ auth.activeMembership()?.name ?? 'Il Arrive' }}</span>
        </div>

        <nav class="shell__nav" aria-label="Navigation principale">
          <a routerLink="/app" routerLinkActive="shell__nav-item--active" [routerLinkActiveOptions]="{exact: true}" class="shell__nav-item">
            <span class="shell__nav-icon">📅</span>
            <span>Aujourd'hui</span>
          </a>
          <a routerLink="/app/interventions" routerLinkActive="shell__nav-item--active" class="shell__nav-item">
            <span class="shell__nav-icon">📋</span>
            <span>Interventions</span>
          </a>
          <a routerLink="/app/team" routerLinkActive="shell__nav-item--active" class="shell__nav-item">
            <span class="shell__nav-icon">👥</span>
            <span>Équipe</span>
          </a>
          <a routerLink="/app/settings" routerLinkActive="shell__nav-item--active" class="shell__nav-item">
            <span class="shell__nav-icon">⚙️</span>
            <span>Paramètres</span>
          </a>
        </nav>

        <div class="shell__footer">
          <span class="shell__plan">{{ auth.activeMembership()?.plan ?? 'Essai' }}</span>
        </div>
      </aside>

      <main class="shell__content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }

    .shell {
      display: flex;
      min-height: 100vh;
    }

    .shell__sidebar {
      width: var(--app-sidebar-w);
      flex-shrink: 0;
      background: var(--color-surface);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
    }

    .shell__brand {
      height: 56px;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .shell__logo {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      object-fit: cover;
    }

    .shell__logo-fallback {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-muted);
    }

    .shell__brand-name {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .shell__nav {
      flex: 1;
      padding: var(--space-3) 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .shell__nav-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--font-weight-regular);
      border-left: 3px solid transparent;
      transition: background-color var(--motion-fast) var(--ease-out),
                  color var(--motion-fast) var(--ease-out);
      min-height: var(--touch-target-min);
    }

    .shell__nav-item:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    .shell__nav-item--active {
      background: var(--color-surface-muted);
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
      border-left-color: var(--color-ink);
    }

    .shell__nav-icon {
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .shell__footer {
      padding: var(--space-4);
      border-top: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .shell__plan {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .shell__content {
      flex: 1;
      min-width: 0;
      max-width: var(--app-content-max);
      margin: 0 auto;
      padding: var(--space-8);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  authService = inject(AuthService);

  auth = this.authService;
}
