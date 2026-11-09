import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IaUIModule } from '@il-arrive/ui';
import type { InterventionStatus } from '@il-arrive/contracts';
import { InterventionsStore } from '../../dashboard/interventions.store';
import { InterventionPanelComponent } from '../../dashboard/intervention-panel.component';
import { RowListComponent } from '../../dashboard/row-list.component';
import { statusLabel } from '../../dashboard/intervention-utils';
import type { InterventionRow, ListFilters } from '../../dashboard/dashboard-api.service';

const STATUSES: InterventionStatus[] = ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'CANCELLED'];

/** Builds the API query from the filter controls (empty values are dropped). */
export function buildFilters(status: string, technicianId: string, from: string, to: string): ListFilters {
  const f: ListFilters = {};
  if (status) f.status = status as InterventionStatus;
  if (technicianId) f.technicianId = technicianId;
  if (from) f.dateFrom = new Date(`${from}T00:00:00`).toISOString();
  if (to) f.dateTo = new Date(`${to}T23:59:59`).toISOString();
  return f;
}

@Component({
  selector: 'app-interventions',
  standalone: true,
  imports: [FormsModule, IaUIModule, RouterLink, RowListComponent, InterventionPanelComponent],
  template: `
    <header class="head">
      <h1 class="head__title">{{ t.title }}</h1>
      <a routerLink="/app/interventions/new" class="head__cta">{{ t.new }}</a>
    </header>

    <form class="filters" (ngSubmit)="apply()" [attr.aria-label]="t.filters">
      <ia-select [label]="t.status" [placeholder]="t.all" [options]="statusOptions" [value]="status()" (valueChange)="status.set($event)" />
      <ia-select [label]="t.technician" [placeholder]="t.all" [options]="techOptions()" [value]="tech()" (valueChange)="tech.set($event)" />
      <ia-input [label]="t.from" type="date" [value]="from()" (valueChange)="from.set($event)" />
      <ia-input [label]="t.to" type="date" [value]="to()" (valueChange)="to.set($event)" />
      <ia-button type="submit" variant="secondary" size="md" [label]="t.apply" />
      <ia-button variant="ghost" size="md" [label]="t.reset" (clicked)="reset()" />
    </form>

    @switch (store.listState()) {
      @case ('error') { <ia-error-state [title]="t.error" (retryClicked)="apply()" /> }
      @case ('ready') {
        @if (store.listRows().length) {
          <app-row-list [rows]="store.listRows()" [label]="t.title" [showDate]="true" [selectedId]="store.selectedId()" (picked)="open($event)" />
        } @else {
          <ia-empty-state [title]="t.empty" />
        }
      }
      @default { <ia-loading-state /> }
    }

    <app-intervention-panel />
  `,
  styles: [`
    :host { display: block; padding: var(--space-8); }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
    .head__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); }
    .head__cta { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); }
    .filters { display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; margin-bottom: var(--space-6); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionsComponent implements OnInit, OnDestroy {
  protected store = inject(InterventionsStore);

  status = signal('');
  tech = signal('');
  from = signal('');
  to = signal('');

  protected t = {
    title: $localize`:@@list.title:Interventions`,
    new: $localize`:@@list.new:Nouvelle intervention`,
    filters: $localize`:@@list.filters:Filtres`,
    status: $localize`:@@list.status:Statut`,
    technician: $localize`:@@list.technician:Technicien`,
    all: $localize`:@@list.all:Tous`,
    from: $localize`:@@list.from:Du`,
    to: $localize`:@@list.to:Au`,
    apply: $localize`:@@list.apply:Filtrer`,
    reset: $localize`:@@list.reset:Réinitialiser`,
    error: $localize`:@@list.error:Impossible de charger les interventions`,
    empty: $localize`:@@list.empty:Aucune intervention ne correspond.`,
  };

  protected statusOptions = [{ value: '', label: this.t.all }, ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))];
  protected techOptions = computed(() => [
    { value: '', label: this.t.all },
    ...this.store.technicians().map((m) => ({ value: m.membershipId, label: `${m.firstName} ${m.lastName}`.trim() })),
  ]);

  ngOnInit(): void {
    void this.store.loadMembers();
    void this.store.loadList({});
  }

  ngOnDestroy(): void {
    void this.store.select(null);
  }

  apply(): void {
    void this.store.loadList(buildFilters(this.status(), this.tech(), this.from(), this.to()));
  }

  reset(): void {
    this.status.set('');
    this.tech.set('');
    this.from.set('');
    this.to.set('');
    this.apply();
  }

  protected open(r: InterventionRow): void {
    void this.store.select(r.id);
  }
}
