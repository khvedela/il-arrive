import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IaButtonComponent,
  IaInputComponent,
  IaTextareaComponent,
  IaSelectComponent,
  IaPhoneInputComponent,
  IaAddressAutocompleteComponent,
  IaDateWindowPickerComponent,
  IaStatusBadgeComponent,
  IaCardComponent,
  IaListRowComponent,
  IaDrawerComponent,
  IaModalComponent,
  IaToastContainerComponent,
  IaToastService,
  IaEmptyStateComponent,
  IaLoadingStateComponent,
  IaErrorStateComponent,
  IaAvatarComponent,
  IaTimelineComponent,
  IaTabsComponent,
  IaTabPanelComponent,
  IaMenuComponent,
} from '@il-arrive/ui';
import type {
  SelectOption,
  TimelineStep,
  MenuItemDef,
  TabDef,
  TimeWindow,
} from '@il-arrive/ui';

@Component({
  selector: 'app-showcase',
  standalone: true,
  imports: [
    CommonModule,
    IaButtonComponent,
    IaInputComponent,
    IaTextareaComponent,
    IaSelectComponent,
    IaPhoneInputComponent,
    IaAddressAutocompleteComponent,
    IaDateWindowPickerComponent,
    IaStatusBadgeComponent,
    IaCardComponent,
    IaListRowComponent,
    IaDrawerComponent,
    IaModalComponent,
    IaToastContainerComponent,
    IaEmptyStateComponent,
    IaLoadingStateComponent,
    IaErrorStateComponent,
    IaAvatarComponent,
    IaTimelineComponent,
    IaTabsComponent,
    IaTabPanelComponent,
    IaMenuComponent,
  ],
  template: `
    <div class="showcase">
      <h1 class="showcase__title">UI Components Showcase</h1>
      <p class="showcase__subtitle">Dev review page — /dev/ui</p>

      <section class="showcase__section">
        <h2>Button</h2>
        <div class="showcase__demo">
          <h3>Variants</h3>
          <div class="showcase__group">
            <ia-button variant="primary" label="Primary" />
            <ia-button variant="secondary" label="Secondary" />
            <ia-button variant="ghost" label="Ghost" />
            <ia-button variant="danger" label="Danger" />
            <ia-button variant="danger-ghost" label="Danger Ghost" />
          </div>

          <h3>Sizes</h3>
          <div class="showcase__group">
            <ia-button variant="primary" size="sm" label="Small" />
            <ia-button variant="primary" size="md" label="Medium" />
            <ia-button variant="primary" size="lg" label="Large" />
          </div>

          <h3>States</h3>
          <div class="showcase__group">
            <ia-button variant="primary" label="Default" />
            <ia-button variant="primary" label="Disabled" [disabled]="true" />
            <ia-button variant="primary" label="Loading" [loading]="true" loadingText="Envoi..." />
            <ia-button variant="primary" label="With Icon" icon="→" iconPosition="after" />
          </div>

          <h3>Action Size</h3>
          <div class="showcase__group">
            <ia-button variant="primary" size="action" label="Confirmer la prise en charge" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Input</h2>
        <div class="showcase__demo">
          <h3>Default</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-input label="Nom" placeholder="Entrez votre nom" [(value)]="inputValue" />
          </div>

          <h3>With Helper</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-input label="Email" placeholder="user@example.com" helperText="Votre adresse email" [(value)]="inputValue2" />
          </div>

          <h3>Error</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-input label="Téléphone" errorText="Numéro de téléphone invalide" [value]="'06'" />
          </div>

          <h3>Disabled</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-input label="Champ désactivé" [disabled]="true" [value]="'Non modifiable'" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Textarea</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 400px;">
            <ia-textarea label="Notes" placeholder="Ajoutez des notes..." helperText="Texte libre, max 500 caractères" [maxLength]="500" [(value)]="textareaValue" />
          </div>

          <h3>Error</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-textarea label="Motif de retard" errorText="Ce champ est requis" [value]="'Retard de'" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Select</h2>
        <div class="showcase__demo">
          <h3>Native (short list)</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-select label="Priorité" placeholder="Sélectionner..." [options]="priorityOptions" [(value)]="selectValue" />
          </div>

          <h3>Popover (long list)</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-select label="Technicien" placeholder="Sélectionner un technicien..." [options]="longOptions" [(value)]="selectValue2" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Phone Input</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 400px;">
            <ia-phone-input [(value)]="phoneValue" />
          </div>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-phone-input [errorText]="'Numéro de téléphone invalide'" [value]="'061234'"/>
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Address Autocomplete</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 400px;">
            <ia-address-autocomplete label="Adresse" placeholder="Rechercher une adresse..." [searchFn]="mockSearchFn" [(value)]="addressValue" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Date + Time Window Picker</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 480px;">
            <ia-date-window-picker [(date)]="pickerDate" [(window)]="pickerWindow" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Status Badge</h2>
        <div class="showcase__demo">
          <h3>Sizes</h3>
          <div class="showcase__group">
            <ia-status-badge status="EN_ROUTE" size="sm" />
            <ia-status-badge status="COMPLETED" size="sm" />
            <ia-status-badge status="SCHEDULED" size="sm" />
          </div>
          <div class="showcase__group">
            <ia-status-badge status="EN_ROUTE" />
            <ia-status-badge status="ARRIVED" />
            <ia-status-badge status="COMPLETED" />
            <ia-status-badge status="warning" label="Retardé" />
            <ia-status-badge status="CANCELLED" />
            <ia-status-badge status="SCHEDULED" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Card</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 400px;">
            <ia-card variant="plain">
              <ng-container ia-card-header>
                <h3>Carte standard</h3>
              </ng-container>
              <p>Contenu de la carte avec bordure simple.</p>
            </ia-card>
          </div>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-card variant="elevated">
              <ng-container ia-card-header>
                <h3>Carte élevée</h3>
              </ng-container>
              <p>Carte avec ombre pour la page de suivi.</p>
            </ia-card>
          </div>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-card variant="tinted">
              <p>Bannière d'information avec fond coloré.</p>
            </ia-card>
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>List Row</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 600px;">
            <ia-list-row time="8h–12h" date="12 nov." title="Jean Dupont" subtitle="12 rue de la Paix, Paris" statusType="enroute" statusLabel="En route" techName="Marc L." />
            <ia-list-row time="13h–18h" date="12 nov." title="Marie Martin" subtitle="45 avenue des Champs, Lyon" statusType="success" statusLabel="Terminé" techName="Sophie D." techAvatar="" />
            <ia-list-row time="9h–17h" date="13 nov." title="Pierre Durand" subtitle="78 boulevard Haussmann, Paris" statusType="neutral" statusLabel="Planifié" delay="+30 min" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Drawer</h2>
        <div class="showcase__demo">
          <ia-button variant="secondary" label="Ouvrir le panneau" (clicked)="drawerOpen.set(true)" />
          <ia-drawer [isOpen]="drawerOpen()" title="Détails intervention" label="Détails intervention" (close)="drawerOpen.set(false)">
            <p>Contenu détaillé de l'intervention.</p>
            <p>Adresse, horaire, statut, notes internes.</p>
          </ia-drawer>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Modal</h2>
        <div class="showcase__demo">
          <ia-button variant="secondary" label="Annuler intervention" (clicked)="modalOpen.set(true)" />
          <ia-modal [isOpen]="modalOpen()" title="Annuler intervention" label="Confirmer l'annulation" [showFooter]="true" (closed)="modalOpen.set(false)">
            <p>Êtes-vous sûr de vouloir annuler cette intervention ?</p>
            <div ia-modal-footer>
              <ia-button variant="secondary" label="Non, revenir" (clicked)="modalOpen.set(false)" />
              <ia-button variant="danger" label="Oui, annuler" (clicked)="modalOpen.set(false)" />
            </div>
          </ia-modal>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Toast</h2>
        <div class="showcase__demo">
          <ia-button variant="secondary" label="Toast Succès" (clicked)="toastService.success('Intervention enregistrée')" />
          <ia-button variant="secondary" label="Toast Erreur" (clicked)="toastService.error('Échec de connexion')" />
          <ia-button variant="secondary" label="Toast Info" (clicked)="toastService.info('Nouvelle notification')" />
          <ia-button variant="secondary" label="Toast Warning" (clicked)="toastService.warning('Quota SMS bientôt atteint')" />
        </div>
      </section>

      <section class="showcase__section">
        <h2>Empty / Loading / Error States</h2>
        <div class="showcase__demo">
          <h3>Empty</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-empty-state title="Aucune intervention" description="Créez votre première intervention pour commencer." actionLabel="Créer une intervention" />
          </div>

          <h3>Loading</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-loading-state variant="skeleton" />
          </div>

          <h3>Error</h3>
          <div class="showcase__group" style="max-width: 400px;">
            <ia-error-state title="Impossible de charger les données" description="Vérifiez votre connexion et réessayez." retryLabel="Réessayer" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Avatar</h2>
        <div class="showcase__demo">
          <div class="showcase__group">
            <ia-avatar [name]="'Marc Lefèvre'" [size]="24" />
            <ia-avatar [name]="'Sophie Dupont'" [size]="32" />
            <ia-avatar [name]="'Pierre Martin'" [size]="48" [showRing]="true" />
            <ia-avatar [name]="'Julie Bernard'" [size]="56" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Timeline</h2>
        <div class="showcase__demo">
          <div class="showcase__group" style="max-width: 400px;">
            <ia-timeline [steps]="timelineSteps" />
          </div>
        </div>
      </section>

      <section class="showcase__section">
        <h2>Tabs</h2>
        <div class="showcase__demo">
          <h3>Underline Tabs</h3>
          <ia-tabs [tabs]="tabDefs()" [selectedIndex]="activeTabIndex()" label="Navigation principale" (selectedChange)="onTabSelect($any($event))" />
          @for (tab of tabDefs(); track tab.id; let i = $index) {
            <ia-tab-panel [tabId]="tab.id" [panelId]="'panel-' + tab.id" [isActive]="activeTabIndex() === i">
              <div class="showcase__group">Contenu de l'onglet {{ tab.label }}</div>
            </ia-tab-panel>
          }

          <h3>Segmented Control</h3>
          <ia-tabs [tabs]="segTabs()" variant="segmented" [selectedIndex]="segTabIndex()" (selectedChange)="onSegTabSelect($any($event))" />
        </div>
      </section>

      <section class="showcase__section">
        <h2>Menu</h2>
        <div class="showcase__demo">
          <ia-menu [items]="menuItems()" label="Actions" />
        </div>
      </section>

      <ia-toast-container />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }

    .showcase {
      max-width: var(--app-content-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
    }

    .showcase__title {
      font-size: var(--text-3xl);
      font-weight: var(--font-weight-semibold);
      margin-bottom: var(--space-1);
      color: var(--color-text-primary);
    }

    .showcase__subtitle {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin-bottom: var(--space-10);
    }

    .showcase__section {
      margin-bottom: var(--space-10);
    }

    .showcase__section h2 {
      font-size: var(--text-2xl);
      font-weight: var(--font-weight-semibold);
      margin-bottom: var(--space-4);
      color: var(--color-text-primary);
    }

    .showcase__demo {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .showcase__demo h3 {
      font-size: var(--text-overline);
      font-weight: var(--font-weight-semibold);
      letter-spacing: var(--tracking-overline);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .showcase__group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: flex-start;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseComponent {
  // Form values
  inputValue = '';
  inputValue2 = '';
  textareaValue = 'Bonjour, c\'est un test de textarea...';
  phoneValue = '';
  addressValue = '';
  selectValue = '';
  selectValue2 = '';
  pickerDate = '';
  pickerWindow: TimeWindow = { start: '08:00', end: '12:00' };

  // Interactive state
  drawerOpen = signal(false);
  modalOpen = signal(false);
  activeTabIndex = signal(0);
  segTabIndex = signal(0);

  // Select options
  priorityOptions: SelectOption[] = [
    { value: 'high', label: 'Haute' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'low', label: 'Basse' },
  ];

  longOptions: SelectOption[] = Array.from({ length: 15 }, (_, i) => ({
    value: `tech-${i}`,
    label: `Technicien ${i + 1}`,
  }));

  // Tab definitions
  tabDefs = (): TabDef[] => [
    { id: 'tab-list', label: 'Liste' },
    { id: 'tab-calendar', label: 'Calendrier' },
    { id: 'tab-reports', label: 'Rapports' },
  ];

  segTabs = (): TabDef[] => [
    { id: 'seg-all', label: 'Tous' },
    { id: 'seg-active', label: 'Actifs' },
  ];

  // Timeline steps
  timelineSteps: TimelineStep[] = [
    { label: 'Intervention planifiée', meta: '12 nov. à 8h', status: 'done' },
    { label: 'Technicien en route', meta: 'à 7h45', status: 'done' },
    { label: 'Technicien arrivé', meta: 'à 8h12', status: 'current' },
    { label: 'Intervention en cours', status: 'upcoming' },
    { label: 'Intervention terminée', status: 'upcoming' },
  ];

  // Menu items
  menuItems = (): MenuItemDef[] => [
    { id: 'copy', label: 'Copier le lien', icon: '📋' },
    { id: 'resend', label: 'Renvoyer SMS', icon: '📱' },
    { id: 'regenerate', label: 'Régénérer le lien', icon: '🔄' },
    { id: 'divider1', type: 'divider' },
    { id: 'cancel', label: 'Annuler', type: 'danger' },
  ];

  mockSearchFn = async (query: string) => {
    return [
      { label: `${query}, Paris`, secondary: '75001 Paris', lat: 48.8566, lng: 2.3522 },
      { label: `${query}, Lyon`, secondary: '69001 Lyon', lat: 45.764, lng: 4.8357 },
      { label: `${query}, Marseille`, secondary: '13001 Marseille', lat: 43.2965, lng: 5.3698 },
    ];
  };

  constructor(public toastService: IaToastService) {}

  onTabSelect = (index: number): void => { this.activeTabIndex.set(index); };
  onSegTabSelect = (index: number): void => { this.segTabIndex.set(index); };
}
