import { Component, input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { IaButtonComponent } from '../button/button.component';

@Component({
  selector: 'ia-error-state',
  standalone: true,
  imports: [IaButtonComponent],
  template: `
    <div class="ia-error-state">
      <div class="ia-error-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="var(--color-error-solid)" />
          <line x1="12" y1="8" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="16" r="1" fill="white" />
        </svg>
      </div>
      <h3 class="ia-error-state__title">{{ title() }}</h3>
      @if (description()) {
        <p class="ia-error-state__body">{{ description() }}</p>
      }
      @if (showRetry()) {
        <ia-button variant="secondary" [label]="retryLabel()" (clicked)="retryClicked.emit()" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ia-error-state {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-2); padding: var(--space-16) var(--space-8); text-align: center;
    }
    .ia-error-state__title { font-size: var(--text-lg); font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .ia-error-state__body { font-size: var(--text-sm); color: var(--color-text-muted); max-width: 320px; line-height: 1.5; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaErrorStateComponent {
  title = input('Impossible de charger les données');
  description = input<string | null>(null);
  retryLabel = input('Réessayer');
  showRetry = input(true);
  retryClicked = new EventEmitter<void>();
}
