import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IaToastService } from './toast-service';

@Component({
  selector: 'ia-toast-container',
  standalone: true,
  imports: [],
  template: `
    <div class="ia-toast-container" role="status" aria-live="polite">
      @for (toast of service.toasts(); track toast.id) {
        <div class="ia-toast"
             [class.ia-toast--success]="toast.type === 'success'"
             [class.ia-toast--error]="toast.type === 'error'"
             [class.ia-toast--info]="toast.type === 'info'"
             [class.ia-toast--warning]="toast.type === 'warning'"
             [attr.role]="toast.type === 'error' ? 'alert' : 'status'">
          <span class="ia-toast__icon" aria-hidden="true">{{ iconFor(toast.type) }}</span>
          <span class="ia-toast__message">{{ toast.message }}</span>
          @if (toast.actionLabel) {
            <button class="ia-toast__action">{{ toast.actionLabel }}</button>
          }
          <button class="ia-toast__close" aria-label="Fermer" (click)="service.dismiss(toast.id)">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      position: fixed; top: var(--space-4); right: var(--space-4);
      z-index: var(--z-toast); display: flex; flex-direction: column;
      gap: var(--space-2); max-width: 400px; pointer-events: none;
    }
    @media (max-width: 640px) { :host { left: var(--space-4); right: var(--space-4); max-width: none; } }
    .ia-toast-container { display: flex; flex-direction: column; gap: var(--space-2); }
    .ia-toast {
      display: flex; align-items: flex-start; gap: var(--space-2);
      padding: var(--space-3) var(--space-4); background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      box-shadow: var(--shadow-md); pointer-events: auto;
      animation: toast-enter var(--motion-base) var(--ease-out);
    }
    .ia-toast__icon { flex-shrink: 0; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; margin-top: 2px; }
    .ia-toast__message { flex: 1; font-size: var(--text-sm); color: var(--color-text-primary); }
    .ia-toast__action { font-size: var(--text-sm); color: var(--color-enroute-fg); background: none; border: none; cursor: pointer; text-decoration: underline; flex-shrink: 0; }
    .ia-toast__close {
      width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
      background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; flex-shrink: 0;
    }
    .ia-toast__close:hover { color: var(--color-text-primary); }
    .ia-toast--success .ia-toast__icon { color: var(--color-success-solid); }
    .ia-toast--error .ia-toast__icon { color: var(--color-error-solid); }
    .ia-toast--info .ia-toast__icon { color: var(--color-ink); }
    .ia-toast--warning .ia-toast__icon { color: var(--color-warning-solid); }
    @keyframes toast-enter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaToastContainerComponent {
  constructor(public service: IaToastService) {}
  protected iconFor = (type: string): string => {
    switch (type) { case 'success': return '✓'; case 'error': return '!'; case 'warning': return '!'; default: return 'i'; }
  };
}
