import { Component, signal, computed, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IaListRowComponent,
  IaEmptyStateComponent,
  IaErrorStateComponent,
  IaToastService,
  IaAvatarComponent,
} from '@il-arrive/ui';
import { TechApiService } from '../services/tech-api.service';
import type { TechIntervention, TechTodayResponse } from '../models/intervention';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import type { InterventionStatus } from '@il-arrive/contracts';

interface GroupedInterventions {
  inProgress: TechIntervention[];
  upcoming: TechIntervention[];
  completed: TechIntervention[];
  cancelled: TechIntervention[];
}

function groupInterventions(interventions: TechIntervention[]): GroupedInterventions {
  const result: GroupedInterventions = {
    inProgress: [],
    upcoming: [],
    completed: [],
    cancelled: [],
  };

  for (const inv of interventions) {
    switch (inv.status) {
      case IS.EN_ROUTE:
      case IS.ARRIVED:
        result.inProgress.push(inv);
        break;
      case IS.SCHEDULED:
        result.upcoming.push(inv);
        break;
      case IS.COMPLETED:
        result.completed.push(inv);
        break;
      case IS.CANCELLED:
        result.cancelled.push(inv);
        break;
    }
  }

  result.upcoming.sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  result.completed.sort((a, b) => b.windowStart.localeCompare(a.windowStart));

  return result;
}

function formatWindow(inv: TechIntervention): string {
  return `${inv.windowStart}–${inv.windowEnd}`;
}

function formatTodayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

