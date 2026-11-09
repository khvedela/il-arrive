import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-team',
  standalone: true,
  template: `<div class="stub">Page équipe — en construction</div>`,
  styles: [`:host { display: block; padding: var(--space-8); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {}
