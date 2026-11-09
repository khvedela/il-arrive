import type { InterventionStatus } from '@il-arrive/contracts';
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

export type StatusType = 'enroute' | 'success' | 'warning' | 'error' | 'neutral';

export const statusMap: Record<string, StatusType> = {
  EN_ROUTE: 'enroute',
  ARRIVED: 'success',
  COMPLETED: 'success',
  SCHEDULED: 'neutral',
  CANCELLED: 'error',
};

export const statusLabels: Record<StatusType, string> = {
  enroute: 'En route',
  success: 'Terminé',
  warning: 'Retardé',
  error: 'Annulé',
  neutral: 'Planifié',
};

@Component({
  selector: 'ia-status-badge',
  standalone: true,
  template: `
    <span class="ia-status-badge"
          [class]="badgeClasses()"
          [attr.role]="standaloneLabel() ? undefined : 'status'"
          [attr.aria-hidden]="!standaloneLabel()">
      <span class="ia-status-badge__dot"></span>
      <span class="ia-status-badge__label">
        {{ displayLabel() }}
      </span>
      @if (meta()) {
        <span class="ia-status-badge__meta">{{ meta() }}</span>
      }
    </span>

    @if (standaloneLabel()) {
      <span class="ia-status-badge__sr" role="status">{{ displayLabel() }}</span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }

    .ia-status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-full);
      border: 1px solid;
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      line-height: 1;
    }
    .ia-status-badge[size-sm] { min-height: 20px; }
    .ia-status-badge[size-md] { min-height: 24px; }

    .ia-status-badge__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }

    .ia-status-badge__label { line-height: 1.2; }

    .ia-status-badge__meta {
      font-size: var(--text-xs);
      opacity: 0.8;
    }

    .ia-status-badge__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }

    /* En route */
    .ia-status-badge--enroute {
      color: var(--color-enroute-fg);
      background: var(--color-enroute-bg);
      border-color: var(--color-enroute-border);
    }
    .ia-status-badge--enroute .ia-status-badge__dot { background: var(--color-enroute-solid); }

    /* Success */
    .ia-status-badge--success {
      color: var(--color-success-fg);
      background: var(--color-success-bg);
      border-color: var(--color-success-border);
    }
    .ia-status-badge--success .ia-status-badge__dot { background: var(--color-success-solid); }

    /* Warning */
    .ia-status-badge--warning {
      color: var(--color-warning-fg);
      background: var(--color-warning-bg);
      border-color: var(--color-warning-border);
    }
    .ia-status-badge--warning .ia-status-badge__dot { background: var(--color-warning-solid); }

    /* Error */
    .ia-status-badge--error {
      color: var(--color-error-fg);
      background: var(--color-error-bg);
      border-color: var(--color-error-border);
    }
    .ia-status-badge--error .ia-status-badge__dot { background: var(--color-error-solid); }

    /* Neutral */
    .ia-status-badge--neutral {
      color: var(--color-neutral-fg);
      background: var(--color-neutral-bg);
      border-color: var(--color-neutral-border);
    }
    .ia-status-badge--neutral .ia-status-badge__dot { background: var(--color-neutral-solid); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaStatusBadgeComponent {
  status = input<InterventionStatus | StatusType | string>('SCHEDULED');
  label = input<string | null>(null);
  meta = input<string | null>(null);
  size = input<'sm' | 'md'>('md');
  standaloneLabel = input(false);

  protected statusType = computed<StatusType>(() => {
    const s = this.status();
    if (['enroute', 'success', 'warning', 'error', 'neutral'].includes(s)) return s as StatusType;
    return statusMap[s] || 'neutral';
  });

  protected displayLabel = computed(() => {
    if (this.label()) return this.label()!;
    return statusLabels[this.statusType()];
  });

  protected badgeClasses = computed(() => {
    return `ia-status-badge--${this.statusType()} ia-status-badge__size--${this.size()}`;
  });
}
