import { Component, input, model, computed, ChangeDetectionStrategy } from '@angular/core';
import { IaInputComponent } from '../input/input.component';

@Component({
  selector: 'ia-phone-input',
  standalone: true,
  imports: [IaInputComponent],
  template: `
    <ia-input
      [label]="label()"
      [placeholder]="placeholder()"
      [prefix]="'\u002B33'"
      [disabled]="disabled()"
      [errorText]="errorText()"
      [helperText]="helperText()"
      [value]="displayValue()"
      (valueChange)="onValueChange($event)"
    />
  `,
  styles: [`
    :host { display: block; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaPhoneInputComponent {
  label = input('Téléphone');
  placeholder = input('6 12 34 56 78');
  disabled = input(false);
  errorText = input<string | null>(null);
  helperText = input<string>('');
  value = model<string>('');

  protected displayValue = computed(() => {
    const val = this.value();
    return val ? this.formatNational(val) : '';
  });

  protected onValueChange = (formatted: string): void => {
    const e164 = this.toE164(formatted);
    this.value.set(e164);
  };

  protected formatNational = (val: string): string => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('33')) {
      const national = digits.slice(2);
      if (national.length <= 2) return national;
      if (national.length <= 4) return `${national.slice(0, 2)} ${national.slice(2)}`;
      if (national.length <= 6) return `${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4)}`;
      if (national.length <= 8) return `${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6)}`;
      return `${national.slice(0, 2)} ${national.slice(2, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)} ${national.slice(8)}`;
    }
    return val;
  };

  protected toE164 = (formatted: string): string => {
    const digits = formatted.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('33')) return '\u002B' + digits;
    if (digits.startsWith('0') && digits.length === 10) return '\u002B33' + digits.slice(1);
    if (digits.length === 9) return '\u002B33' + digits;
    return '\u002B33' + digits.replace(/^0/, '');
  };
}
