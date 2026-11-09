import {
  Component,
  input,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { IaFocusTrapDirective } from '../../shared/focus-trap.directive';

@Component({
  selector: 'ia-modal',
  standalone: true,
  imports: [IaFocusTrapDirective],
  template: `
    @if (isOpen()) {
      <div class="ia-modal__scrim" (click)="onScrimClick()" aria-hidden="true"></div>
      <div class="ia-modal__dialog"
           [class.ia-modal__dialog--open]="isOpen()"
           [style.max-width]="maxWidth()"
           role="dialog"
           aria-modal="true"
           [attr.aria-label]="label()"
           iaFocusTrap
           (keydown)="onKeydown($event)">
        <div class="ia-modal__header">
          <h2 class="ia-modal__title">{{ title() }}</h2>
          <button class="ia-modal__close" aria-label="Fermer" (click)="onClose()">✕</button>
        </div>
        <div class="ia-modal__body"><ng-content /></div>
        @if (showFooter()) {
          <div class="ia-modal__footer"><ng-content select="[ia-modal-footer]" /></div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: none; }
    :host(:has([class*="ia-modal"])) { display: block; position: fixed; inset: 0; z-index: var(--z-modal); }

    .ia-modal__scrim { position: absolute; inset: 0; background: rgba(37,35,30,0.4); }
    .dark .ia-modal__scrim { background: rgba(0,0,0,0.6); }

    .ia-modal__dialog {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      background: var(--color-surface); border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg); max-height: 90vh;
      display: flex; flex-direction: column; opacity: 0; width: 90%;
      transition: opacity var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
    }
    .ia-modal__dialog--open { opacity: 1; transform: translate(-50%, -50%) scale(1); }

    .ia-modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-6) var(--space-6) var(--space-4); }
    .ia-modal__title { font-size: var(--text-xl); font-weight: var(--font-weight-semibold); }
    .ia-modal__close {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--touch-target-min); height: var(--touch-target-min);
      border: none; background: transparent; color: var(--color-text-secondary);
      font-size: var(--text-lg); cursor: pointer; border-radius: var(--radius-md);
    }
    .ia-modal__close:hover { background: var(--color-surface-hover); }
    .ia-modal__close:focus-visible { outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
    .ia-modal__body { padding: 0 var(--space-6) var(--space-6); overflow-y: auto; }
    .ia-modal__footer { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-4) var(--space-6) var(--space-6); border-top: 1px solid var(--color-border); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaModalComponent {
  isOpen = input(false);
  title = input('');
  label = input('');
  maxWidth = input('420px');
  showFooter = input(false);
  closed = new EventEmitter<void>();
  confirmed = new EventEmitter<void>();

  protected onClose = (): void => { this.closed.emit(); };
  protected onScrimClick = (): void => { this.closed.emit(); };
  protected onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); this.closed.emit(); }
    if (event.key === 'Enter') { event.preventDefault(); this.confirmed.emit(); }
  };
}
