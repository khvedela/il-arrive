import { Component, input, computed, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-card',
  standalone: true,
  imports: [],
  template: `
    <div class="ia-card" [class]="cardClasses()"
         [attr.tabindex]="interactive() ? 0 : null"
         (click)="onClick()"
         (keydown)="onKeydown($event)">
      @if (header()) {
        <div class="ia-card__header"><ng-content select="[ia-card-header]" /></div>
      }
      <div class="ia-card__body"><ng-content /></div>
      @if (footer()) {
        <div class="ia-card__footer"><ng-content select="[ia-card-footer]" /></div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ia-card { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-lg); overflow: hidden; }
    .ia-card--elevated { box-shadow: var(--shadow-sm); }
    .ia-card--interactive { cursor: pointer; transition: border-color var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out); }
    .ia-card--interactive:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
    .ia-card--interactive:focus-visible { outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
    .ia-card--tinted { background: var(--color-enroute-bg); border-color: var(--color-enroute-border); }
    .ia-card--compact .ia-card__body { padding: var(--space-3); }
    .ia-card__body { padding: var(--space-4); }
    .ia-card__header, .ia-card__footer { padding: var(--space-4); }
    .ia-card__header { border-bottom: 1px solid var(--color-border); }
    .ia-card__footer { border-top: 1px solid var(--color-border); }
    .ia-card--compact .ia-card__header, .ia-card--compact .ia-card__footer { padding: var(--space-3); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaCardComponent {
  variant = input<'plain' | 'elevated' | 'interactive' | 'tinted'>('plain');
  compact = input(false);
  header = input(true);
  footer = input(false);
  clickable = input(false);
  clicked = new EventEmitter<void>();

  protected interactive = computed(() => this.variant() === 'interactive' || this.clickable());
  protected cardClasses = computed(() => {
    let cls = 'ia-card';
    if (this.variant() === 'elevated') cls += ' ia-card--elevated';
    if (this.variant() === 'interactive') cls += ' ia-card--interactive';
    if (this.variant() === 'tinted') cls += ' ia-card--tinted';
    if (this.compact()) cls += ' ia-card--compact';
    return cls;
  });

  protected onClick = (): void => { if (this.interactive()) this.clicked.emit(); };
  protected onKeydown = (event: KeyboardEvent): void => {
    if (this.interactive() && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.clicked.emit(); }
  };
}
