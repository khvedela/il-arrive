import { Component } from '@angular/core';

@Component({
  selector: 'iat-not-found',
  standalone: true,
  template: `
    <div class="not-found">
      <h1>Page introuvable</h1>
      <p>Le lien de suivi n'est pas valide ou a expiré.</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .not-found {
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      color: var(--ia-danger);
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--ia-text-muted);
    }
  `],
})
export class NotFoundComponent {}
