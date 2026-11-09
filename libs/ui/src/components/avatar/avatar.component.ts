import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-avatar',
  standalone: true,
  imports: [],
  template: `
    @if (hasPhoto()) {
      <img [src]="avatarUrl()!" [alt]="altText()" class="ia-avatar" [class]="sizeClass()"
           [class.ia-avatar--ring]="showRing()" />
    } @else {
      <span class="ia-avatar ia-avatar--fallback" [class]="sizeClass()" role="img" [attr.aria-label]="altText()">
        {{ initials() }}
      </span>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .ia-avatar { border-radius: var(--radius-full); object-fit: cover; }
    .ia-avatar--fallback {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-surface-muted); color: var(--color-text-secondary);
      font-size: var(--text-sm); font-weight: var(--font-weight-semibold); border-radius: var(--radius-full);
    }
    .ia-avatar--ring { outline: 2px solid var(--color-border); outline-offset: 2px; }
    .ia-avatar--24 { width: 24px; height: 24px; }
    .ia-avatar--32 { width: 32px; height: 32px; }
    .ia-avatar--48 { width: 48px; height: 48px; }
    .ia-avatar--56 { width: 56px; height: 56px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaAvatarComponent {
  avatarUrl = input<string | null>(null);
  name = input<string>('');
  size = input<24 | 32 | 48 | 56>(32);
  showRing = input(false);

  protected hasPhoto = () => !!this.avatarUrl();
  protected initials = () => {
    const name = this.name();
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || '').toUpperCase();
  };
  protected altText = () => this.hasPhoto() ? `Photo de ${this.name()}` : '';
  protected sizeClass = () => `ia-avatar--${this.size()}`;
}
