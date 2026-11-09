import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-loading-state',
  standalone: true,
  imports: [],
  template: `
    <div class="ia-loading-state">
      @if (variant() === 'skeleton') {
        @for (i of skeletonRows(); track i) {
          <div class="ia-loading-state__skeleton-row" [style.width]="skeletonWidths()[i % skeletonWidths().length]">
            <div class="ia-loading-state__skeleton-block"></div>
          </div>
        }
      } @else if (variant() === 'field') {
        <div class="ia-loading-state__field">
          <div class="ia-loading-state__skeleton-block"></div>
        </div>
      } @else {
        <div class="ia-loading-state__text">Chargement...</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ia-loading-state { display: flex; flex-direction: column; gap: var(--space-2); }
    .ia-loading-state__skeleton-row { height: var(--space-3); border-radius: var(--radius-sm); }
    .ia-loading-state__skeleton-block { width: 100%; height: 100%; background: var(--color-surface-muted); border-radius: inherit; }
    .ia-loading-state__field { height: var(--control-h-md); border-radius: var(--radius-md); }
    .ia-loading-state__text { padding: var(--space-6); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaLoadingStateComponent {
  variant = input<'skeleton' | 'field' | 'text'>('skeleton');
  rows = input(3);

  protected skeletonRows = () => Array.from({ length: this.rows() }, (_, i) => i);
  protected skeletonWidths = () => ['100%', '80%', '60%', '90%', '70%'];
}
