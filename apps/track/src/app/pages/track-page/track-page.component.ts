import { Component, OnInit, OnDestroy, inject, computed, ChangeDetectionStrategy, NgZone, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IaCardComponent,
  IaAvatarComponent,
  IaTimelineComponent,
  IaLoadingStateComponent,
  IaErrorStateComponent,
} from '@il-arrive/ui';
import type { TimelineStep, TimelineStepStatus } from '@il-arrive/ui';
import type { PublicTrackingProjection, SSEEvent, SSEEventType } from '@il-arrive/contracts';
import { TrackingApi } from '../../services/tracking-api.service';

interface AppState {
  projection: PublicTrackingProjection | null;
  loading: boolean;
  error: string | null;
  httpStatus?: number;
}

@Component({
  selector: 'iat-track-page',
  standalone: true,
  imports: [
    CommonModule,
    IaCardComponent,
    IaAvatarComponent,
    IaTimelineComponent,
    IaLoadingStateComponent,
    IaErrorStateComponent,
  ],
  template: `
    @if (state.loading && !state.projection) {
      <div class="track-page track-page--loading">
        <div class="track-page__column">
          <div class="business-strip business-strip--skeleton">
            <div class="skeleton-block skeleton--logo"></div>
            <div class="skeleton-block skeleton--text"></div>
          </div>
          <ia-card variant="elevated">
            <ia-loading-state variant="text" />
          </ia-card>
        </div>
      </div>
    } @else if (state.error) {
      @if (isExpiredState()) {
        <div class="track-page track-page--fullscreen">
          <div class="track-page__column track-page__column--center">
            <div class="expired-page">
              <div class="expired-page__icon" aria-hidden="true">
                <svg viewBox="0 0 40 40" width="40" height="40">
                  <path d="M10 20h20M20 10v20" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
              <h1 class="expired-page__title">{{ expiredTitle() }}</h1>
              <p class="expired-page__body">{{ expiredBody() }}</p>
              @if (state.projection?.contactPhone) {
                <a [href]="'tel:' + (state.projection?.contactPhone || '')" class="expired-page__cta">
                  Appeler {{ state.projection?.businessName || '' }}
                </a>
              }
              <div class="expired-page__footer">
                <span>Propulsé par Il Arrive</span>
                <a href="/privacy" class="expired-page__privacy">Confidentialité</a>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="track-page track-page--error">
          <div class="track-page__column">
            <ia-error-state
              title="Impossible de charger les informations"
              [description]="state.error"
              retryLabel="Réessayer"
              (retryClicked)="onRetry()"
            />
          </div>
        </div>
      }
    } @else if (state.projection) {
      <div class="track-page">
        <div class="track-page__column">

          <!-- Business identity strip (sticky) -->
          <div class="business-strip"
               [style.borderTop]="businessTopRule()">
            @if (projection().businessLogoUrl) {
              <img [src]="projection().businessLogoUrl"
                   [alt]="" class="business-strip__logo" />
            } @else {
              <div class="business-strip__logo business-strip__logo--initial"
                   [style.backgroundColor]="businessBrandColor()"
                   [textContent]="businessInitial()">
              </div>
            }
            <span class="business-strip__name">{{ projection().businessName }}</span>
            @if (projection().contactPhone) {
              <a [href]="'tel:' + projection().contactPhone"
                 class="business-strip__phone"
                 [attr.aria-label]="'Appeler ' + projection().businessName">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.3-2.3a1 1 0 011.01-.21 11.36 11.36 0 003.39.54 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h2.79a1 1 0 011 1 11.36 11.36 0 00.54 3.39 1 1 0 01-.21 1.01l-2.3 2.3z" fill="currentColor"/>
                </svg>
              </a>
            }
          </div>

          <!-- Banner zone (conditional) -->
          @if (showDelayBanner()) {
            <div class="banner banner--warning">
              <svg viewBox="0 0 24 24" width="20" height="20" class="banner__icon" aria-hidden="true">
                <path d="M12 2L1 21h22L12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z" fill="currentColor"/>
              </svg>
              <div class="banner__content">
                <div class="banner__title">Retard signalé</div>
                @if (projection().delayReason) {
                  <div class="banner__reason">{{ projection().delayReason }}</div>
                }
              </div>
            </div>
          }

          @if (showCancelledBanner()) {
            <div class="banner banner--error">
              <svg viewBox="0 0 24 24" width="20" height="20" class="banner__icon" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v-2H9l-4-4 1.41-1.41L9 10.17V6h2v4.17l4.59-4.58L17 7l-7 7z" fill="currentColor"/>
              </svg>
              <div class="banner__content">
                <div class="banner__title">Rendez-vous annulé</div>
                <div class="banner__reason">Le professionnel vous contactera au besoin.</div>
              </div>
            </div>
          }

          @if (showRescheduledBanner()) {
            <div class="banner banner--warning">
              <svg viewBox="0 0 24 24" width="20" height="20" class="banner__icon" aria-hidden="true">
                <path d="M12 2L1 21h22L12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z" fill="currentColor"/>
              </svg>
              <div class="banner__content">
                <div class="banner__title">Rendez-vous déplacé</div>
                <div class="banner__reason">{{ rescheduledBannerText() }}</div>
              </div>
            </div>
          }

          <!-- ETA hero card -->
          <ia-card variant="elevated" [header]="false">
            <div class="eta-hero"
                 [class.eta-hero--success]="isSuccessState()"
                 [class.eta-hero--cancelled]="isCancelledState()">
              <div class="eta-hero__overline">{{ heroLabel() }}</div>
              <div class="eta-hero__value">{{ heroValue() }}</div>
              <div class="eta-hero__meta">{{ heroMeta() }}</div>
            </div>
          </ia-card>

          <!-- Live region for announcements -->
          <div class="sr-only" role="status" aria-live="polite" id="track-status-region">
            {{ statusAnnouncement() }}
          </div>

          <!-- Technician row -->
          <div class="tech-row">
            <ia-avatar [name]="projection().technicianFirstName"
                       [avatarUrl]="projection().technicianAvatarUrl || null"
                       [size]="48"
                       [showRing]="true" />
            <div class="tech-row__info">
              <div class="tech-row__name">{{ projection().technicianFirstName }}</div>
              <div class="tech-row__sub">Technicien · {{ projection().businessName }}</div>
            </div>
          </div>

          <!-- Map card (only when LIVE) -->
          @if (showMap()) {
            <div class="map-card">
              <div class="map-card__placeholder">
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="map-card__pin">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="var(--color-enroute-solid)"/>
                </svg>
                <div class="map-card__caption">
                  Position actualisée à {{ formatTime(projection().location?.lastFixAt) }}
                </div>
              </div>
            </div>
          }

          <!-- Stale location info card (EN_ROUTE + STALE) -->
          @if (showStaleLocationCard()) {
            <div class="stale-info-card">
              <svg viewBox="0 0 24 24" width="20" height="20" class="stale-info-card__icon" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v-2H9l-4-4 1.41-1.41L9 10.17V6h2v4.17l4.59-4.58L17 7l-7 7z" fill="var(--color-neutral-solid)"/>
              </svg>
              <div class="stale-info-card__content">
                <div class="stale-info-card__title">Position non disponible depuis {{ formatTime(projection().location?.lastFixAt) }}</div>
                <div class="stale-info-card__body">Le technicien est peut-être dans une zone à réception limitée. Statut toujours à jour.</div>
              </div>
            </div>
          }

          <!-- Timeline -->
          <ia-timeline [steps]="timelineSteps()" />

          <!-- Appointment details card -->
          <ia-card variant="elevated" [header]="false">
            <div class="appointment-card">
              <div class="appointment-card__address">{{ projection().addressLabel }}</div>
              <div class="appointment-card__window">{{ appointmentDateLabel() }}</div>
              @if (showDescription()) {
                <div class="appointment-card__desc">{{ projection().addressLabel }}</div>
              }
            </div>
          </ia-card>

          <!-- Link active note for future appointments -->
          @if (showLinkDayNote()) {
            <div class="link-day-note">
              Le lien de suivi sera actif le jour de l'intervention.
            </div>
          }

          <!-- Call CTA -->
          @if (showCallCta()) {
            <a [href]="'tel:' + projection().contactPhone"
               class="call-cta"
               [attr.aria-label]="'Appeler ' + projection().businessName">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.3-2.3a1 1 0 011.01-.21 11.36 11.36 0 003.39.54 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h2.79a1 1 0 011 1 11.36 11.36 0 00.54 3.39 1 1 0 01-.21 1.01l-2.3 2.3z" fill="currentColor"/>
              </svg>
              Appeler {{ projection().businessName }}
            </a>
          }

          <!-- Footer -->
          <div class="track-footer">
            <span>Propulsé par Il Arrive</span>
            <a href="/privacy">Confidentialité</a>
          </div>

          <!-- Link no longer active note for completed -->
          @if (isCompletedState()) {
            <div class="link-expired-note">Ce lien n'est plus actif.</div>
          }

        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }

    .track-page {
      min-height: 100vh;
      background: var(--color-bg);
    }

    .track-page--loading,
    .track-page--error,
    .track-page--fullscreen {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .track-page__column {
      max-width: var(--track-column-max);
      margin: 0 auto;
      padding: 0 var(--space-4) var(--space-8);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      width: 100%;
    }

    .track-page__column--center {
      align-items: center;
      text-align: center;
      padding: var(--space-16) var(--space-4);
    }

    /* =========================================================================
       Business strip (sticky top)
       ========================================================================= */
    .business-strip {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: 56px;
      padding: 0 var(--space-4);
      background: var(--color-surface);
      border-top-width: 2px;
      border-top-style: solid;
      border-top-color: var(--color-brand);
      box-shadow: var(--shadow-xs);
    }

    .business-strip--skeleton {
      border-top-color: var(--color-border);
    }

    .business-strip__logo {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
      object-fit: cover;
    }

    .business-strip__logo--initial {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-inverse);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-semibold);
    }

    .business-strip__name {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .business-strip__phone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      color: var(--color-text-secondary);
      text-decoration: none;
      border-radius: var(--radius-full);
      transition: background-color var(--motion-fast) var(--ease-out);
    }

    .business-strip__phone:hover {
      background: var(--color-surface-muted);
    }

    .skeleton-block {
      background: var(--color-surface-muted);
      border-radius: var(--radius-sm);
    }

    .skeleton--logo {
      width: 28px;
      height: 28px;
    }

    .skeleton--text {
      flex: 1;
      height: 14px;
      max-width: 180px;
    }

    /* =========================================================================
       Banners
       ========================================================================= */
    .banner {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      border: 1px solid;
    }

    .banner--warning {
      background: var(--color-warning-bg);
      border-color: var(--color-warning-border);
      color: var(--color-warning-fg);
    }

    .banner--error {
      background: var(--color-error-bg);
      border-color: var(--color-error-border);
      color: var(--color-error-fg);
    }

    .banner__icon {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .banner__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .banner__title {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
    }

    .banner__reason {
      font-size: var(--text-xs);
      opacity: 0.85;
    }

    /* =========================================================================
       ETA Hero
       ========================================================================= */
    .eta-hero {
      padding: var(--space-6);
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .eta-hero--success {
      background: var(--color-success-bg);
    }

    .eta-hero--cancelled {
      background: var(--color-surface);
    }

    .eta-hero__overline {
      font-size: var(--text-overline);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-overline);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .eta-hero--success .eta-hero__overline {
      color: var(--color-success-fg);
    }

    .eta-hero__value {
      font-size: var(--text-hero);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-hero);
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
    }

    .eta-hero--success .eta-hero__value {
      font-size: var(--text-3xl);
      color: var(--color-success-fg);
      letter-spacing: var(--tracking-tight);
    }

    .eta-hero--cancelled .eta-hero__value {
      font-size: var(--text-3xl);
      color: var(--color-error-fg);
      letter-spacing: var(--tracking-tight);
    }

    .eta-hero__meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      line-height: var(--leading-normal);
    }

    /* =========================================================================
       Technician row
       ========================================================================= */
    .tech-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) 0;
    }

    .tech-row__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tech-row__name {
      font-size: var(--text-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      line-height: var(--leading-tight);
    }

    .tech-row__sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* =========================================================================
       Map card (placeholder — MapLibre lazy-loaded in next slice)
       ========================================================================= */
    .map-card {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-surface-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border: 1px solid var(--color-border);
    }

    .map-card__placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
    }

    .map-card__pin {
      color: var(--color-enroute-solid);
    }

    .map-card__caption {
      position: absolute;
      bottom: var(--space-2);
      left: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      background: var(--color-surface);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
    }

    /* =========================================================================
       Stale location info card
       ========================================================================= */
    .stale-info-card {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
    }

    .stale-info-card__icon {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .stale-info-card__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .stale-info-card__title {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
    }

    .stale-info-card__body {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
    }

    /* =========================================================================
       Appointment card
       ========================================================================= */
    .appointment-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-6);
    }

    .appointment-card__address {
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .appointment-card__window {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .appointment-card__desc {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* =========================================================================
       Link day note
       ========================================================================= */
    .link-day-note {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-2) 0;
    }

    /* =========================================================================
       Call CTA
       ========================================================================= */
    .call-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      height: var(--control-h-action);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      font-family: var(--font-sans);
      text-decoration: none;
      cursor: pointer;
      width: 100%;
      transition: background-color var(--motion-fast) var(--ease-out);
    }

    .call-cta:hover {
      background: var(--color-surface-hover);
    }

    .call-cta:focus-visible {
      outline: var(--focus-width) solid var(--focus-color);
      outline-offset: var(--focus-offset);
    }

    /* =========================================================================
       Footer
       ========================================================================= */
    .track-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4) 0 var(--space-8);
      min-height: 44px;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .track-footer a {
      color: var(--color-text-muted);
      text-decoration: underline;
    }

    .track-footer a:hover {
      color: var(--color-text-primary);
    }

    .link-expired-note {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
    }

    /* =========================================================================
       Expired / 404 full-screen page
       ========================================================================= */
    .expired-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      text-align: center;
      padding: var(--space-8) var(--space-4);
    }

    .expired-page__icon {
      color: var(--color-text-muted);
      margin-bottom: var(--space-1);
    }

    .expired-page__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-tight);
      color: var(--color-text-primary);
    }

    .expired-page__body {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
      max-width: 320px;
    }

    .expired-page__cta {
      display: flex;
      align-items: center;
      justify-content: center;
      height: var(--control-h-action);
      background: var(--color-ink);
      color: var(--color-text-inverse);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      font-family: var(--font-sans);
      text-decoration: none;
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 320px;
      cursor: pointer;
      transition: background-color var(--motion-fast) var(--ease-out);
    }

    .expired-page__cta:hover {
      background: var(--color-ink-hover);
    }

    .expired-page__footer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-4);
    }

    .expired-page__privacy {
      color: var(--color-text-muted);
      text-decoration: underline;
    }

    /* =========================================================================
       Screen reader only
       ========================================================================= */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackPageComponent implements OnInit, OnDestroy {
  private destroyRef: DestroyRef = inject(DestroyRef);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private trackingApi: TrackingApi = inject(TrackingApi);
  private ngZone: NgZone = inject(NgZone);

  protected state: AppState = {
    projection: null,
    loading: true,
    error: null,
  };

  protected projection = computed(() => this.state.projection || {} as PublicTrackingProjection);

  private token = '';
  private eventSource: EventSource | null = null;
  private lastEventId = '';

  // -------------------------------------------------------------------------
  // Computed helpers
  // -------------------------------------------------------------------------

  protected businessInitial = computed(() => {
    return this.projection().businessName.charAt(0).toUpperCase();
  });

  protected businessTopRule = computed(() => {
    // Brand color override from business projection (future) — use ink default
    return '2px solid var(--color-brand)';
  });

  protected businessBrandColor = computed(() => {
    // Will be extended when brandColor is in the projection
    return 'var(--color-surface-muted)';
  });

  // -------------------------------------------------------------------------
  // Hero computation
  // -------------------------------------------------------------------------

  protected isEnRoute = computed(() => this.projection().status === 'EN_ROUTE');
  protected isScheduled = computed(() => this.projection().status === 'SCHEDULED');
  protected isArrived = computed(() => this.projection().status === 'ARRIVED');
  protected isCompleted = computed(() => this.projection().status === 'COMPLETED');
  protected isCancelled = computed(() => this.projection().status === 'CANCELLED');
  protected isSuccessState = computed(() => this.isArrived() || this.isCompleted());
  protected isCancelledState = computed(() => this.isCancelled());
  protected isExpiredState = computed(() =>
    (this.state.httpStatus === 410 || this.state.httpStatus === 404) && this.state.error
  );
  protected isCompletedState = computed(() => this.isCompleted());

  protected heroLabel = computed(() => {
    const p = this.projection();
    switch (p.status) {
      case 'SCHEDULED':
        return this.isToday() ? 'INTERVENTION PRÉVUE AUJOURD\'HUI' : 'RENDEZ-VOUS CONFIRMÉ';
      case 'EN_ROUTE':
        return 'ARRIVÉE ESTIMÉE';
      case 'ARRIVED':
        return 'TECHNICIEN ARRIVÉ';
      case 'COMPLETED':
        return 'INTERVENTION TERMINÉE';
      case 'CANCELLED':
        return 'RENDEZ-VOUS ANNULÉ';
      default:
        return 'SUIVI';
    }
  });

  protected heroValue = computed(() => {
    const p = this.projection();
    switch (p.status) {
      case 'SCHEDULED':
        return this.isToday() ? `${p.windowStart}–${p.windowEnd}` : this.formatDate(p.interventionDate!);
      case 'EN_ROUTE':
        return p.eta || '—';
      case 'ARRIVED':
        return 'Arrivé';
      case 'COMPLETED':
        return 'Terminé';
      case 'CANCELLED':
        return 'Annulé';
      default:
        return '—';
    }
  });

  protected heroMeta = computed(() => {
    const p = this.projection();
    switch (p.status) {
      case 'SCHEDULED':
        if (this.isToday()) {
          return `aujourd'hui, ${this.formatDateLong(p.interventionDate!)}`;
        }
        return `entre ${p.windowStart} et ${p.windowEnd}`;
      case 'EN_ROUTE': {
        const parts: string[] = [];
        if (p.eta) {
          const est = this.etaInMinutes();
          if (est >= 0) parts.push(`dans ~${est} min`);
          if (p.etaComputedAt) parts.push(`estimée à ${this.formatTime(p.etaComputedAt)}`);
        }
        if (p.delayMinutes) {
          parts.push(`+${p.delayMinutes} min`);
        }
        return parts.join(' · ');
      }
      case 'ARRIVED':
        return `${p.technicianFirstName} est sur place`;
      case 'COMPLETED':
        return 'Intervention terminée';
      case 'CANCELLED':
        return `prévu le ${this.formatDate(p.interventionDate!)}, ${p.windowStart}–${p.windowEnd}`;
      default:
        return '';
    }
  });

  // -------------------------------------------------------------------------
  // Banners
  // -------------------------------------------------------------------------

  protected showDelayBanner = computed(() => {
    const p = this.projection();
    return this.isEnRoute() && !!p.delayMinutes && p.delayMinutes > 0;
  });

  protected showCancelledBanner = computed(() => this.isCancelled());

  protected showRescheduledBanner = computed(() => {
    const p = this.projection();
    return p.status === 'SCHEDULED' && (p as any).previousDate;
  });

  protected rescheduledBannerText = computed(() => {
    const p = this.projection();
    const prevDate = (p as any).previousDate as string;
    return `nouveau créneau : ${this.formatDate(p.interventionDate!)}, ${p.windowStart}–${p.windowEnd}`;
  });

  // -------------------------------------------------------------------------
  // Map & location
  // -------------------------------------------------------------------------

  protected showMap = computed(() => {
    const p = this.projection();
    return p.status === 'EN_ROUTE' && p.location?.status === 'FRESH';
  });

  protected showStaleLocationCard = computed(() => {
    const p = this.projection();
    return p.status === 'EN_ROUTE' && p.location?.status === 'STALE';
  });

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  protected timelineSteps = computed<TimelineStep[]>(() => {
    const p = this.projection();
    const steps = [
      { label: 'Rendez-vous confirmé', status: 'upcoming' as TimelineStepStatus },
      { label: 'Intervention prévue', status: 'upcoming' as TimelineStepStatus },
      { label: 'Technicien en route', status: 'upcoming' as TimelineStepStatus },
      { label: 'Technicien arrivé', status: 'upcoming' as TimelineStepStatus },
      { label: 'Intervention terminée', status: 'upcoming' as TimelineStepStatus },
    ];

    switch (p.status) {
      case 'SCHEDULED': {
        const currentStep = this.isToday() ? 1 : 0;
        steps[currentStep].status = 'current';
        return steps.slice(0, currentStep + 1);
      }
      case 'EN_ROUTE': {
        steps[0].status = 'done';
        steps[1].status = 'done';
        steps[2].status = 'current';
        return steps;
      }
      case 'ARRIVED': {
        steps[0].status = 'done';
        steps[1].status = 'done';
        steps[2].status = 'done';
        steps[3].status = 'current';
        return steps;
      }
      case 'COMPLETED': {
        steps[0].status = 'done';
        steps[1].status = 'done';
        steps[2].status = 'done';
        steps[3].status = 'done';
        steps[4].status = 'done';
        return steps;
      }
      case 'CANCELLED': {
        // Show up to step 0 (confirmed) as done, step 1 as neutral
        steps[0].status = 'done';
        steps[1].status = 'current';
        return steps.slice(0, 2);
      }
      default:
        return steps;
    }
  });

  // -------------------------------------------------------------------------
  // Appointment details
  // -------------------------------------------------------------------------

  protected appointmentDateLabel = computed(() => {
    const p = this.projection();
    const date = p.interventionDate!;
    if (this.isToday()) {
      return `Aujourd'hui · ${p.windowStart}–${p.windowEnd}`;
    }
    return `${this.formatDate(date)} · ${p.windowStart}–${p.windowEnd}`;
  });

  protected showDescription = computed(() => false); // description field not in mock yet

  protected showLinkDayNote = computed(() => {
    return this.isScheduled() && !this.isToday();
  });

  protected showCallCta = computed(() => {
    const p = this.projection();
    return p.contactPhone && !this.isCompleted();
  });

  // -------------------------------------------------------------------------
  // Expired page
  // -------------------------------------------------------------------------

  protected expiredTitle = computed(() => {
    return this.state.httpStatus === 410 ? 'Ce lien a expiré' : 'Lien introuvable';
  });

  protected expiredBody = computed(() => {
    if (this.state.httpStatus === 410) {
      const biz = this.state.projection?.businessName;
      const phone = this.state.projection?.contactPhone;
      if (biz && phone) {
        return `Pour connaître la situation de votre intervention, contactez ${biz} au ${phone}.`;
      }
      return 'Pour connaître la situation de votre intervention, contactez le professionnel.';
    }
    return 'Ce lien est invalide ou a été révoqué. Vérifiez le message reçu par SMS.';
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  protected statusAnnouncement = computed(() => {
    if (!this.state.projection) return '';
    const p = this.state.projection;
    const statusText = this.statusToText(p.status);
    if (p.eta) return `${statusText} — arrivée estimée vers ${p.eta}`;
    return statusText;
  });

  private statusToText(status: string): string {
    switch (status) {
      case 'SCHEDULED': return this.isToday() ? 'Intervention prévue aujourd\'hui' : 'Rendez-vous confirmé';
      case 'EN_ROUTE': return 'Technicien en route';
      case 'ARRIVED': return 'Technicien arrivé';
      case 'COMPLETED': return 'Intervention terminée';
      case 'CANCELLED': return 'Rendez-vous annulé';
      default: return status;
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.fetchData();
  }

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  protected onRetry(): void {
    this.state = { projection: null, loading: true, error: null };
    this.fetchData();
  }

  private fetchData(): void {
    if (!this.token) return;
    this.state = { projection: null, loading: true, error: null };

    this.trackingApi.fetchProjection(this.token).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (projection: PublicTrackingProjection) => {
        this.state = { ...this.state, projection, loading: false, error: null };
        this.startSSE();
      },
      error: (err: any) => {
        if (err.status === 404 || err.status === 410) {
          // For expired/revoked links, keep loading false with the http status
          this.state = {
            projection: null,
            loading: false,
            error: err.status === 410 ? 'Lien expiré' : 'Lien introuvable',
            httpStatus: err.status,
          };
        } else {
          this.state = {
            projection: null,
            loading: false,
            error: 'Une erreur est survenue lors du chargement.',
            httpStatus: err.status,
          };
        }
      },
    });
  }

  private startSSE(): void {
    this.closeEventSource();
    this.trackingApi.subscribeToEvents(this.token).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (event: MessageEvent<any>) => {
        const data = JSON.parse(event.data);
        this.handleSSEEvent(data);
      },
      error: () => {
        // SSE connection lost — refetch full projection
        this.ngZone.run(() => this.fetchData());
      },
    });
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private handleSSEEvent(event: SSEEvent): void {
    if (!this.state.projection) return;
    const updated = { ...this.state.projection };

    switch (event.event) {
      case 'status_change':
        updated.status = (event.data as any).status;
        break;
      case 'eta_update': {
        const etaData = event.data as any;
        updated.eta = etaData.eta;
        updated.etaComputedAt = etaData.etaComputedAt;
        break;
      }
      case 'location_update': {
        const locData = event.data as any;
        updated.location = {
          lat: locData.lat,
          lng: locData.lng,
          status: locData.status,
          lastFixAt: locData.lastFixAt,
        };
        break;
      }
      case 'delay_update': {
        const delayData = event.data as any;
        updated.delayMinutes = delayData.delayMinutes;
        updated.delayReason = delayData.delayReason;
        break;
      }
      case 'session_end':
        updated.status = (event.data as any).status;
        break;
    }

    this.state = { ...this.state, projection: updated };
  }

  // -------------------------------------------------------------------------
  // Formatting helpers
  // -------------------------------------------------------------------------

  protected formatTime(isoString?: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  protected formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    const months = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return `${days[date.getDay()]}\u00a0${date.getDate()} ${months[date.getMonth()]}.`;
  }

  protected formatDateLong(dateStr: string): string {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const date = new Date(dateStr);
    return `${days[date.getDay()]}\u00a0${date.getDate()} ${months[date.getMonth()]}`;
  }

  protected isToday = computed(() => {
    const p = this.projection();
    const today = new Date().toISOString().slice(0, 10);
    return (p.interventionDate as string) === today;
  });

  protected etaInMinutes = computed(() => {
    const p = this.projection();
    if (!p.eta || !p.etaComputedAt) return -1;
    const etaDate = new Date(p.etaComputedAt);
    // Parse ETA time string into a date
    const etaParts = p.eta.split(':');
    const now = new Date();
    const etaToday = new Date(now);
    etaToday.setHours(parseInt(etaParts[0], 10), parseInt(etaParts[1], 10), 0, 0);
    const diff = Math.round((etaToday.getTime() - now.getTime()) / 60000);
    return Math.max(0, diff);
  });
}
