import { Component, input, ChangeDetectionStrategy, output } from '@angular/core';
import { TabDef } from './tab-group.directive';

@Component({
  selector: 'ia-tabs',
  standalone: true,
  imports: [],
  template: `
    <nav class="ia-tabs"
         role="tablist"
         [attr.aria-label]="label()"
         (keydown)="onKeydown($event)">
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          class="ia-tab"
          [class.ia-tab--active]="selectedIndex() === i"
          [class.ia-tab--disabled]="tab.disabled"
          role="tab"
          [attr.id]="tab.id"
          [attr.aria-selected]="selectedIndex() === i"
          [attr.tabindex]="selectedIndex() === i ? 0 : -1"
          [attr.disabled]="tab.disabled || null"
          (click)="selectTab(i)"
        >
          {{ tab.label }}
          @if (variant() === 'underline' && selectedIndex() === i) {
            <span class="ia-tab__indicator"></span>
          }
        </button>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }

    .ia-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--color-border);
    }

    .ia-tabs--segmented {
      border-bottom: none;
      background: var(--color-surface-muted);
      border-radius: var(--radius-md);
      padding: 2px;
    }

    .ia-tab {
      display: inline-flex;
      align-items: center;
      height: 44px;
      padding: 0 var(--space-4);
      border: none;
      background: transparent;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      cursor: pointer;
      position: relative;
      transition: color var(--motion-fast) var(--ease-out);
    }

    .ia-tab:hover { color: var(--color-text-primary); }

    .ia-tab--active { color: var(--color-text-primary); }

    .ia-tab--disabled {
      color: var(--color-text-muted);
      cursor: default;
      opacity: 0.6;
    }

    .ia-tab:focus-visible {
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: var(--focus-offset);
    }

    .ia-tab__indicator {
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-ink);
      border-radius: 1px;
    }

    .ia-tabs--segmented .ia-tab--active {
      background: var(--color-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-xs);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTabsComponent {
  tabs = input<TabDef[]>([]);
  selectedIndex = input(0);
  label = input('');
  variant = input<'underline' | 'segmented'>('underline');

  selectedChange = output<number>();

  protected selectTab = (index: number): void => {
    const tab = this.tabs()[index];
    if (tab?.disabled) return;
    this.selectedChange.emit(index);
  };

  protected onKeydown = (event: KeyboardEvent): void => {
    const len = this.tabs().length;
    const current = this.selectedIndex();
    let target = current;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        target = (current + 1) % len;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        target = (current - 1 + len) % len;
        break;
      case 'Home':
        event.preventDefault();
        target = 0;
        break;
      case 'End':
        event.preventDefault();
        target = len - 1;
        break;
      default:
        return;
    }
    this.selectTab(target);
  };
}
