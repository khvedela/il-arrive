import { Component, input, computed, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'action';

@Component({
  selector: 'ia-button',
  standalone: true,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="hostClasses()"
      [attr.aria-busy]="loading() || null"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <span class="ia-button__spinner" [class]="spinnerClass()">
          <svg viewBox="0 0 16 16" class="ia-button__spinner-icon" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
      } @else if (icon() && iconPosition() === 'before') {
        <span class="ia-button__icon" aria-hidden="true">{{ icon() }}</span>
      }

      <span class="ia-button__label">
        {{ loading() ? loadingText() || 'Chargement...' : label() }}
      </span>

      @if (!loading() && icon() && iconPosition() === 'after') {
        <span class="ia-button__icon" aria-hidden="true">{{ icon() }}</span>
      }

      @if (loading()) {
        <span class="ia-button__loading-text" aria-live="polite">
          {{ loadingText() || 'Chargement...' }}
        </span>
      }
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font-family: var(--font-sans);
      font-weight: var(--font-weight-medium);
      font-size: var(--text-sm);
      border: 1px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      min-width: 64px;
      transition: background-color var(--motion-fast) var(--ease-out),
                  border-color var(--motion-fast) var(--ease-out),
                  color var(--motion-fast) var(--ease-out);
      user-select: none;
    }

    button:focus-visible {
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: var(--focus-offset);
    }

    /* Sizes */
    button[size-sm] { height: var(--control-h-sm); padding: 0 var(--space-3); border-radius: var(--radius-md); }
    button[size-md] { height: var(--control-h-md); padding: 0 var(--space-3); border-radius: var(--radius-md); }
    button[size-lg] { height: var(--control-h-lg); padding: 0 var(--space-4); border-radius: var(--radius-lg); }
    button[size-action] { height: var(--control-h-action); padding: 0 var(--space-4); border-radius: var(--radius-lg); width: 100%; }

    /* Primary */
    button[variant-primary] {
      background: var(--color-ink);
      color: var(--color-text-inverse);
    }
    button[variant-primary]:hover { background: var(--color-ink-hover); }
    button[variant-primary]:active { background: var(--color-ink-active); }

    /* Secondary */
    button[variant-secondary] {
      background: var(--color-surface);
      border-color: var(--color-border-strong);
      color: var(--color-text-primary);
    }
    button[variant-secondary]:hover { background: var(--color-surface-hover); }

    /* Ghost */
    button[variant-ghost] {
      background: transparent;
      color: var(--color-text-secondary);
    }
    button[variant-ghost]:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }

    /* Danger */
    button[variant-danger] {
      background: var(--color-danger);
      color: var(--color-text-inverse);
    }
    button[variant-danger]:hover { background: var(--color-danger-hover); }

    /* Danger ghost */
    button[variant-danger-ghost] {
      background: transparent;
      color: var(--color-danger-text);
    }
    button[variant-danger-ghost]:hover { background: var(--color-error-bg); }

    /* Disabled */
    button:disabled {
      background: var(--color-surface-muted) !important;
      color: var(--color-text-muted) !important;
      border-color: var(--color-border) !important;
      cursor: default;
    }

    .ia-button__icon {
      display: inline-flex;
      width: 16px;
      height: 16px;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ia-button__spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .ia-button__spinner-icon {
      width: 16px;
      height: 16px;
      animation: spin 600ms linear infinite;
      stroke: currentColor;
    }

    .ia-button__loading-text {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }

    @keyframes spin {
      from { stroke-dasharray: 1, 20; }
      to { stroke-dasharray: 16, 4; transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush, // OnPush
})
export class IaButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  label = input<string>('');
  icon = input<string | null>(null);
  iconPosition = input<'before' | 'after'>('before');
  disabled = input(false);
  loading = input(false);
  loadingText = input<string>('Chargement...');
  type = input<'button' | 'submit' | 'reset'>('button');

  clicked = new EventEmitter<Event>();

  protected hostClasses = computed(() => {
    return `ia-button ia-button--${this.variant()} ia-button__size--${this.size()}`;
  });

  protected spinnerClass = computed(() => {
    const variant = this.variant();
    if (variant === 'primary' || variant === 'danger') return 'ia-button__spinner ia-button__spinner--inverse';
    return 'ia-button__spinner';
  });

  protected onClick = (event: Event): void => {
    if (this.disabled() || this.loading()) return;
    this.clicked.emit(event);
  }
}
