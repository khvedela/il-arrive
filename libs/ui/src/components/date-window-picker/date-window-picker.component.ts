import { Component, input, model, computed, ChangeDetectionStrategy } from '@angular/core';
import { IaInputComponent } from '../input/input.component';
import { IaButtonComponent } from '../button/button.component';

export interface TimeWindow {
  start: string;
  end: string;
}

export interface QuickChip {
  label: string;
  value: TimeWindow;
}

const DEFAULT_CHIPS: QuickChip[] = [
  { label: '8h–12h', value: { start: '08:00', end: '12:00' } },
  { label: '13h–18h', value: { start: '13:00', end: '18:00' } },
  { label: '8h–18h', value: { start: '08:00', end: '18:00' } },
  { label: '4h', value: { start: '09:00', end: '13:00' } },
];

@Component({
  selector: 'ia-date-window-picker',
  standalone: true,
  imports: [IaInputComponent, IaButtonComponent],
  template: `
    <div class="ia-date-window-picker">
      <div class="ia-date-window-picker__fields">
        <ia-input
          label="Date"
          type="date"
          [placeholder]="'Date'"
          [errorText]="dateError()"
          [value]="date()"
          (valueChange)="date.set($event)"
        />
      </div>

      <div class="ia-date-window-picker__window">
        <div class="ia-date-window-picker__times">
          <ia-input
            label="Créneau (début–fin)"
            type="time"
            [value]="window().start"
            (valueChange)="onStartChange($event)"
            [errorText]="windowError()"
            step="1800"
          />
          <span class="ia-date-window-picker__separator">–</span>
          <ia-input
            type="time"
            [value]="window().end"
            (valueChange)="onEndChange($event)"
            step="1800"
          />
        </div>

        <div class="ia-date-window-picker__chips">
          @for (chip of chips(); track chip.label) {
            <ia-button
              variant="secondary"
              size="sm"
              [label]="chip.label"
              [class.ia-date-window-picker__chip--selected]="selectedChip() === chip.label"
              (clicked)="onChipSelect(chip)"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ia-date-window-picker {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .ia-date-window-picker__fields {
      max-width: 480px;
    }

    .ia-date-window-picker__window {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .ia-date-window-picker__times {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
    }
    .ia-date-window-picker__times ia-input { flex: 1; }

    .ia-date-window-picker__separator {
      padding-bottom: var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--text-md);
    }

    .ia-date-window-picker__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .ia-date-window-picker__chip--selected {
      background: var(--color-enroute-bg) !important;
      border-color: var(--color-enroute-border) !important;
      color: var(--color-enroute-fg) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaDateWindowPickerComponent {
  date = model<string>('');
  window = model<TimeWindow>({ start: '08:00', end: '12:00' });
  chips = input<QuickChip[]>(DEFAULT_CHIPS);

  dateError = computed(() => {
    if (!this.date()) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(this.date());
    if (selected < today) return 'La date est passée';
    return null;
  });

  windowError = computed(() => {
    const w = this.window();
    if (w.start && w.end && w.start >= w.end) return 'L\'heure de fin doit être après le début';
    return null;
  });

  selectedChip = computed(() => {
    const w = this.window();
    return this.chips().find(c => c.value.start === w.start && c.value.end === w.end)?.label || '';
  });

  protected onStartChange = (val: string): void => {
    this.window.update(w => ({ ...w, start: val }));
  };

  protected onEndChange = (val: string): void => {
    this.window.update(w => ({ ...w, end: val }));
  };

  protected onChipSelect = (chip: QuickChip): void => {
    this.window.set({ ...chip.value });
  };
}
