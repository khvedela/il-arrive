import { Component } from '@angular/core';

@Component({
  selector: 'iat-not-found',
  standalone: true,
  template: `
    <div class="not-found">
      <div class="not-found__icon" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="40" height="40">
          <path d="M10 20h20M20 10v20" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <h1 class="not-found__title">Lien introuvable</h1>
      <p class="not-found__body">Ce lien est invalide ou a été révoqué. Vérifiez le message reçu par SMS.</p>
      <div class="not-found__footer">
        <span>Propulsé par Il Arrive</span>
        <a href="/privacy" class="not-found__privacy">Confidentialité</a>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: var(--space-8) var(--space-4);
      gap: var(--space-3);
    }
    .not-found__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-tight);
      color: var(--color-text-primary);
    }
    .not-found__body {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
      max-width: 320px;
    }
    .not-found__footer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-4);
    }
    .not-found__privacy {
      color: var(--color-text-muted);
      text-decoration: underline;
    }
  `],
})
export class NotFoundComponent {}
