import {
  Component,
  input,
  model,
  signal,
  computed,
  OnDestroy,
  ChangeDetectionStrategy,
  output,
} from '@angular/core';
import { AddressSuggestion, AddressSearchFn } from './address-autocomplete.types';

@Component({
  selector: 'ia-address-autocomplete',
  standalone: true,
  template: `
    <div class="ia-addr"
         [class.ia-addr--open]="isOpen()"
         [class.ia-addr--error]="hasError()">
      @if (label()) {
        <label [for]="inputId" class="ia-addr__label">{{ label() }}</label>
      }

      <div class="ia-addr__input-row">
        <input
          #inputEl
          [id]="inputId"
          type="text"
          [placeholder]="placeholder()"
          [value]="value()"
          [disabled]="disabled()"
          autocomplete="off"
          role="combobox"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-controls]="listboxId"
          [attr.aria-activedescendant]="activeDescendant() || undefined"
          [attr.aria-invalid]="hasError() || null"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
          (blur)="onBlur()"
        />

        @if (isLoading()) {
          <span class="ia-addr__spinner" aria-label="Recherche...">
            <svg viewBox="0 0 16 16" class="ia-addr__spinner-icon" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
        }
      </div>

      @if (isOpen() && searchResults().length > 0) {
        <ul [id]="listboxId"
            class="ia-addr__listbox"
            role="listbox"
            [attr.aria-label]="label()"
            (click)="onListboxClick($event)">
          @for (result of searchResults(); track i; let i = $index) {
            <li [id]="optionId(i)"
                class="ia-addr__option"
                [class.ia-addr__option--active]="activeIndex() === i"
                role="option"
                [attr.aria-selected]="activeIndex() === i">
              <div class="ia-addr__option-label">{{ result.label }}</div>
              <div class="ia-addr__option-secondary">{{ result.secondary }}</div>
            </li>
          }
        </ul>
      } @else if (isOpen() && searchResults().length === 0 && query().length >= 3) {
        <div class="ia-addr__no-result" role="listbox" [id]="listboxId">
          <div class="ia-addr__no-result-text">Aucune adresse trouvée</div>
          <button class="ia-addr__manual-btn" (click)="onManualAdd()">Rajouter manuellement</button>
        </div>
      }

      @if (hasError()) {
        <div class="ia-addr__error" id="error-{{ inputId }}">
          {{ errorText() || 'Adresse invalide' }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    .ia-addr { position: relative; display: flex; flex-direction: column; gap: var(--space-1); }

    .ia-addr__label {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .ia-addr__input-row {
      display: inline-flex;
      align-items: center;
      height: var(--control-h-md);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      transition: border-color var(--motion-fast) var(--ease-out);
    }
    .ia-addr__input-row:focus-within {
      border-color: var(--color-ink);
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: var(--focus-offset);
    }
    .ia-addr--error .ia-addr__input-row {
      border-color: var(--color-error-solid);
    }

    .ia-addr__input-row input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      font-family: var(--font-sans);
      font-size: var(--text-md);
      color: var(--color-text-primary);
      padding: 0 var(--space-3);
      outline: none;
    }
    .ia-addr__input-row input::placeholder {
      color: var(--color-text-muted);
    }

    .ia-addr__spinner {
      display: inline-flex;
      padding: 0 var(--space-2);
      color: var(--color-text-muted);
    }
    .ia-addr__spinner-icon {
      width: 16px;
      height: 16px;
      animation: spin 600ms linear infinite;
    }

    .ia-addr__listbox {
      position: absolute;
      top: calc(100% + var(--space-1));
      left: 0;
      right: 0;
      max-height: 280px;
      overflow-y: auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      z-index: var(--z-dropdown);
      list-style: none;
      padding: var(--space-1) 0;
      margin: 0;
    }

    .ia-addr__option {
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
    }
    .ia-addr__option:hover,
    .ia-addr__option--active {
      background: var(--color-surface-hover);
    }

    .ia-addr__option-label {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }
    .ia-addr__option-secondary {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .ia-addr__no-result {
      position: absolute;
      top: calc(100% + var(--space-1));
      left: 0;
      right: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      z-index: var(--z-dropdown);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .ia-addr__no-result-text {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .ia-addr__manual-btn {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      padding: var(--space-1) 0;
    }
    .ia-addr__manual-btn:hover { color: var(--color-text-primary); }

    .ia-addr__error {
      font-size: var(--text-xs);
      color: var(--color-danger-text);
    }

    @keyframes spin {
      from { stroke-dasharray: 1, 20; }
      to { stroke-dasharray: 16, 4; transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaAddressAutocompleteComponent implements OnDestroy {
  label = input('Adresse');
  placeholder = input('Rechercher une adresse...');
  disabled = input(false);
  errorText = input<string | null>(null);
  searchFn = input<AddressSearchFn>(async () => []);

  value = model<string>('');
  coordinates = model<{ lat: number; lng: number } | null>(null);

  selected = output<{ label: string; lat: number; lng: number }>();

  isOpen = signal(false);
  searchResults = signal<AddressSuggestion[]>([]);
  activeIndex = signal(-1);
  isLoading = signal(false);
  query = signal('');

  inputId = 'ia-addr-' + Math.random().toString(36).slice(2, 9);
  listboxId = 'ia-listbox-' + Math.random().toString(36).slice(2, 9);

  protected hasError = computed(() => !!this.errorText());
  protected activeDescendant = computed(() => {
    if (this.activeIndex() < 0) return '';
    return this.optionId(this.activeIndex());
  });

  protected optionId = (index: number) => `${this.listboxId}-opt-${index}`;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const q = target.value;
    this.query.set(q);
    this.value.set(q);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (q.length < 3) {
      this.searchResults.set([]);
      this.isOpen.set(false);
      return;
    }

    this.isOpen.set(true);
    this.isLoading.set(true);
    this.activeIndex.set(-1);

    this.debounceTimer = setTimeout(async () => {
      try {
        const results = await this.searchFn()(q);
        this.searchResults.set(results.slice(0, 6));
      } catch {
        this.searchResults.set([]);
      }
      this.isLoading.set(false);
    }, 300);
  };

  protected onKeydown = (event: KeyboardEvent): void => {
    const len = this.searchResults().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) this.isOpen.set(true);
        this.activeIndex.set(Math.min(this.activeIndex() + 1, len - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Enter':
        if (this.isOpen() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.pickResult(this.activeIndex());
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen.set(false);
        break;
    }
  };

  protected onBlur = (): void => {
    setTimeout(() => this.isOpen.set(false), 150);
  };

  protected onListboxClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const optionEl = target.closest('.ia-addr__option');
    if (optionEl) {
      const results = this.searchResults();
      for (let i = 0; i < results.length; i++) {
        if (this.optionId(i) === optionEl.id) {
          this.pickResult(i);
          break;
        }
      }
    }
  };

  protected onManualAdd = (): void => {
    this.value.set(this.query());
    this.isOpen.set(false);
  };

  private pickResult = (index: number): void => {
    const result = this.searchResults()[index];
    if (!result) return;
    this.value.set(result.label);
    this.coordinates.set({ lat: result.lat, lng: result.lng });
    this.selected.emit({ label: result.label, lat: result.lat, lng: result.lng });
    this.isOpen.set(false);
    this.query.set('');
  };

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
