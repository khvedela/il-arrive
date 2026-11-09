import { Component, input, computed, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { IaStatusBadgeComponent } from '../status-badge/status-badge.component';
import { IaAvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'ia-list-row',
  standalone: true,
  imports: [IaStatusBadgeComponent, IaAvatarComponent],
  template: `
    <div class="ia-list-row"
         [class.ia-list-row--selected]="isSelected()"
         [attr.role]="role()"
         [attr.tabindex]="role() === 'option' ? 0 : null"
         [attr.aria-current]="isSelected() ? 'true' : null"
         (click)="onSelect()"
         (keydown)="onKeydown($event)">
      @if (time()) {
        <div class="ia-list-row__time">
          <div class="ia-list-row__time-window">{{ time() }}</div>
          @if (date()) {
            <div class="ia-list-row__time-date">{{ date() }}</div>
          }
        </div>
      }

      <div class="ia-list-row__main">
        <div class="ia-list-row__title">{{ title() }}</div>
        @if (subtitle()) {
          <div class="ia-list-row__subtitle" [title]="subtitle()">{{ subtitle() }}</div>
        }
      </div>

      <div class="ia-list-row__right">
        @if (delay()) {
          <span class="ia-list-row__delay">{{ delay() }}</span>
        }
        @if (statusType()) {
          <ia-status-badge [status]="statusType()!" size="sm" [label]="statusLabel()" />
        }
        @if (techName() || techAvatar()) {
          <ia-avatar
            [avatarUrl]="techAvatar()"
            [name]="techName() || ''"
            [size]="24"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ia-list-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background-color var(--motion-fast) var(--ease-out);
      min-height: 56px;
    }

    @media (max-width: 640px) {
      .ia-list-row { min-height: 72px; }
    }

    .ia-list-row:hover { background: var(--color-surface-hover); }
    .ia-list-row--selected { background: var(--color-enroute-bg); }

    .ia-list-row:focus-visible {
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: calc(1px * -1);
    }

    .ia-list-row__time {
      flex-shrink: 0;
      width: 80px;
      text-align: right;
    }
    .ia-list-row__time-window {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .ia-list-row__time-date {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .ia-list-row__main {
      flex: 1;
      min-width: 0;
    }
    .ia-list-row__title {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .ia-list-row__subtitle {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ia-list-row__right {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .ia-list-row__delay {
      font-size: var(--text-xs);
      color: var(--color-warning-fg);
      background: var(--color-warning-bg);
      padding: 2px var(--space-1);
      border-radius: var(--radius-sm);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaListRowComponent {
  time = input<string>('');
  date = input<string>('');
  title = input('');
  subtitle = input<string>('');
  statusType = input<string>('');
  statusLabel = input<string>('');
  techName = input<string>('');
  techAvatar = input<string>('');
  delay = input<string>('');
  selected = input(false);

  select = new EventEmitter<void>();

  protected isSelected = computed(() => this.selected());

  role = input<'option' | string>('option');

  protected onSelect = (): void => {
    this.select.emit();
  };

  protected onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select.emit();
    }
  };
}
