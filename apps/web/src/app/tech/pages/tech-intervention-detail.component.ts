import { Component, signal, computed, OnInit, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IaCardComponent,
  IaButtonComponent,
  IaModalComponent,
  IaToastService,
  IaTextareaComponent,
} from '@il-arrive/ui';
import { LocationSharingService } from '../services/location-sharing.service';
import { OnlineStatusService } from '../services/online-status.service';
import { TechApiService, ACTION_TO_STATUS, type TechAction } from '../services/tech-api.service';
import type { TechIntervention } from '../models/intervention';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import { takeUntil, Subject } from 'rxjs';

type ButtonAction = TechAction | 'delay';

interface ActionButton {
  label: string;
  action: ButtonAction;
  variant: 'primary' | 'secondary';
}

const ACTION_BUTTONS: Record<string, ActionButton[]> = {
  SCHEDULED: [
    { label: 'Je suis en route', action: 'en_route', variant: 'primary' },
    { label: "Prévenir d'un retard", action: 'delay', variant: 'secondary' },
  ],
  EN_ROUTE: [
    { label: 'Je suis arrivé', action: 'arrived', variant: 'primary' },
    { label: "Prévenir d'un retard", action: 'delay', variant: 'secondary' },
    { label: 'Annuler le trajet', action: 'stop_route', variant: 'secondary' },
  ],
  ARRIVED: [
    { label: 'Intervention terminée', action: 'complete', variant: 'primary' },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

function formatWindow(inv: TechIntervention): string {
  return `${inv.windowStart}h–${inv.windowEnd}h`;
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

@Component({
  selector: 'tech-intervention-detail',
  standalone: true,
  imports: [
    CommonModule,
    IaCardComponent,
    IaButtonComponent,
    IaModalComponent,
    IaTextareaComponent,
  ],
  template: `
    <div class="tech-detail">
      @if (state() === 'loading') {
        <div class="tech-detail__skeleton">
          <div class="tech-detail__skeleton-row" *ngFor="let i of [1,2,3,4]"></div>
        </div>
      } @else if (state() === 'error') {
        <div class="tech-detail__error">
          <p>Impossible de charger l'intervention</p>
          <ia-button label="Réessayer" variant="secondary" (clicked)="loadIntervention()" />
          <ia-button label="Retour" variant="ghost" (clicked)="goBack()" iconPosition="before" />
        </div>
      } @else if (intervention()) {
        <header class="tech-detail__header">
          <button class="tech-detail__back" aria-label="Retour" (click)="goBack()">←</button>
          <div class="tech-detail__header-info">
            <h1 class="tech-detail__title">{{ intervention()!.customerName.split(' ').pop() }}</h1>
            <p class="tech-detail__subtitle">{{ formatDateShort(intervention()!.scheduledDate) }} · {{ formatWindow(intervention()!) }}</p>
          </div>
          <button class="tech-detail__menu" aria-label="Menu">⋮</button>
        </header>

        @if (intervention()!.status === IS.ARRIVED) {
          <div class="tech-detail__success-banner">
            <p>Vous êtes arrivé — {{ intervention()!.windowStart }}</p>
          </div>
        }

        @if (intervention()!.status === IS.COMPLETED) {
          <div class="tech-detail__success-banner">
            <p>Intervention terminée</p>
          </div>
        }

        @if (intervention()!.status === IS.CANCELLED) {
          <div class="tech-detail__error-banner">
            <p>Rendez-vous annulé</p>
            <p class="tech-detail__error-sub">Le planificateur peut vous contacter.</p>
          </div>
        }

        <section class="tech-detail__cards">
          <ia-card variant="plain" [header]="false">
            <div class="tech-detail__customer-card">
              <h2 class="tech-detail__customer-name">{{ intervention()!.customerName }}</h2>
              <a [href]="'tel:' + intervention()!.customerPhone" class="tech-detail__phone-link">
                <span class="tech-detail__phone-icon">☎</span>
                <span>{{ intervention()!.customerPhone }}</span>
              </a>
            </div>
          </ia-card>

          <ia-card variant="plain" [header]="false">
            <div class="tech-detail__address-card">
              <p class="tech-detail__address">{{ intervention()!.addressLabel }}</p>
              <div class="tech-detail__address-actions">
                <ia-button
                  label="Itinéraire"
                  icon="⌖"
                  variant="primary"
                  size="lg"
                  class="tech-detail__nav-btn"
                  (clicked)="openNavigate()"
                />
                <ia-button
                  label="Copier"
                  variant="ghost"
                  size="md"
                  (clicked)="copyAddress()"
                />
              </div>
            </div>
          </ia-card>

          @if (intervention()!.description) {
            <ia-card variant="plain" [header]="false">
              <p class="tech-detail__description">{{ intervention()!.description }}</p>
            </ia-card>
          }

          @if (intervention()!.internalNotes) {
            <ia-card variant="plain" [header]="false">
              <div class="tech-detail__notes">
                <p class="tech-detail__notes-label">NOTES INTERNES</p>
                <p class="tech-detail__notes-text">{{ intervention()!.internalNotes }}</p>
              </div>
            </ia-card>
          }

          @if (intervention()!.delayMinutes) {
            <div class="tech-detail__delay-banner">
              <p>Retard signalé — +{{ intervention()!.delayMinutes }} min{{ intervention()!.delayEta ? ' (vers ' + intervention()!.delayEta + ')' : '' }}</p>
              @if (intervention()!.delayReason) {
                <p class="tech-detail__delay-reason">{{ intervention()!.delayReason }}</p>
              }
            </div>
          }
        </section>

        @if (!online()) {
          <div class="tech-detail__offline" role="status">
            Hors ligne — consultation seule. Les actions sont désactivées jusqu'au retour du réseau.
          </div>
        }

        @if (sharing() === 'sharing') {
          <div class="tech-detail__sharing" role="status">
            <span>Position partagée avec le client — uniquement pendant ce trajet.</span>
            <ia-button label="Arrêter" variant="secondary" size="action" (clicked)="stopSharing()" />
          </div>
        } @else if (sharing() === 'denied') {
          <div class="tech-detail__sharing tech-detail__sharing--info" role="status">
            Position non partagée : le client verra votre statut, sans la carte.
          </div>
        } @else if (sharing() === 'unsupported') {
          <div class="tech-detail__sharing tech-detail__sharing--info" role="status">
            Géolocalisation indisponible sur cet appareil : le client verra votre statut, sans la carte.
          </div>
        } @else if (stoppedByUser() && intervention()!.status === IS.EN_ROUTE) {
          <div class="tech-detail__sharing tech-detail__sharing--info" role="status">
            Partage de position arrêté. Le client voit toujours votre statut « en route ».
          </div>
        }

        @if (actionButtons().length > 0) {
          <div class="tech-detail__action-bar">
            <div class="tech-detail__hairline"></div>
            @for (btn of actionButtons(); track btn.action) {
              <ia-button
                [label]="btn.label"
                [variant]="btn.variant === 'primary' ? 'primary' : 'secondary'"
                size="action"
                [loading]="loading()"
                [disabled]="!online()"
                (clicked)="onAction(btn.action)"
              />
            }
          </div>
        }

        <ia-modal
          [isOpen]="consentModalOpen()"
          title="Partager votre position ?"
          [maxWidth]="'100%'"
          (closed)="consentModalOpen.set(false)"
        >
          <div class="tech-detail__consent">
            <p>Votre position est partagée avec le client <strong>uniquement pendant ce trajet</strong>, tant que cette page reste ouverte.</p>
            <p>Le partage s'arrête dès que vous êtes arrivé, annulez le trajet ou appuyez sur « Arrêter ». Aucune position n'est suivie en arrière-plan ni conservée après le trajet.</p>
            <div ia-modal-footer class="tech-detail__delay-footer">
              <ia-button label="Statut seulement" variant="ghost" size="action" (clicked)="confirmEnRoute(false)" />
              <ia-button label="Partager ma position" variant="primary" size="action" (clicked)="confirmEnRoute(true)" />
            </div>
          </div>
        </ia-modal>

        <ia-modal
          [isOpen]="delayModalOpen()"
          [title]="delayModalTitle"
          [maxWidth]="'100%'"
          class="tech-detail__delay-modal"
          (closed)="closeDelayModal()"
        >
          <div class="tech-detail__delay-content">
            <p class="tech-detail__delay-sub">Le client sera informé par SMS.</p>

            <div class="tech-detail__delay-chips">
              @for (chip of delayPresets; track chip.minutes) {
                <button
                  class="tech-detail__delay-chip"
                  [class.tech-detail__delay-chip--active]="selectedDelay() === chip.minutes"
                  (click)="selectedDelay.set(chip.minutes)"
                  [attr.aria-pressed]="selectedDelay() === chip.minutes"
                  type="button"
                >
                  +{{ chip.label }}
                </button>
              }
            </div>

            <ia-textarea
              label="Raison (optionnel)"
              placeholder="Ex. : accident sur l'autoroute"
            />

            @if (delayPreview()) {
              <p class="tech-detail__delay-preview">Nouvelle arrivée estimée vers <strong>{{ delayPreview() }}</strong></p>
            }

            <div ia-modal-footer class="tech-detail__delay-footer">
              <ia-button label="Annuler" variant="ghost" (clicked)="closeDelayModal()" />
              <ia-button label="Envoyer le retard" variant="primary" (clicked)="submitDelay()" [disabled]="!selectedDelay()" />
            </div>
          </div>
        </ia-modal>

        <ia-modal
          [isOpen]="navigateModalOpen()"
          [title]="navigateModalTitle"
          [maxWidth]="'100%'"
          class="tech-detail__navigate-modal"
          (closed)="closeNavigateModal()"
        >
          <div class="tech-detail__navigate-content">
            <button class="tech-detail__nav-row" (click)="openNav('apple')">
              <span class="tech-detail__nav-icon">🍎</span>
              <span class="tech-detail__nav-label">Apple Maps</span>
              <span class="tech-detail__nav-chevron">›</span>
            </button>
            <button class="tech-detail__nav-row" (click)="openNav('google')">
              <span class="tech-detail__nav-icon">🗺</span>
              <span class="tech-detail__nav-label">Google Maps</span>
              <span class="tech-detail__nav-chevron">›</span>
            </button>
            <button class="tech-detail__nav-row" (click)="openNav('waze')">
              <span class="tech-detail__nav-icon">🧭</span>
              <span class="tech-detail__nav-label">Waze</span>
              <span class="tech-detail__nav-chevron">›</span>
            </button>
            <div class="tech-detail__navigate-meta">
              <p>L'adresse est géocodée — le parcours utilise votre position actuelle.</p>
            </div>
          </div>
        </ia-modal>
      }
    </div>
  `,
  styles: [`
    .tech-detail__offline, .tech-detail__sharing {
      margin: 8px 16px; padding: 12px 16px; border-radius: 12px; min-height: 48px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      font-size: 14px;
    }
    .tech-detail__offline { background: var(--ia-color-warning-subtle, #fff4d6); color: var(--ia-color-text, inherit); }
    .tech-detail__sharing { background: var(--ia-color-success-subtle, #dff5e6); color: var(--ia-color-text, inherit); }
    .tech-detail__sharing--info { background: var(--ia-color-surface-muted, #eef0f3); }
    .tech-detail__consent { padding: 0 16px 16px; font-size: 15px; line-height: 1.5; }
    :host {
      display: block;
      max-width: var(--tech-column-max);
      margin: 0 auto;
      min-height: 100vh;
      background: var(--color-bg);
      /* room for the fixed action bar (up to 3 stacked buttons) so the content above it, e.g. the location "Arrêter" button, stays tappable */
      padding-bottom: calc(272px + env(safe-area-inset-bottom, 0px));
      box-sizing: border-box;
    }

    .tech-detail {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .tech-detail__skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .tech-detail__skeleton-row {
      height: 80px;
      background: var(--color-surface-muted);
      border-radius: var(--radius-lg);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .tech-detail__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8);
      text-align: center;
    }

    .tech-detail__header {
      display: flex;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      background: var(--color-surface);
      z-index: var(--z-sticky);
    }

    .tech-detail__back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      border: none;
      background: transparent;
      font-size: var(--text-xl);
      color: var(--color-text-primary);
      cursor: pointer;
      flex-shrink: 0;
    }

    .tech-detail__header-info {
      flex: 1;
      min-width: 0;
      margin: 0 var(--space-2);
    }

    .tech-detail__title {
      font-size: var(--text-md);
      font-weight: var(--font-weight-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tech-detail__subtitle {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .tech-detail__menu {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      border: none;
      background: transparent;
      font-size: var(--text-xl);
      color: var(--color-text-secondary);
      cursor: pointer;
      flex-shrink: 0;
    }

    .tech-detail__success-banner {
      background: var(--color-success-bg);
      color: var(--color-success-fg);
      border: 1px solid var(--color-success-border);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
    }

    .tech-detail__error-banner {
      background: var(--color-error-bg);
      color: var(--color-error-fg);
      border: 1px solid var(--color-error-border);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
    }

    .tech-detail__error-sub {
      font-size: var(--text-xs);
      margin-top: var(--space-1);
      opacity: 0.8;
    }

    .tech-detail__cards {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
    }

    .tech-detail__customer-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .tech-detail__customer-name {
      font-size: var(--text-xl);
      font-weight: var(--font-weight-semibold);
    }

    .tech-detail__phone-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-enroute-solid);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      min-height: var(--touch-target-min);
    }

    .tech-detail__phone-icon {
      font-size: var(--text-lg);
    }

    .tech-detail__address-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .tech-detail__address {
      font-size: var(--text-md);
      font-weight: var(--font-weight-medium);
      line-height: var(--leading-normal);
    }

    .tech-detail__address-actions {
      display: flex;
      gap: var(--space-2);
    }

    .tech-detail__nav-btn {
      flex: 6;
    }

    .tech-detail__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-normal);
    }

    .tech-detail__notes {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .tech-detail__notes-label {
      font-size: var(--text-overline);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-overline);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .tech-detail__notes-text {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
    }

    .tech-detail__location-card {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .tech-detail__pulse-dot {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
      background: var(--color-enroute-solid);
      flex-shrink: 0;
      animation: pulse 2s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .tech-detail__pulse-dot { animation: none; }
    }

    .tech-detail__location-text {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-enroute-fg);
    }

    .tech-detail__location-meta {
      font-size: var(--text-xs);
      color: var(--color-enroute-fg);
      opacity: 0.7;
    }

    .tech-detail__delay-banner {
      background: var(--color-warning-bg);
      color: var(--color-warning-fg);
      border: 1px solid var(--color-warning-border);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
    }

    .tech-detail__delay-reason {
      font-size: var(--text-xs);
      margin-top: var(--space-1);
      opacity: 0.8;
    }

    .tech-detail__action-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: var(--tech-column-max);
      margin: 0 auto;
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      z-index: var(--z-sticky);
    }

    .tech-detail__hairline {
      height: 1px;
      background: var(--color-border);
      margin-bottom: var(--space-2);
    }

    .tech-detail__delay-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .tech-detail__delay-sub {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .tech-detail__delay-chips {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
    }

    .tech-detail__delay-chip {
      height: var(--control-h-action);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color var(--motion-fast) var(--ease-out);
    }

    .tech-detail__delay-chip:hover {
      background: var(--color-surface-hover);
    }

    .tech-detail__delay-chip--active {
      background: var(--color-ink);
      color: var(--color-text-inverse);
      border-color: var(--color-ink);
    }

    .tech-detail__delay-preview {
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
      color: var(--color-text-secondary);
    }

    .tech-detail__delay-footer {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .tech-detail__navigate-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .tech-detail__nav-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      height: var(--control-h-action);
      padding: 0 var(--space-3);
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      width: 100%;
      text-align: left;
    }

    .tech-detail__nav-row:hover {
      background: var(--color-surface-hover);
    }

    .tech-detail__nav-icon {
      font-size: var(--text-lg);
      width: 24px;
      text-align: center;
    }

    .tech-detail__nav-label {
      flex: 1;
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .tech-detail__nav-chevron {
      font-size: var(--text-xl);
      color: var(--color-text-muted);
    }

    .tech-detail__navigate-meta {
      padding-top: var(--space-4);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .tech-detail__delay-modal,
    .tech-detail__navigate-modal {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: var(--z-modal);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechInterventionDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private techApi = inject(TechApiService);
  private toast = inject(IaToastService);
  private location = inject(LocationSharingService);
  protected online = inject(OnlineStatusService).online;
  protected sharing = this.location.state;
  protected stoppedByUser = computed(() => this.location.lastStopReason() === 'user');
  consentModalOpen = signal(false);
  private destroy$ = new Subject<void>();
  protected IS = IS;

  state = signal<'loading' | 'loaded' | 'error'>('loading');
  intervention = signal<TechIntervention | null>(null);
  loading = signal(false);

  delayModalOpen = signal(false);
  navigateModalOpen = signal(false);
  selectedDelay = signal<number | null>(null);
  delayModalTitle = 'Prévenir d\'un retard';
  navigateModalTitle = 'Itinéraire';

  delayPresets = [
    { minutes: 15, label: '15 min' },
    { minutes: 30, label: '30 min' },
    { minutes: 60, label: '60 min' },
  ];

  actionButtons = computed<ActionButton[]>(() => {
    const inv = this.intervention();
    if (!inv) return [];
    return ACTION_BUTTONS[inv.status] || [];
  });

  delayPreview = computed(() => {
    if (!this.selectedDelay() || !this.intervention()) return null;
    const inv = this.intervention()!;
    const baseTime = inv.delayEta || inv.windowEnd;
    const [h, m] = baseTime.split(':').map(Number);
    const totalMin = h * 60 + m + this.selectedDelay()!;
    const newH = Math.floor(totalMin / 60) % 24;
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}h${String(newM).padStart(2, '0')}`;
  });

  protected formatDateShort = (dateStr: string) => formatDateShort(dateStr);
  protected formatWindow = (inv: TechIntervention) => formatWindow(inv);

  ngOnInit() {
    this.loadIntervention();
  }

  loadIntervention() {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.state.set('error');
      return;
    }

    this.state.set('loading');
    this.techApi.fetchIntervention(id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data: TechIntervention) => {
        this.intervention.set(data);
        this.state.set('loaded');
      },
      error: () => {
        this.state.set('error');
        this.toast.error('Impossible de charger l\'intervention');
      },
    });
  }

  goBack() {
    this.router.navigate(['/tech']);
  }

  stopSharing() {
    this.location.stop('user');
    this.toast.info('Partage de position arrêté');
  }

  confirmEnRoute(share: boolean) {
    this.consentModalOpen.set(false);
    this.runAction('en_route', share);
  }

  onAction(action: ButtonAction) {
    const inv = this.intervention();
    if (!inv || this.loading() || !this.online()) return;

    if (action === 'delay') {
      this.delayModalOpen.set(true);
      return;
    }
    if (action === 'en_route') {
      this.consentModalOpen.set(true);
      return;
    }
    this.runAction(action, false);
  }

  private runAction(action: TechAction, share: boolean) {
    const inv = this.intervention();
    if (!inv || this.loading()) return;
    if (action !== 'en_route') this.location.stop(action === 'arrived' || action === 'complete' || action === 'stop_route' ? action : 'user');

    this.loading.set(true);
    const optimisticState = { ...inv, status: ACTION_TO_STATUS[action] };
    this.intervention.set(optimisticState);

    this.techApi.performAction(inv.id, action).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.success && result.intervention) {
          this.intervention.set(result.intervention);
          if (action === 'en_route' && share) this.location.start(inv.id);
          const label = this.getActionSuccessLabel(action);
          this.toast.success(label);
        } else {
          this.intervention.set(inv);
          this.toast.error('Action refusée. Actualisation...', 'Annuler');
          this.loadIntervention();
        }
      },
      error: () => {
        this.loading.set(false);
        this.intervention.set(inv);
        this.toast.error('Erreur réseau. Action non envoyée.');
      },
    });
  }

  private getActionSuccessLabel(action: TechAction): string {
    const labels: Record<TechAction, string> = {
      en_route: 'Statut envoyé — en route',
      arrived: 'Statut envoyé — arrivé',
      complete: 'Intervention terminée',
      stop_route: 'Partage de position arrêté',
    };
    return labels[action];
  }

  openNavigate() {
    this.navigateModalOpen.set(true);
  }

  closeNavigateModal() {
    this.navigateModalOpen.set(false);
  }

  openNav(provider: 'apple' | 'google' | 'waze') {
    const inv = this.intervention();
    if (!inv) return;

    const { lat, lng } = inv;
    const daddr = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(inv.addressLabel);
    let url = '';

    switch (provider) {
      case 'apple':
        url = `http://maps.apple.com/?daddr=${daddr}`;
        break;
      case 'google':
        url = `https://www.google.com/maps/dir/?api=1&destination=${daddr}`;
        break;
      case 'waze':
        url = lat != null && lng != null ? `waze://?ll=${daddr}&navigate=yes` : `waze://?q=${daddr}&navigate=yes`;
        break;
    }

    this.closeNavigateModal();
    window.open(url, '_blank');
  }

  copyAddress() {
    const inv = this.intervention();
    if (!inv) return;
    navigator.clipboard?.writeText(inv.addressLabel).then(() => {
      this.toast.success('Adresse copiée');
    }).catch(() => {
      this.toast.error('Impossible de copier');
    });
  }

  openDelayModal() {
    this.delayModalOpen.set(true);
  }

  closeDelayModal() {
    this.delayModalOpen.set(false);
    this.selectedDelay.set(null);
  }

  submitDelay() {
    const inv = this.intervention();
    const delay = this.selectedDelay();
    if (!inv || !delay) return;

    this.loading.set(true);
    this.techApi.reportDelay(inv.id, delay, '').pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.success && result.intervention) {
          this.intervention.set(result.intervention);
          this.closeDelayModal();
          this.toast.success('Retard signalé au client');
        } else {
          this.closeDelayModal();
          this.toast.error('Impossible d\'envoyer le retard');
        }
      },
      error: () => {
        this.loading.set(false);
        this.closeDelayModal();
        this.toast.error('Erreur réseau. Retard non envoyé.');
      },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
