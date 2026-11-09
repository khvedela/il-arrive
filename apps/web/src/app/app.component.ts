import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { IaToastContainerComponent } from '@il-arrive/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IaToastContainerComponent],
  template: `
    @if (isTechRoute()) {
      <router-outlet />
    } @else {
      <div class="placeholder">
        <h1>Il Arrive</h1>
        <p>Tableau de bord — en construction</p>
        <router-outlet />
      </div>
    }
    <ia-toast-container />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .placeholder {
      text-align: center;
    }
    h1 {
      font-size: 2rem;
      color: var(--color-ink);
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--color-text-muted);
    }
  `],
})
export class AppComponent {
  private router = inject(Router);
  isTechRoute = (): boolean => {
    return this.router.url.startsWith('/tech');
  }
}
