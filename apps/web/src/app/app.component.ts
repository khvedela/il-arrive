import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="placeholder">
      <h1>Il Arrive</h1>
      <p>Tableau de bord — en construction</p>
      <router-outlet />
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
    .placeholder {
      text-align: center;
    }
    h1 {
      font-size: 2rem;
      color: var(--ia-primary);
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--ia-text-muted);
    }
  `],
})
export class AppComponent {}
