import { Component, input, ChangeDetectionStrategy, output } from '@angular/core';
import { IaButtonComponent } from '../button/button.component';

@Component({
  selector: 'ia-empty-state',
  standalone: true,
  imports: [IaButtonComponent],
  template: `
    <div class="ia-empty-state">
      <div class="ia-empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="40" height="40">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="none" stroke="var(--color-text-muted)" stroke-width="2" />
          <line x1="14" y1="20" x2="26" y2="20" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <h3 class="ia-empty-state__title">{{ title() }}</h3>
      @if (description()) {
        <p class="ia-empty-state__body">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <ia-button variant="secondary" [label]="actionLabel() || 'Action'" (clicked)="actionClicked.emit()" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ia-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-16) var(--space-8);
      text-align: center;
    }

    .ia-empty-state__title {
      font-size: var(--text-lg);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .ia-empty-state__body {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      max-width: 320px;
      line-height: 1.5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaEmptyStateComponent {
  title = input('Aucun r\\u00e9sultat');
  description = input<string | null>(null);
  actionLabel = input<string | null>(null);

  actionClicked = output<void>();
}
