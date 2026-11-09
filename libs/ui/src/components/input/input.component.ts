import { Component, input, model, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-input',
  standalone: true,
  template: `
    <div class="ia-input" [class]="hostClasses()">
      @if (label()) {
        <label [for]="inputId" class="ia-input__label">{{ label() }}</label>
      }
      <div class="ia-input__field">
        @if (prefix()) {
          <span class="ia-input__prefix">{{ prefix() }}</span>
        }
        <input #inputEl [id]="inputId" [type]="type()" [placeholder]="placeholder()"
               [disabled]="disabled()" [required]="required()"
               [attr.aria-invalid]="hasError() || null"
               [attr.aria-describedby]="describedbyIds()"
               (input)="onInput($event)" (blur)="onBlur()" />
        @if (suffix()) {
          <span class="ia-input__suffix">{{ suffix() }}</span>
        }
      </div>
      @if (helperText() && !hasError()) {
        <div class="ia-input__helper" id="helper-{{ inputId }}">{{ helperText() }}</div>
      }
      @if (hasError()) {
        <div class="ia-input__error" id="error-{{ inputId }}">{{ errorText() || 'Ce champ est invalide' }}</div>
      }
      @if (maxLength() != null) {
        <div class="ia-input__counter" [class.ia-input__counter--error]="currentLength() > (maxLength() || 0)"
             id="counter-{{ inputId }}">
          {{ currentLength() }}/{{ maxLength() }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ia-input { display: flex; flex-direction: column; gap: var(--space-1); }
    .ia-input__label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .ia-input__field {
      display: inline-flex; align-items: center; height: var(--control-h-md);
      border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      background: var(--color-surface); transition: border-color var(--motion-fast) var(--ease-out);
    }
    .ia-input__field:focus-within {
      border-color: var(--color-ink);
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: var(--focus-offset);
    }
    .ia-input__field--error { border-color: var(--color-error-solid); }
    .ia-input__field--error:focus-within { outline-color: var(--color-error-solid); }
    .ia-input__field--disabled { background: var(--color-surface-muted); border-color: var(--color-border); }
    .ia-input__field input {
      flex: 1; min-width: 0; border: none; background: transparent;
      font-family: var(--font-sans); font-size: var(--text-md); color: var(--color-text-primary);
      padding: 0 var(--space-3); outline: none;
    }
    .ia-input__field input::placeholder { color: var(--color-text-muted); }
    .ia-input__field input:disabled { color: var(--color-text-muted); }
    .ia-input__prefix, .ia-input__suffix {
      display: inline-flex; align-items: center; padding: 0 var(--space-2) 0 0;
      color: var(--color-text-muted); font-size: var(--text-md); flex-shrink: 0;
    }
    .ia-input__suffix { padding: 0 0 0 var(--space-2); }
    .ia-input__helper { font-size: var(--text-xs); color: var(--color-text-muted); }
    .ia-input__error { font-size: var(--text-xs); color: var(--color-danger-text); }
    .ia-input__counter { font-size: var(--text-xs); color: var(--color-text-muted); text-align: right; }
    .ia-input__counter--error { color: var(--color-danger-text); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaInputComponent {
  label = input<string>('');
  placeholder = input<string>('');
  type = input<string>('text');
  disabled = input(false);
  required = input(false);
  helperText = input<string>('');
  errorText = input<string | null>(null);
  prefix = input<string | null>(null);
  suffix = input<string | null>(null);
  maxLength = input<number | null>(null);
  value = model<string>('');

  inputId = 'ia-input-' + Math.random().toString(36).slice(2, 9);

  protected hasError = computed(() => !!this.errorText());
  protected currentLength = computed(() => this.value().length);

  protected describedbyIds = computed(() => {
    const ids: string[] = [];
    if (this.helperText() && !this.errorText()) ids.push('helper-' + this.inputId);
    if (this.errorText()) ids.push('error-' + this.inputId);
    if (this.maxLength() !== null) ids.push('counter-' + this.inputId);
    return ids.length ? ids.join(' ') : undefined;
  });

  protected hostClasses = computed(() => {
    let cls = '';
    if (this.hasError()) cls += ' ia-input--error';
    if (this.disabled()) cls += ' ia-input--disabled';
    return cls;
  });

  protected onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.value.set(target.value);
  };
  protected onBlur = (): void => {}
}
