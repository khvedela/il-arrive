import { Component, input, model, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { SelectOption } from './select.types';

@Component({
  selector: 'ia-select',
  standalone: true,
  imports: [],
  template: `
    <div class="ia-select">
      @if (label()) {
        <label [for]="selectId" class="ia-select__label">{{ label() }}</label>
      }
      @if (usePopover()) {
        <div class="ia-select__combobox" [class.ia-select__combobox--open]="isOpen()">
          <div class="ia-select__trigger" (click)="togglePopover()" (keydown)="onTriggerKeydown($event)"
               role="combobox" [attr.aria-expanded]="isOpen()" [attr.aria-controls]="listboxId"
               [attr.aria-activedescendant]="activeDescendant()">
            <span class="ia-select__value" [class.ia-select__value--placeholder]="!value()">
              {{ selectedLabel() || placeholder() }}
            </span>
            <span class="ia-select__chevron" aria-hidden="true">&#x25BE;</span>
          </div>
          @if (isOpen()) {
            <ul [id]="listboxId" class="ia-select__listbox" role="listbox" [attr.aria-label]="label()" (click)="onListboxClick($event)">
              @for (opt of options(); track opt.value) {
                <li [id]="optionId(opt.value)" class="ia-select__option"
                    [class.ia-select__option--active]="activeIndex() === options().indexOf(opt)"
                    [class.ia-select__option--selected]="value() === opt.value"
                    role="option" [attr.aria-selected]="value() === opt.value">
                  {{ opt.label }}
                </li>
              }
            </ul>
          }
        </div>
      } @else {
        <select [id]="selectId" [disabled]="disabled()" [attr.aria-invalid]="hasError() || null"
                (change)="onChange($event)" class="ia-select__native">
          @if (placeholder()) {
            <option value="" disabled selected>{{ placeholder() }}</option>
          }
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="value() === opt.value">{{ opt.label }}</option>
          }
        </select>
      }
      @if (helperText() && !hasError()) {
        <div class="ia-select__helper">{{ helperText() }}</div>
      }
      @if (hasError()) {
        <div class="ia-select__error">{{ errorText() || 'Ce champ est invalide' }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .ia-select { display: flex; flex-direction: column; gap: var(--space-1); }
    .ia-select__label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .ia-select__native {
      height: var(--control-h-md); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
      background: var(--color-surface); font-family: var(--font-sans); font-size: var(--text-md);
      color: var(--color-text-primary); padding: 0 var(--space-3); outline: none; appearance: none;
      cursor: pointer; width: 100%;
    }
    .ia-select__native:focus { border-color: var(--color-ink); outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
    .ia-select__native:disabled { background: var(--color-surface-muted); color: var(--color-text-muted); border-color: var(--color-border); }

    .ia-select__combobox { position: relative; }
    .ia-select__trigger {
      display: flex; align-items: center; justify-content: space-between; height: var(--control-h-md);
      border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-surface);
      padding: 0 var(--space-3); cursor: pointer; font-family: var(--font-sans); font-size: var(--text-md);
      color: var(--color-text-primary); outline: none;
    }
    .ia-select__trigger:focus-visible { border-color: var(--color-ink); outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
    .ia-select__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ia-select__value--placeholder { color: var(--color-text-muted); }
    .ia-select__chevron { flex-shrink: 0; margin-left: var(--space-2); color: var(--color-text-muted); }

    .ia-select__listbox {
      position: absolute; top: calc(100% + var(--space-1)); left: 0; right: 0;
      max-height: 240px; overflow-y: auto; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      box-shadow: var(--shadow-md); padding: var(--space-1) 0;
      z-index: var(--z-dropdown); list-style: none; margin: 0;
    }
    .ia-select__option { padding: var(--space-2) var(--space-4); cursor: pointer; font-size: var(--text-sm); color: var(--color-text-primary); }
    .ia-select__option:hover, .ia-select__option--active { background: var(--color-surface-hover); }
    .ia-select__option--selected { font-weight: var(--font-weight-semibold); }
    .ia-select__helper { font-size: var(--text-xs); color: var(--color-text-muted); }
    .ia-select__error { font-size: var(--text-xs); color: var(--color-danger-text); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaSelectComponent {
  label = input<string>('');
  placeholder = input<string>('');
  options = input<SelectOption[]>([]);
  value = model<string>('');
  disabled = input(false);
  helperText = input<string>('');
  errorText = input<string | null>(null);

  isOpen = signal(false);
  activeIndex = signal(-1);

  selectId = 'ia-select-' + Math.random().toString(36).slice(2, 9);
  listboxId = 'ia-listbox-' + Math.random().toString(36).slice(2, 9);

  protected hasError = computed(() => !!this.errorText());
  protected selectedLabel = computed(() => this.options().find(o => o.value === this.value())?.label || '');
  protected usePopover = computed(() => this.options().length > 12);
  protected activeDescendant = computed(() => {
    const idx = this.activeIndex();
    if (idx < 0) return '';
    const opt = this.options()[idx];
    return opt ? this.optionId(opt.value) : '';
  });

  protected optionId = (value: string) => `${this.listboxId}-${value}`;

  protected togglePopover = (): void => {
    this.isOpen.set(!this.isOpen());
    if (!this.isOpen()) this.activeIndex.set(-1);
  };

  protected onTriggerKeydown = (event: KeyboardEvent): void => {
    const len = this.options().length;
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); if (!this.isOpen()) this.isOpen.set(true); else this.activeIndex.set(Math.min(this.activeIndex() + 1, len - 1)); break;
      case 'ArrowUp': event.preventDefault(); this.activeIndex.set(Math.max(this.activeIndex() - 1, 0)); break;
      case 'Home': event.preventDefault(); this.activeIndex.set(0); break;
      case 'End': event.preventDefault(); this.activeIndex.set(len - 1); break;
      case 'Escape': event.preventDefault(); this.isOpen.set(false); break;
      case 'Enter': case ' ':
        if (this.isOpen() && this.activeIndex() >= 0) { event.preventDefault(); const opt = this.options()[this.activeIndex()]; if (opt) { this.value.set(opt.value); this.isOpen.set(false); } }
        break;
    }
  };

  protected onListboxClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const opt = this.options().find(o => this.optionId(o.value) === target.id);
    if (opt) { this.value.set(opt.value); this.isOpen.set(false); }
  };

  protected onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    this.value.set(target.value);
  };
}
