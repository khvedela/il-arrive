import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-interventions',
  standalone: true,
  template: `<div class="stub">Liste d'interventions — en construction</div>`,
  styles: [`:host { display: block; padding: var(--space-8); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionsComponent {}
