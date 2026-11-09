import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

export type TimelineStepStatus = 'done' | 'current' | 'upcoming';

export interface TimelineStep {
  label: string;
  meta?: string;
  status: TimelineStepStatus;
  statusColor?: string;
}

@Component({
  selector: 'ia-timeline',
  standalone: true,
  template: `
    <ol class="ia-timeline">
      @for (step of steps(); track i; let i = $index, last = $last) {
        <li class="ia-timeline__step"
            [class.ia-timeline__step--done]="step.status === 'done'"
            [class.ia-timeline__step--current]="step.status === 'current'"
            [class.ia-timeline__step--upcoming]="step.status === 'upcoming'"
            [attr.aria-current]="step.status === 'current' ? 'step' : null">
          <div class="ia-timeline__node" [class]="nodeClass(step)">
            @if (step.status === 'done') {
              <span aria-hidden="true">✓</span>
            } @else if (step.status === 'current') {
              <span class="ia-timeline__pulse"></span>
            } @else {
              <span class="ia-timeline__ring"></span>
            }
          </div>

          <div class="ia-timeline__content">
            <div class="ia-timeline__label">{{ step.label }}</div>
            @if (step.meta) {
              <div class="ia-timeline__meta">{{ step.meta }}</div>
            }
          </div>

          @if (!last) {
            <div class="ia-timeline__connector" [class.ia-timeline__connector--done]="step.status === 'done'"></div>
          }
        </li>
      }
    </ol>
  `,
  styles: [`
    :host { display: block; }

    .ia-timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .ia-timeline__step {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      position: relative;
      padding-bottom: var(--space-4);
    }

    .ia-timeline__node {
      width: 16px;
      height: 16px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }

    .ia-timeline__step--done .ia-timeline__node {
      background: var(--color-success-solid);
      color: var(--color-text-inverse);
    }

    .ia-timeline__step--current .ia-timeline__node {
      background: var(--color-surface);
      border: 4px solid var(--color-enroute-solid);
      width: 16px;
      height: 16px;
    }
    .ia-timeline__pulse {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--color-enroute-solid);
      animation: pulse var(--motion-slow) ease-in-out 1;
    }

    .ia-timeline__step--upcoming .ia-timeline__node {
      border: 2px solid var(--color-border);
    }
    .ia-timeline__ring {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
    }

    .ia-timeline__content {
      flex: 1;
      padding-top: 2px;
    }

    .ia-timeline__label {
      font-size: var(--text-sm);
    }
    .ia-timeline__step--done .ia-timeline__label,
    .ia-timeline__step--current .ia-timeline__label {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .ia-timeline__step--upcoming .ia-timeline__label {
      color: var(--color-text-muted);
    }

    .ia-timeline__meta {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .ia-timeline__connector {
      position: absolute;
      left: 7px;
      top: 16px;
      bottom: 0;
      width: 2px;
      background: var(--color-border);
    }
    .ia-timeline__connector--done {
      background: var(--color-success-solid);
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.5); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ia-timeline__pulse { animation: none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTimelineComponent {
  steps = input<TimelineStep[]>([]);

  protected nodeClass = (step: TimelineStep): string => {
    return `ia-timeline__node ia-timeline__node--${step.status}`;
  };
}
