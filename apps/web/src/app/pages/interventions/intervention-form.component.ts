import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { IaUIModule, type AddressSearchFn, type TimeWindow } from '@il-arrive/ui';
import type { CreateInterventionDto } from '@il-arrive/contracts';
import { DashboardApi } from '../../dashboard/dashboard-api.service';
import { InterventionsStore } from '../../dashboard/interventions.store';
import { toDateInput, toIso } from '../../dashboard/intervention-utils';

export interface FormValue {
  name: string;
  phone: string;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  date: string;
  window: TimeWindow;
}

export type FormErrors = Partial<Record<'name' | 'phone' | 'address' | 'date' | 'window', string>>;

/** Pure validation so the rules are testable without rendering. */
export function validateForm(v: FormValue, today = new Date(), editing = false): FormErrors {
  const e: FormErrors = {};
  if (!editing) {
    if (!v.name.trim()) e.name = $localize`:@@form.nameRequired:Le nom du client est requis`;
    if (!/^\+[1-9]\d{7,14}$/.test(v.phone)) e.phone = $localize`:@@form.phoneInvalid:Numéro de téléphone invalide`;
    if (!v.address.trim() || !v.coordinates) e.address = $localize`:@@form.addressRequired:Choisissez une adresse dans la liste`;
  }
  if (!v.date) e.date = $localize`:@@form.dateRequired:La date est requise`;
  else if (v.date < toDateInput(today.toISOString())) e.date = $localize`:@@form.datePast:La date est passée`;
  if (!v.window.start || !v.window.end || v.window.start >= v.window.end) {
    e.window = $localize`:@@form.windowInvalid:Le créneau est invalide`;
  }
  return e;
}

export function toCreateDto(customerId: string, v: FormValue, description: string): CreateInterventionDto {
  return {
    customerId,
    addressLabel: v.address.trim(),
    addressLat: v.coordinates!.lat,
    addressLng: v.coordinates!.lng,
    scheduledDate: toIso(v.date, '00:00'),
    windowStart: toIso(v.date, v.window.start),
    windowEnd: toIso(v.date, v.window.end),
    ...(description.trim() && { description: description.trim() }),
  };
}

