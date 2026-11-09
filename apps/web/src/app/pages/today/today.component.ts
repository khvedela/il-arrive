import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IaUIModule } from '@il-arrive/ui';
import { InterventionsStore } from '../../dashboard/interventions.store';
import { InterventionPanelComponent } from '../../dashboard/intervention-panel.component';
import { RowListComponent } from '../../dashboard/row-list.component';
import type { InterventionRow } from '../../dashboard/dashboard-api.service';

/** Refresh cadence while no push channel exists: GET /app/events is not implemented on the API yet. */
export const TODAY_REFRESH_MS = 30_000;

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [IaUIModule, RouterLink, RowListComponent, InterventionPanelComponent],
  template: `
    <header class="head">
      <h1 class="head__title">{{ t.title }}</h1>
      <a routerLink="/app/interventions/new" class="head__cta" data-testid="new-intervention">{{ t.new }}</a>
    </header>

    @switch (store.todayState()) {
      @case ('error') {
        <ia-error-state [title]="t.error" (retryClicked)="store.loadToday()" />
      }
      @case ('ready') {
        @if (isEmpty()) {
          <ia-empty-state [title]="t.empty" [description]="t.emptyHint" />
        }
        @for (g of groups(); track g.key) {
          @if (g.rows.length) {
            <section class="group" [attr.aria-label]="g.label">
              <h2 class="group__title">{{ g.label }} <span class="group__count">{{ g.rows.length }}</span></h2>
              <app-row-list [rows]="g.rows" [label]="g.label" [selectedId]="store.selectedId()" (picked)="open($event)" />
            </section>
          }
        }
      }
      @default {
        <ia-loading-state />
      }
    }

    <app-intervention-panel />
  `,
  styles: [`
    :host { display: block; padding: var(--space-8); }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
    .head__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); }
    .head__cta { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); }
    .group { margin-bottom: var(--space-6); }
    .group__title { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-2); }
    .group__count { color: var(--color-text-muted); font-weight: normal; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayComponent implements OnInit, OnDestroy {
  protected store = inject(InterventionsStore);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected t = {
    title: $localize`:@@today.title:Aujourd'hui`,
    new: $localize`:@@today.new:Nouvelle intervention`,
    error: $localize`:@@today.error:Impossible de charger les interventions`,
    empty: $localize`:@@today.empty:Aucune intervention aujourd'hui`,
    emptyHint: $localize`:@@today.emptyHint:Créez une intervention pour commencer.`,
    enRoute: $localize`:@@today.enRoute:En route`,
    late: $localize`:@@today.late:En retard`,
    upcoming: $localize`:@@today.upcoming:À venir`,
    done: $localize`:@@today.done:Terminées`,
  };

  protected groups = computed(() => {
    const g = this.store.todayGroups();
    return [
      { key: 'enRoute', label: this.t.enRoute, rows: g.enRoute },
      { key: 'late', label: this.t.late, rows: g.late },
      { key: 'upcoming', label: this.t.upcoming, rows: g.upcoming },
      { key: 'done', label: this.t.done, rows: g.done },
    ];
  });
  protected isEmpty = computed(() => this.store.todayRows().length === 0);

  ngOnInit(): void {
    void this.store.loadToday();
    void this.store.loadMembers();
    this.timer = setInterval(() => void this.store.loadToday(), TODAY_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    void this.store.select(null);
  }

  protected open(r: InterventionRow): void {
    void this.store.select(r.id);
  }
}
