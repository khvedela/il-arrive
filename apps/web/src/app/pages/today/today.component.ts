import { Component } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-today',
  standalone: true,
  template: `<div class="stub">Vue aujourd'hui — en construction</div>`,
  styles: [`:host { display: block; padding: var(--space-8); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayComponent {}
