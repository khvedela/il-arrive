import { Injectable, signal } from '@angular/core';
import type { Toast, ToastType } from './toast-types';

let idCounter = 0;

@Injectable({ providedIn: 'root' })
export class IaToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info', actionLabel?: string): void {
    const duration = type === 'error' || type === 'warning' ? 8000 : 4000;
    const toast: Toast = {
      id: `toast-${++idCounter}-${Date.now()}`,
      type,
      message,
      actionLabel,
      duration,
    };
    this.toasts.update(toasts => {
      const next = [...toasts, toast];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });

    if (!actionLabel) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  dismiss(id: string): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  success(message: string, actionLabel?: string): void { this.show(message, 'success', actionLabel); }
  error(message: string, actionLabel?: string): void { this.show(message, 'error', actionLabel); }
  info(message: string, actionLabel?: string): void { this.show(message, 'info', actionLabel); }
  warning(message: string, actionLabel?: string): void { this.show(message, 'warning', actionLabel); }
}
