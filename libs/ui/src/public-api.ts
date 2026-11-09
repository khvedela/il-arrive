// Core
export { IaButtonComponent } from './components/button/button.component';

export { IaInputComponent } from './components/input/input.component';
export { IaTextareaComponent } from './components/textarea/textarea.component';
export { IaSelectComponent } from './components/select/select.component';
export type { SelectOption } from './components/select/select.types';
export { IaPhoneInputComponent } from './components/phone-input/phone-input.component';
export { IaAddressAutocompleteComponent } from './components/address-autocomplete/address-autocomplete.component';
export type { AddressSuggestion, AddressSearchFn } from './components/address-autocomplete/address-autocomplete.types';
export { IaDateWindowPickerComponent } from './components/date-window-picker/date-window-picker.component';
export type { TimeWindow, QuickChip } from './components/date-window-picker/date-window-picker.component';

// Status
export { IaStatusBadgeComponent } from './components/status-badge/status-badge.component';
export type { StatusType } from './components/status-badge/status-badge.component';

// Layout
export { IaCardComponent } from './components/card/card.component';
export { IaListRowComponent } from './components/list-row/list-row.component';
export { IaDrawerComponent } from './components/drawer/drawer.component';
export { IaModalComponent } from './components/modal/modal.component';

// Feedback
export { IaToastService } from './components/toast/toast-service';
export { IaToastContainerComponent } from './components/toast/toast-container.component';

// States
export { IaEmptyStateComponent } from './components/empty-state/empty-state.component';
export { IaLoadingStateComponent } from './components/loading-state/loading-state.component';
export { IaErrorStateComponent } from './components/error-state/error-state.component';

// Visual
export { IaAvatarComponent } from './components/avatar/avatar.component';
export { IaTimelineComponent } from './components/timeline/timeline.component';
export type { TimelineStep, TimelineStepStatus } from './components/timeline/timeline.component';

// Navigation
export { IaTabsComponent } from './components/tabs/tabs.component';
export { IaTabComponent } from './components/tabs/tab.component';
export { IaTabPanelComponent } from './components/tabs/tab-panel.component';
export { IaTabGroupDirective } from './components/tabs/tab-group.directive';
export type { TabDef } from './components/tabs/tab-group.directive';

// Menu
export { IaMenuComponent } from './components/menu/menu.component';
export { IaMenuItemComponent } from './components/menu/menu-item.component';
export type { MenuItemDef, MenuItemType } from './components/menu/menu.types';

// Shared
export { IaFocusTrapDirective } from './shared/focus-trap.directive';

// Module
export { IaUIModule } from './ui-module';