@Component({
  selector: 'tech-today',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IaListRowComponent,
    IaEmptyStateComponent,
    IaErrorStateComponent,
    IaAvatarComponent,
  ],
  template: `
    <div class="tech-today">
      @if (state() === 'loading') {
        <div class="tech-today__skeleton">
          <div class="tech-today__skeleton-row" *ngFor="let i of [1,2,3]"></div>
        </div>
      } @else if (state() === 'error') {
        <ia-error-state
          title="Impossible de charger les interventions"
          message="Vérifiez votre connexion et réessayez."
          [retryLabel]="'Réessayer'"
          (retry)="loadToday()"
        />
      } @else if (grouped().inProgress.length === 0 && grouped().upcoming.length === 0 && grouped().completed.length === 0 && grouped().cancelled.length === 0) {
        <ia-empty-state
          icon="calendar"
          title="Aucune intervention aujourd'hui"
          message="Les rendez-vous créés apparaîtront ici."
        />
      } @else {
        <div class="tech-today__content">
          <header class="tech-today__header">
            <div>
              <h1 class="tech-today__title">Aujourd'hui</h1>
              <p class="tech-today__date">{{ dateLabel() }}</p>
              <p class="tech-today__count">{{ totalCount() }} interventions{{ inProgressCount() > 0 ? ' · ' + inProgressCount() + ' en cours' : '' }}</p>
            </div>
            <ia-avatar name="Marc Lefebvre" [size]="48" />
          </header>

          @if (grouped().inProgress.length > 0) {
            <section class="tech-today__group">
              <h2 class="tech-today__group-title">EN COURS ({{ grouped().inProgress.length }})</h2>
              @for (inv of grouped().inProgress; track inv.id) {
                <a [routerLink]="['/tech/i', inv.id]" class="tech-today__link">
                  <div class="tech-today__active-bar"></div>
                  <ia-list-row
                    [time]="formatWindow(inv)"
                    [title]="inv.customerName.toUpperCase()"
                    [subtitle]="inv.addressLabel"
                    [statusType]="inv.status"
                    [techName]="inv.technicianName || ''"
                    [selected]="true"
                  />
                  @if (inv.delayMinutes) {
                    <span class="tech-today__delay-chip">+{{ inv.delayMinutes }} min</span>
                  }
                </a>
              }
            </section>
          }

          @if (grouped().upcoming.length > 0) {
            <section class="tech-today__group">
              <h2 class="tech-today__group-title">À VENIR ({{ grouped().upcoming.length }})</h2>
              @for (inv of grouped().upcoming; track inv.id) {
                <a [routerLink]="['/tech/i', inv.id]" class="tech-today__link">
                  <ia-list-row
                    [time]="formatWindow(inv)"
                    [title]="inv.customerName.toUpperCase()"
                    [subtitle]="inv.addressLabel"
                    [statusType]="inv.status"
                    [techName]="inv.technicianName || ''"
                  />
                </a>
              }
            </section>
          }

          @if (grouped().completed.length > 0) {
            <section class="tech-today__group">
              <h2 class="tech-today__group-title">TERMINÉES ({{ grouped().completed.length }})</h2>
              @for (inv of grouped().completed; track inv.id) {
                <a [routerLink]="['/tech/i', inv.id]" class="tech-today__link">
                  <ia-list-row
                    [time]="formatWindow(inv)"
                    [title]="inv.customerName.toUpperCase()"
                    [subtitle]="inv.addressLabel"
                    [statusType]="inv.status"
                    [techName]="inv.technicianName || ''"
                  />
                </a>
              }
            </section>
          }

          @if (grouped().cancelled.length > 0) {
            <section class="tech-today__group">
              <h2 class="tech-today__group-title">ANNULÉES ({{ grouped().cancelled.length }})</h2>
              @for (inv of grouped().cancelled; track inv.id) {
                <a [routerLink]="['/tech/i', inv.id]" class="tech-today__link">
                  <ia-list-row
                    [time]="formatWindow(inv)"
                    [title]="inv.customerName.toUpperCase()"
                    [subtitle]="inv.addressLabel"
                    [statusType]="inv.status"
                    [techName]="inv.technicianName || ''"
                  />
                </a>
              }
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      max-width: var(--tech-column-max);
      margin: 0 auto;
      min-height: 100vh;
      background: var(--color-bg);
    }

    .tech-today {
      padding: var(--space-4);
    }

    .tech-today__skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4) 0;
    }

    .tech-today__skeleton-row {
      height: 72px;
      background: var(--color-surface-muted);
      border-radius: var(--radius-md);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .tech-today__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .tech-today__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: var(--space-4) 0 var(--space-2);
    }

    .tech-today__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-tight);
    }

    .tech-today__date {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .tech-today__count {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .tech-today__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .tech-today__group-title {
      font-size: var(--text-overline);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-overline);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      padding: var(--space-2) var(--space-4) var(--space-1);
    }

    .tech-today__link {
      text-decoration: none;
      color: inherit;
      position: relative;
      display: block;
    }

    .tech-today__active-bar {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--color-enroute-solid);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }

    .tech-today__delay-chip {
      display: inline-block;
      font-size: var(--text-xs);
      color: var(--color-warning-fg);
      background: var(--color-warning-bg);
      padding: 2px var(--space-1);
      border-radius: var(--radius-sm);
      margin-left: var(--space-4);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechTodayComponent implements OnInit {
  private techApi = inject(TechApiService);
  private toast = inject(IaToastService);

  state = signal<'loading' | 'loaded' | 'error'>('loading');
  todayData = signal<TechTodayResponse | null>(null);
  grouped = signal<GroupedInterventions>({ inProgress: [], upcoming: [], completed: [], cancelled: [] });

  dateLabel = computed(() => {
    if (!this.todayData()) return '';
    return formatTodayDate(this.todayData()!.date);
  });

  totalCount = computed(() => {
    const g = this.grouped();
    return g.inProgress.length + g.upcoming.length + g.completed.length + g.cancelled.length;
  });

  inProgressCount = computed(() => this.grouped().inProgress.length);

  protected formatWindow = (inv: TechIntervention) => formatWindow(inv);

  ngOnInit() {
    this.loadToday();
  }

  loadToday() {
    this.state.set('loading');
    this.techApi.fetchToday().subscribe({
      next: (data: TechTodayResponse) => {
        this.todayData.set(data);
        this.grouped.set(groupInterventions(data.interventions));
        this.state.set('loaded');
      },
      error: () => {
        this.state.set('error');
        this.toast.error('Impossible de charger les interventions');
      },
    });
  }
}
