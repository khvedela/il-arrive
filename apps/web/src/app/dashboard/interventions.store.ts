import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DashboardApi,
  type InterventionDetail,
  type InterventionRow,
  type ListFilters,
  type MemberDto,
} from './dashboard-api.service';
import { groupToday } from './intervention-utils';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Signals store shared by Today, the interventions list and the side panel. */
@Injectable({ providedIn: 'root' })
export class InterventionsStore {
  private api = inject(DashboardApi);

  readonly todayRows = signal<InterventionRow[]>([]);
  readonly todayState = signal<LoadState>('idle');
  readonly now = signal(new Date());
  readonly todayGroups = computed(() => groupToday(this.todayRows(), this.now()));

  readonly listRows = signal<InterventionRow[]>([]);
  readonly listState = signal<LoadState>('idle');
  readonly filters = signal<ListFilters>({});

  readonly members = signal<MemberDto[]>([]);
  readonly technicians = computed(() => this.members().filter((m) => m.isTechnician || m.role === 'TECHNICIAN'));

  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<InterventionDetail | null>(null);
  readonly detailState = signal<LoadState>('idle');
  readonly panelError = signal<string | null>(null);

  readonly selected = computed<InterventionRow | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    const row = [...this.listRows(), ...this.todayRows()].find((r) => r.id === id) ?? null;
    const d = this.detail();
    // The detail endpoint omits customer/technician, so keep them from the list row.
    return d && d.intervention.id === id ? { ...row, ...d.intervention, customer: row?.customer, technician: row?.technician } : row;
  });

  async loadToday(): Promise<void> {
    if (this.todayState() !== 'ready') this.todayState.set('loading');
    try {
      const groups = await firstValueFrom(this.api.today());
      this.todayRows.set(groups.flatMap((g) => g.interventions));
      this.now.set(new Date());
      this.todayState.set('ready');
    } catch {
      this.todayState.set('error');
    }
  }

  async loadList(filters: ListFilters = this.filters()): Promise<void> {
    this.filters.set(filters);
    this.listState.set('loading');
    try {
      this.listRows.set(await firstValueFrom(this.api.list(filters)));
      this.listState.set('ready');
    } catch {
      this.listState.set('error');
    }
  }

  async loadMembers(): Promise<void> {
    try {
      this.members.set(await firstValueFrom(this.api.members()));
    } catch {
      this.members.set([]);
    }
  }

  async select(id: string | null): Promise<void> {
    this.selectedId.set(id);
    this.detail.set(null);
    this.panelError.set(null);
    if (!id) return;
    this.detailState.set('loading');
    try {
      this.detail.set(await firstValueFrom(this.api.get(id)));
      this.detailState.set('ready');
    } catch {
      this.detailState.set('error');
    }
  }

  /** Runs a panel action, then refreshes the open intervention and both lists. */
  async act(run: () => Promise<unknown>): Promise<boolean> {
    this.panelError.set(null);
    try {
      await run();
    } catch (e) {
      this.panelError.set((e as { error?: { message?: string } })?.error?.message ?? $localize`:@@panel.actionFailed:L'action a échoué. Réessayez.`);
      return false;
    }
    const id = this.selectedId();
    await Promise.all([this.refreshSelected(id), this.loadToday(), this.listState() === 'idle' ? Promise.resolve() : this.loadList()]);
    return true;
  }

  private async refreshSelected(id: string | null): Promise<void> {
    if (!id || this.selectedId() !== id) return;
    try {
      this.detail.set(await firstValueFrom(this.api.get(id)));
    } catch {
      /* keep the previous detail */
    }
  }

  assign(technicianMembershipId: string): Promise<boolean> {
    const id = this.selectedId();
    return id ? this.act(() => firstValueFrom(this.api.assign(id, { technicianMembershipId }))) : Promise.resolve(false);
  }

  cancel(reason: string): Promise<boolean> {
    const id = this.selectedId();
    return id ? this.act(() => firstValueFrom(this.api.cancel(id, reason))) : Promise.resolve(false);
  }

  reschedule(newScheduledDate: string, newWindowStart: string, newWindowEnd: string): Promise<boolean> {
    const id = this.selectedId();
    return id ? this.act(() => firstValueFrom(this.api.reschedule(id, { newScheduledDate, newWindowStart, newWindowEnd }))) : Promise.resolve(false);
  }
}
