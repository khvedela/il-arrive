import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IaUIModule, IaToastService } from '@il-arrive/ui';
import { AuthService } from '../../core/auth.service';
import { DashboardApi, type SmsUsageDto } from '../../dashboard/dashboard-api.service';

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IaUIModule],
  template: `
    <h1 class="title">{{ t.title }}</h1>

    @switch (state()) {
      @case ('error') { <ia-error-state [title]="t.loadError" (retryClicked)="load()" /> }
      @case ('ready') {
        <form class="card" (ngSubmit)="save()" [attr.aria-label]="t.branding">
          <h2 class="card__title">{{ t.branding }}</h2>
          <ia-input [label]="t.name" [required]="true" [disabled]="!isOwner()" [errorText]="errors().name ?? null" [value]="name()" (valueChange)="name.set($event)" />
          <ia-input [label]="t.phone" type="tel" [disabled]="!isOwner()" [errorText]="errors().phone ?? null" [value]="phone()" (valueChange)="phone.set($event)" />
          <ia-input [label]="t.color" placeholder="#1a73e8" [disabled]="!isOwner()" [errorText]="errors().color ?? null" [value]="color()" (valueChange)="color.set($event)" />
          <ia-input [label]="t.timezone" [disabled]="!isOwner()" [value]="timezone()" (valueChange)="timezone.set($event)" />
          @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
          @if (isOwner()) {
            <ia-button type="submit" variant="primary" size="md" [label]="t.save" [loading]="saving()" [disabled]="saving()" />
          } @else {
            <p class="hint">{{ t.ownerOnly }}</p>
          }
        </form>

        <section class="card" [attr.aria-label]="t.sms">
          <h2 class="card__title">{{ t.sms }}</h2>
          @if (usage(); as u) {
            <p data-testid="quota">{{ t.used }} : <strong>{{ u.used }} / {{ u.quota }}</strong> ({{ u.remaining }} {{ t.remaining }})</p>
            <progress [value]="u.used" [max]="u.quota || 1" [attr.aria-label]="t.sms"></progress>
          } @else {
            <p class="hint">{{ t.usageUnavailable }}</p>
          }
          <p class="hint">{{ t.plan }} : {{ auth.activeMembership()?.plan }}</p>
        </section>
      }
      @default { <ia-loading-state /> }
    }
  `,
  styles: [`
    :host { display: block; padding: var(--space-8); max-width: 640px; }
    .title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-6); }
    .card { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); margin-bottom: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); }
    .card__title { font-size: var(--text-lg); font-weight: var(--font-weight-semibold); }
    .error { color: var(--color-danger-text); font-size: var(--text-sm); }
    .hint { color: var(--color-text-muted); font-size: var(--text-sm); }
    progress { width: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private api = inject(DashboardApi);
  protected auth = inject(AuthService);
  private toast = inject(IaToastService);

  state = signal<'loading' | 'ready' | 'error'>('loading');
  name = signal('');
  phone = signal('');
  color = signal('');
  timezone = signal('');
  usage = signal<SmsUsageDto | null>(null);
  submitted = signal(false);
  saving = signal(false);
  error = signal('');

  isOwner = computed(() => this.auth.activeMembership()?.role === 'OWNER');
  errors = computed(() => {
    const e: Partial<Record<'name' | 'phone' | 'color', string>> = {};
    if (!this.submitted()) return e;
    if (!this.name().trim()) e.name = this.t.nameRequired;
    if (this.color() && !HEX.test(this.color())) e.color = this.t.colorInvalid;
    return e;
  });

  protected t = {
    title: $localize`:@@settings.title:Paramètres`,
    branding: $localize`:@@settings.branding:Entreprise et image de marque`,
    name: $localize`:@@settings.name:Nom de l'entreprise`,
    phone: $localize`:@@settings.phone:Téléphone`,
    color: $localize`:@@settings.color:Couleur de marque`,
    timezone: $localize`:@@settings.timezone:Fuseau horaire`,
    save: $localize`:@@settings.save:Enregistrer`,
    saved: $localize`:@@settings.saved:Paramètres enregistrés`,
    ownerOnly: $localize`:@@settings.ownerOnly:Seul le propriétaire peut modifier ces informations.`,
    sms: $localize`:@@settings.sms:SMS et quota`,
    used: $localize`:@@settings.used:SMS utilisés ce mois-ci`,
    remaining: $localize`:@@settings.remaining:restants`,
    usageUnavailable: $localize`:@@settings.usageUnavailable:Quota indisponible.`,
    plan: $localize`:@@settings.plan:Offre`,
    loadError: $localize`:@@settings.loadError:Impossible de charger les paramètres`,
    nameRequired: $localize`:@@settings.nameRequired:Le nom est requis`,
    colorInvalid: $localize`:@@settings.colorInvalid:Couleur invalide (ex. #1a73e8)`,
    failed: $localize`:@@settings.failed:L'enregistrement a échoué. Réessayez.`,
  };

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      const b = await firstValueFrom(this.api.business());
      this.name.set(b.name);
      this.phone.set(b.phone ?? '');
      this.color.set(b.brandColor ?? '');
      this.timezone.set(b.timezone);
      this.state.set('ready');
    } catch {
      this.state.set('error');
      return;
    }
    this.usage.set(await firstValueFrom(this.api.smsUsage()).catch(() => null));
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    if (Object.keys(this.errors()).length || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.updateBusiness({
          name: this.name().trim(),
          phone: this.phone().trim(),
          timezone: this.timezone().trim(),
          ...(this.color() && { brandColor: this.color() }),
        }),
      );
      this.toast.show(this.t.saved, 'success');
      this.submitted.set(false);
      await firstValueFrom(this.auth.bootstrap()).catch(() => undefined);
    } catch (e) {
      this.error.set((e as { error?: { message?: string } })?.error?.message ?? this.t.failed);
    } finally {
      this.saving.set(false);
    }
  }
}
