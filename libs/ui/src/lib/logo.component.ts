import { Component } from '@angular/core';

@Component({
  selector: 'ia-logo',
  standalone: true,
  template: `
    <span class="logo">{{ 'Il Arrive' }}</span>
  `,
  styles: [`
    .logo {
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--ia-primary);
    }
  `],
})
export class LogoComponent {}
