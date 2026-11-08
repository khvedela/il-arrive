import { Component } from '@angular/core';

@Component({
  selector: 'iat-track-page',
  standalone: true,
  template: `
    <div class="track-page">
      <h1>Suivi d'intervention</h1>
      <p>Page placeholder — en construction</p>
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
    .track-page {
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      color: var(--ia-primary);
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--ia-text-muted);
    }
  `],
})
export class TrackPageComponent {}
