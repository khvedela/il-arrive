import { Component, input, model, computed, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-textarea',
  standalone: true,
  imports: [],
  template: `
    <div class="ia-textarea" [class]="hostClasses()">
      @if (label()) {
        <label [for]="textareaId" class="ia-textarea__label">{{ label() }}</label>
      }
      <textarea #textareaEl [id]="textareaId" [placeholder]="placeholder()"
                [disabled]="disabled()" [required]="required()"
                [attr.aria-invalid]="hasError() || null"
                [attr.aria-describedby]="describedbyIds()"
                [attr.rows]="currentRows()"
                (input)="onInput($event)"></textarea>
      @if (helperText() && !hasError()) {
        <div class="ia-textarea__helper" id="helper-{{ textareaId }}">{{ helperText() }}</div>
      }
      @if (hasError()) {
        <div class="ia-textarea__error" id="error-{{ textareaId }}">{{ errorText() || 'Ce champ est invalide' }}</div>
      }
      @if (maxLength() != null) {
        <div class="ia-textarea__counter" [class.ia-textarea__counter--error]="currentLength() > (maxLength() || 0)"
             id="counter-{{ textareaId }}">
          {{ currentLength() }}/{{ maxLength() }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ia-textarea { display: flex; flex-direction: column; gap: var(--space-1); }
    .ia-textarea__label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .ia-textarea textarea {
      min-height: 96px; max-height: 192px; border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md); background: var(--color-surface);
      font-family: var(--font-sans); font-size: var(--text-md); color: var(--color-text-primary);
      padding: var(--space-3); outline: none; resize: none;
      transition: border-color var(--motion-fast) var(--ease-out);
    }
    .ia-textarea textarea:focus { border-color: var(--color-ink); outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
    .ia-textarea textarea::placeholder { color: var(--color-text-muted); }
    .ia-textarea textarea:disabled { background: var(--color-surface-muted); color: var(--color-text-muted); border-color: var(--color-border); }
    .ia-textarea__field--error textarea { border-color: var(--color-error-solid); }
    .ia-textarea__field--error textarea:focus { outline-color: var(--color-error-solid); }
    .ia-textarea__helper { font-size: var(--text-xs); color: var(--color-text-muted); }
    .ia-textarea__error { font-size: var(--text-xs); color: var(--color-danger-text); }
    .ia-textarea__counter { font-size: var(--text-xs); color: var(--color-text-muted); text-align: right; }
    .ia-textarea__counter--error { color: var(--color-danger-text); }
    @media (min-width: 1024px) { .ia-textarea textarea { resize: vertical; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTextareaComponent implements AfterViewInit {
  label = input<string>('');
  placeholder = input<string>('');
  disabled = input(false);
  required = input(false);
  helperText = input<string>('');
  errorText = input<string | null>(null);
  maxLength = input<number | null>(null);
  value = model<string>('');

  textareaId = 'ia-textarea-' + Math.random().toString(36).slice(2, 9);
  protected currentRows = computed(() => Math.min(this.countRows(this.value()), 8));

  @ViewChild('textareaEl') textareaEl!: ElementRef<HTMLTextAreaElement>;

  protected hasError = computed(() => !!this.errorText());
  protected currentLength = computed(() => this.value().length);

  protected describedbyIds = computed(() => {
    const ids: string[] = [];
    if (this.helperText() && !this.errorText()) ids.push('helper-' + this.textareaId);
    if (this.errorText()) ids.push('error-' + this.textareaId);
    if (this.maxLength() !== null) ids.push('counter-' + this.textareaId);
    return ids.length ? ids.join(' ') : undefined;
  });

  protected hostClasses = computed(() => {
    let cls = '';
    if (this.hasError()) cls += ' ia-textarea__field--error';
    return cls;
  });

  ngAfterViewInit(): void { this.adjustHeight(); }

  protected onInput = (event: Event): void => {
    const target = event.target as HTMLTextAreaElement;
    this.value.set(target.value);
    this.adjustHeight();
  };

  private adjustHeight(): void {
    if (this.textareaEl) {
      const el = this.textareaEl.nativeElement;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }

  private countRows(text: string): number {
    if (!text) return 3;
    return Math.max(3, text.split('\n').length);
  }
}
