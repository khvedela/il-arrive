import {
  Component,
  input,
  computed,
  AfterViewInit,
  ChangeDetectionStrategy,
  output,
} from '@angular/core';
import { IaFocusTrapDirective } from '../../shared/focus-trap.directive';

@Component({
  selector: 'ia-drawer',
  standalone: true,
  imports: [IaFocusTrapDirective],
  template: `
    @if (isOpen()) {
      <div class="ia-drawer__scrim" (click)="onScrimClick()" aria-hidden="true"></div>
      <div
        class="ia-drawer__panel"
        [class.ia-drawer__panel--open]="isOpen()"
        [class.ia-drawer__panel--mobile]="isMobile()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="label()"
        iaFocusTrap
      >
        <div class="ia-drawer__header">
          <h2 class="ia-drawer__title">{{ title() }}</h2>
          <button class="ia-drawer__close" aria-label="Fermer le panneau" (click)="close.emit()">✕</button>
        </div>
        @if (showGrabHandle()) {
          <div class="ia-drawer__handle" aria-hidden="true"></div>
        }
        <div class="ia-drawer__body"><ng-content /></div>
        @if (hasFooter()) {
          <div class="ia-drawer__footer"><ng-content select="[ia-drawer-footer]" /></div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: none; }
    :host(:has([class*="ia-drawer"])) { display: block; position: fixed; inset: 0; z-index: var(--z-drawer); }

    .ia-drawer__scrim { position: absolute; inset: 0; background: rgba(37,35,30,0.4); }

    .ia-drawer__panel {
      position: absolute; top: 0; right: 0; width: var(--drawer-w); height: 100%;
      background: var(--color-surface); border-left: 1px solid var(--color-border); box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column; transform: translateX(100%);
      transition: transform var(--motion-base) var(--ease-out);
    }
    .ia-drawer__panel--open { transform: translateX(0); }
    .ia-drawer__panel--mobile {
      width: 100%; height: 90%; top: auto; bottom: 0; right: auto; left: 0;
      border-left: none; border-top: 1px solid var(--color-border);
      border-radius: var(--radius-xl) var(--radius-xl) 0 0; transform: translateY(100%);
    }
    .ia-drawer__panel--mobile.ia-drawer__panel--open { transform: translateY(0); }

    .ia-drawer__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-4); border-bottom: 1px solid var(--color-border); flex-shrink: 0;
    }
    .ia-drawer__title { font-size: var(--text-xl); font-weight: var(--font-weight-semibold); }
    .ia-drawer__close {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--touch-target-min); height: var(--touch-target-min);
      border: none; background: transparent; color: var(--color-text-secondary);
      font-size: var(--text-lg); cursor: pointer; border-radius: var(--radius-md);
    }
    .ia-drawer__close:hover { background: var(--color-surface-hover); }
    .ia-drawer__close:focus-visible { outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }

    .ia-drawer__handle {
      width: 32px; height: 4px; background: var(--color-border-strong);
      border-radius: var(--radius-full); margin: var(--space-2) auto 0;
    }
    .ia-drawer__body { flex: 1; overflow-y: auto; padding: var(--space-4); }
    .ia-drawer__footer { padding: var(--space-4); border-top: 1px solid var(--color-border); flex-shrink: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaDrawerComponent implements AfterViewInit {
  isOpen = input(false);
  title = input('');
  label = input('');
  hasFooter = input(false);
  close = output<void>();

  protected isMobile = computed(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  protected showGrabHandle = computed(() => this.isMobile());

  protected onScrimClick = (): void => { this.close.emit(); };

  private keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); this.close.emit(); }
  };

  ngAfterViewInit(): void { document.addEventListener('keydown', this.keydownHandler); }
}
