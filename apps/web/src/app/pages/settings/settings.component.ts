import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `<div class="stub">Paramètres — en construction</div>`,
  styles: [`:host { display: block; padding: var(--space-8); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {}
