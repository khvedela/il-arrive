import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IaUIModule, IaToastService, type TimelineStep, type TimeWindow } from '@il-arrive/ui';
import { DashboardApi } from './dashboard-api.service';
import { InterventionsStore } from './interventions.store';
import { eventLabel, fmtDate, fmtTime, fmtWindow, statusLabel, techName, toIso } from './intervention-utils';

/** Side panel: details, timeline, tracking link / SMS, reschedule, reassign, cancel. */
@Component({
  selector: 'app-intervention-panel',
  standalone: true,
  imports: [IaUIModule],
  template: `
    <ia-drawer [isOpen]="!!row()" [title]="t.title" [label]="t.title" (close)="close()">
      @if (row(); as r) {
        <div class="panel">
          <section class="panel__block">
            <h3 class="panel__customer">{{ r.customer?.name }}</h3>
            <p class="panel__line">{{ r.customer?.phone }}</p>
            <p class="panel__line">{{ r.addressLabel }}</p>
            <p class="panel__line">{{ date(r.windowStart) }} · {{ window(r) }}</p>
            <ia-status-badge [status]="r.status" [label]="status(r.status)" />
            @if (r.delayMinutes) {
              <p class="panel__line panel__delay">{{ t.delay }} {{ r.delayMinutes }} min{{ r.delayReason ? ' — ' + r.delayReason : '' }}</p>
            }
            <p class="panel__line">{{ t.technician }} : {{ tech(r) || t.unassigned }}</p>
            @if (r.description) { <p class="panel__line">{{ r.description }}</p> }
          </section>

          @if (store.panelError(); as err) {
            <div class="panel__error" role="alert">{{ err }}</div>
          }

          <section class="panel__block" [attr.aria-label]="t.timeline">
            <h3 class="panel__h">{{ t.timeline }}</h3>
            @if (store.detailState() === 'loading') {
              <ia-loading-state variant="text" [rows]="2" />
            } @else if (steps().length) {
              <ia-timeline [steps]="steps()" />
            } @else {
              <p class="panel__line">{{ t.noEvents }}</p>
            }
          </section>

          <section class="panel__block">
            <h3 class="panel__h">{{ t.customerLink }}</h3>
            <div class="panel__row">
              <ia-button variant="secondary" size="sm" [label]="t.copyLink" (clicked)="copyLink()" [disabled]="busy()" />
              <ia-button variant="secondary" size="sm" [label]="t.sendSms" (clicked)="sendSms()" [disabled]="busy() || !canAct()" />
              <ia-button variant="ghost" size="sm" [label]="t.edit" (clicked)="edit()" [disabled]="busy() || !canAct()" />
              <ia-button variant="ghost" size="sm" [label]="t.regenerate" (clicked)="regenerate()" [disabled]="busy() || !canAct()" />
            </div>
            @if (newLink(); as link) {
              <p class="panel__line panel__link" data-testid="new-link">{{ link }}</p>
            }
          </section>

          @if (canAct()) {
            <section class="panel__block">
              <h3 class="panel__h">{{ t.reassign }}</h3>
              <div class="panel__row panel__row--end">
                <ia-select [label]="t.technician" [placeholder]="t.choose" [options]="techOptions()" [value]="techChoice()" (valueChange)="techChoice.set($event)" />
                <ia-button variant="secondary" size="md" [label]="t.assign" (clicked)="assign()" [disabled]="busy() || !techChoice() || techChoice() === r.technicianMembershipId" />
              </div>
            </section>

            <section class="panel__block">
              <h3 class="panel__h">{{ t.reschedule }}</h3>
              <ia-date-window-picker [date]="newDate()" (dateChange)="newDate.set($event)" [window]="newWindow()" (windowChange)="newWindow.set($event)" />
              <ia-button variant="secondary" size="md" [label]="t.reschedule" (clicked)="reschedule()" [disabled]="busy() || !newDate()" />
            </section>

            <section class="panel__block">
              <ia-button variant="danger-ghost" size="md" [label]="t.cancel" (clicked)="confirmCancel.set(true)" [disabled]="busy()" />
            </section>
          }
        </div>
      }
    </ia-drawer>

    <ia-modal [isOpen]="confirmCancel()" [title]="t.cancelTitle" [label]="t.cancelTitle" [showFooter]="true" (closed)="confirmCancel.set(false)" (confirmed)="cancel()">
      <ia-textarea [label]="t.cancelReason" [value]="reason()" (valueChange)="reason.set($event)" />
      <div ia-modal-footer>
        <ia-button variant="ghost" size="md" [label]="t.back" (clicked)="confirmCancel.set(false)" />
        <ia-button variant="danger" size="md" [label]="t.confirmCancel" (clicked)="cancel()" [disabled]="busy()" />
      </div>
    </ia-modal>
  `,
  styles: [`
    .panel { display: flex; flex-direction: column; gap: var(--space-5); }
    .panel__customer { font-size: var(--text-lg); font-weight: var(--font-weight-semibold); }
    .panel__h { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); margin-bottom: var(--space-2); }
    .panel__line { font-size: var(--text-sm); color: var(--color-text-secondary); margin: var(--space-1) 0; }
    .panel__delay { color: var(--color-danger-text); }
    .panel__link { word-break: break-all; }
    .panel__row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .panel__row--end { align-items: flex-end; }
    .panel__error { font-size: var(--text-sm); color: var(--color-danger-text); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionPanelComponent {
  protected store = inject(InterventionsStore);
  private api = inject(DashboardApi);
  private toast = inject(IaToastService);
  private router = inject(Router);

  closed = output<void>();

  row = this.store.selected;
  canAct = computed(() => {
    const s = this.row()?.status;
    return !!s && s !== 'COMPLETED' && s !== 'CANCELLED';
  });
  busy = signal(false);
  confirmCancel = signal(false);
  reason = signal('');
  techChoice = signal('');
  newDate = signal('');
  newWindow = signal<TimeWindow>({ start: '08:00', end: '12:00' });
  newLink = signal('');

  techOptions = computed(() =>
    this.store.technicians().map((m) => ({ value: m.membershipId, label: `${m.firstName} ${m.lastName}`.trim() })),
  );

  steps = computed<TimelineStep[]>(() => {
    const events = this.store.detail()?.timeline ?? [];
    return events.map((e, i) => ({
      label: eventLabel(e.type),
      meta: `${fmtDate(e.createdAt)} ${fmtTime(e.createdAt)}`,
      status: i === events.length - 1 ? 'current' : 'done',
    }));
  });

  protected t = {
    title: $localize`:@@panel.title:Intervention`,
    delay: $localize`:@@panel.delay:Retard :`,
    technician: $localize`:@@panel.technician:Technicien`,
    unassigned: $localize`:@@panel.unassigned:Non assigné`,
    timeline: $localize`:@@panel.timeline:Historique`,
    noEvents: $localize`:@@panel.noEvents:Aucun évènement.`,
    customerLink: $localize`:@@panel.customerLink:Lien de suivi client`,
    copyLink: $localize`:@@panel.copyLink:Copier le lien`,
    sendSms: $localize`:@@panel.sendSms:Envoyer par SMS`,
    regenerate: $localize`:@@panel.regenerate:Régénérer le lien`,
    edit: $localize`:@@panel.edit:Modifier`,
    reassign: $localize`:@@panel.reassign:Réassigner`,
    choose: $localize`:@@panel.choose:Choisir…`,
    assign: $localize`:@@panel.assign:Assigner`,
    reschedule: $localize`:@@panel.reschedule:Reprogrammer`,
    cancel: $localize`:@@panel.cancel:Annuler l'intervention`,
    cancelTitle: $localize`:@@panel.cancelTitle:Annuler l'intervention ?`,
    cancelReason: $localize`:@@panel.cancelReason:Motif (optionnel)`,
    back: $localize`:@@panel.back:Retour`,
    confirmCancel: $localize`:@@panel.confirmCancel:Confirmer l'annulation`,
    copied: $localize`:@@panel.copied:Lien copié`,
    smsSent: $localize`:@@panel.smsSent:SMS envoyé`,
    regenerated: $localize`:@@panel.regenerated:Nouveau lien généré — l'ancien est révoqué`,
  };

  protected status = statusLabel;
  protected tech = techName;
  protected window = fmtWindow;
  protected date = fmtDate;

  close(): void {
    this.newLink.set('');
    void this.store.select(null);
    this.closed.emit();
  }

  edit(): void {
    const id = this.row()?.id;
    if (id) void this.router.navigate(['/app/interventions', id, 'edit']);
  }

  async copyLink(): Promise<void> {
    const id = this.row()?.id;
    if (!id) return;
    await this.guard(async () => {
      const { link } = await firstValueFrom(this.api.shareMessage(id));
      await navigator.clipboard.writeText(link);
      this.toast.show(this.t.copied, 'success');
    });
  }

  async sendSms(): Promise<void> {
    const id = this.row()?.id;
    if (!id) return;
    await this.guard(async () => {
      await firstValueFrom(this.api.sendSms(id, 'CONFIRMATION'));
      this.toast.show(this.t.smsSent, 'success');
    });
  }

  async regenerate(): Promise<void> {
    const id = this.row()?.id;
    if (!id) return;
    await this.guard(async () => {
      const { url } = await firstValueFrom(this.api.regenerateLink(id));
      this.newLink.set(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      this.toast.show(this.t.regenerated, 'success');
    });
  }

  async assign(): Promise<void> {
    await this.guard(async () => {
      await this.store.assign(this.techChoice());
    });
  }

  async reschedule(): Promise<void> {
    const date = this.newDate();
    const w = this.newWindow();
    await this.guard(async () => {
      await this.store.reschedule(toIso(date, '00:00'), toIso(date, w.start), toIso(date, w.end));
      this.newDate.set('');
    });
  }

  async cancel(): Promise<void> {
    await this.guard(async () => {
      if (await this.store.cancel(this.reason().trim())) {
        this.confirmCancel.set(false);
        this.reason.set('');
      }
    });
  }

  /** Serialises panel actions and reports failures through the store's panel error. */
  private async guard(fn: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await fn();
    } catch (e) {
      this.store.panelError.set((e as { error?: { message?: string } })?.error?.message ?? $localize`:@@panel.actionFailed:L'action a échoué. Réessayez.`);
    } finally {
      this.busy.set(false);
    }
  }
}