@Component({
  selector: 'app-intervention-form',
  standalone: true,
  imports: [FormsModule, IaUIModule, RouterLink],
  template: `
    <header class="head">
      <h1 class="head__title">{{ editing() ? t.editTitle : t.newTitle }}</h1>
      <a routerLink="/app/interventions" class="head__back">{{ t.back }}</a>
    </header>

    <form class="form" (ngSubmit)="submit()" [attr.aria-label]="t.newTitle" novalidate>
      <ia-input [label]="t.name" [required]="true" [disabled]="editing()" [errorText]="shown().name ?? null" [value]="name()" (valueChange)="name.set($event)" />
      <ia-phone-input [label]="t.phone" [disabled]="editing()" [errorText]="shown().phone ?? null" [value]="phone()" (valueChange)="phone.set($event)" />
      <ia-address-autocomplete
        [label]="t.address"
        [disabled]="editing()"
        [errorText]="shown().address ?? null"
        [searchFn]="searchAddress"
        [value]="address()"
        (valueChange)="address.set($event); coordinates.set(null)"
        (selected)="onAddress($event)"
      />
      <ia-date-window-picker [date]="date()" (dateChange)="date.set($event)" [window]="window()" (windowChange)="window.set($event)" />
      @if (shown().date) { <p class="form__error" role="alert">{{ shown().date }}</p> }
      @if (shown().window) { <p class="form__error" role="alert">{{ shown().window }}</p> }
      <ia-select [label]="t.technician" [placeholder]="t.unassigned" [options]="techOptions()" [value]="technician()" (valueChange)="technician.set($event)" />
      <ia-textarea [label]="t.description" [value]="description()" (valueChange)="description.set($event)" />

      @if (submitError()) { <div class="form__error" role="alert">{{ submitError() }}</div> }

      <ia-button type="submit" variant="primary" size="action" [label]="editing() ? t.save : t.create" [loading]="saving()" [disabled]="saving()" />
    </form>
  `,
  styles: [`
    :host { display: block; padding: var(--space-8); max-width: 640px; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
    .head__title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); }
    .head__back { color: var(--color-text-secondary); font-size: var(--text-sm); }
    .form { display: flex; flex-direction: column; gap: var(--space-4); }
    .form__error { font-size: var(--text-sm); color: var(--color-danger-text); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionFormComponent implements OnInit {
  private api = inject(DashboardApi);
  private store = inject(InterventionsStore);
  private router = inject(Router);

  /** Route param (`withComponentInputBinding`-style); set for the edit route. */
  id = input<string | undefined>(undefined);
  editing = computed(() => !!this.id());

  name = signal('');
  phone = signal('');
  address = signal('');
  coordinates = signal<{ lat: number; lng: number } | null>(null);
  date = signal('');
  window = signal<TimeWindow>({ start: '08:00', end: '12:00' });
  technician = signal('');
  description = signal('');

  saving = signal(false);
  submitted = signal(false);
  submitError = signal('');
  private original: { date: string; window: TimeWindow; technician: string; description: string } | null = null;

  value = computed<FormValue>(() => ({
    name: this.name(), phone: this.phone(), address: this.address(),
    coordinates: this.coordinates(), date: this.date(), window: this.window(),
  }));
  errors = computed(() => validateForm(this.value(), new Date(), this.editing()));
  shown = computed<FormErrors>(() => (this.submitted() ? this.errors() : {}));
  techOptions = computed(() => [
    { value: '', label: this.t.unassigned },
    ...this.store.technicians().map((m) => ({ value: m.membershipId, label: `${m.firstName} ${m.lastName}`.trim() })),
  ]);

  protected t = {
    newTitle: $localize`:@@form.newTitle:Nouvelle intervention`,
    editTitle: $localize`:@@form.editTitle:Modifier l'intervention`,
    back: $localize`:@@form.back:Retour à la liste`,
    name: $localize`:@@form.name:Nom du client`,
    phone: $localize`:@@form.phone:Téléphone du client`,
    address: $localize`:@@form.address:Adresse`,
    technician: $localize`:@@form.technician:Technicien`,
    unassigned: $localize`:@@form.unassigned:Non assigné`,
    description: $localize`:@@form.description:Description`,
    create: $localize`:@@form.create:Créer l'intervention`,
    save: $localize`:@@form.save:Enregistrer`,
    failed: $localize`:@@form.failed:L'enregistrement a échoué. Vérifiez les champs et réessayez.`,
  };

  /** AddressAutocomplete → GET /geo/search. */
  protected searchAddress: AddressSearchFn = async (q) =>
    (await firstValueFrom(this.api.geoSearch(q))).map((r) => ({ label: r.label, secondary: '', lat: r.lat, lng: r.lng }));

  async ngOnInit(): Promise<void> {
    await this.store.loadMembers();
    const id = this.id();
    if (!id) return;
    try {
      const { intervention: i } = await firstValueFrom(this.api.get(id));
      const row = [...this.store.listRows(), ...this.store.todayRows()].find((r) => r.id === id);
      this.name.set(row?.customer?.name ?? '');
      this.phone.set(row?.customer?.phone ?? '');
      this.address.set(i.addressLabel);
      this.date.set(toDateInput(i.windowStart));
      this.window.set({ start: hhmm(i.windowStart), end: hhmm(i.windowEnd) });
      this.technician.set(i.technicianMembershipId ?? '');
      this.description.set(i.description ?? '');
      this.original = { date: this.date(), window: this.window(), technician: this.technician(), description: this.description() };
    } catch {
      this.submitError.set(this.t.failed);
    }
  }

  protected onAddress(a: { label: string; lat: number; lng: number }): void {
    this.address.set(a.label);
    this.coordinates.set({ lat: a.lat, lng: a.lng });
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.submitError.set('');
    if (Object.keys(this.errors()).length || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.editing()) await this.saveEdit();
      else await this.create();
      await this.router.navigate(['/app/interventions']);
    } catch (e) {
      this.submitError.set((e as { error?: { message?: string } })?.error?.message ?? this.t.failed);
    } finally {
      this.saving.set(false);
    }
  }

  private async create(): Promise<void> {
    const v = this.value();
    const found = await firstValueFrom(this.api.searchCustomers(v.phone));
    const customer = found.find((c) => c.phone === v.phone) ?? (await firstValueFrom(this.api.createCustomer({ name: v.name.trim(), phone: v.phone })));
    const { intervention } = await firstValueFrom(this.api.create(toCreateDto(customer.id, v, this.description())));
    if (this.technician()) await firstValueFrom(this.api.assign(intervention.id, { technicianMembershipId: this.technician() }));
  }

  private async saveEdit(): Promise<void> {
    const id = this.id()!;
    const o = this.original!;
    const w = this.window();
    const date = this.date();
    if (date !== o.date) {
      await firstValueFrom(this.api.reschedule(id, { newScheduledDate: toIso(date, '00:00'), newWindowStart: toIso(date, w.start), newWindowEnd: toIso(date, w.end) }));
    }
    const windowChanged = date === o.date && (w.start !== o.window.start || w.end !== o.window.end);
    if (windowChanged || this.description() !== o.description) {
      await firstValueFrom(this.api.update(id, {
        ...(windowChanged && { windowStart: toIso(date, w.start), windowEnd: toIso(date, w.end) }),
        ...(this.description() !== o.description && { description: this.description() }),
      }));
    }
    if (this.technician() && this.technician() !== o.technician) {
      await firstValueFrom(this.api.assign(id, { technicianMembershipId: this.technician() }));
    }
  }
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
