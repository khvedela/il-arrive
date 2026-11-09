import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IaUIModule } from '@il-arrive/ui';
import type { InterventionRow } from './dashboard-api.service';
import { fmtDate, fmtTime, statusLabel, techName } from './intervention-utils';

/** A keyboard-navigable list of intervention rows (shared by Today and the list page). */
@Component({
  selector: 'app-row-list',
  standalone: true,
  imports: [IaUIModule],
  template: `
    <div role="listbox" [attr.aria-label]="label()" class="rows">
      @for (r of rows(); track r.id) {
        <ia-list-row
          [time]="time(r)"
          [date]="showDate() ? date(r) : ''"
          [title]="r.customer?.name ?? ''"
          [subtitle]="r.addressLabel"
          [statusType]="r.status"
          [statusLabel]="status(r)"
          [techName]="tech(r)"
          [delay]="r.delayMinutes ? '+' + r.delayMinutes + ' min' : ''"
          [selected]="r.id === selectedId()"
          (select)="picked.emit(r)"
        />
      }
    </div>
  `,
  styles: [`.rows { display: flex; flex-direction: column; gap: var(--space-2); }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowListComponent {
  rows = input<InterventionRow[]>([]);
  label = input('');
  showDate = input(false);
  selectedId = input<string | null>(null);
  picked = output<InterventionRow>();

  protected time = (r: InterventionRow) => fmtTime(r.windowStart);
  protected date = (r: InterventionRow) => fmtDate(r.windowStart);
  protected status = (r: InterventionRow) => statusLabel(r.status);
  protected tech = techName;
}
