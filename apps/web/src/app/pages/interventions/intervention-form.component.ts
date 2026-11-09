import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-intervention-form',
  standalone: true,
  template: `<div class="stub">Formulaire d'intervention — en construction</div>`,
  styles: [`:host { display: block; padding: var(--space-8); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionFormComponent {}
