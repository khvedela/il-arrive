import { NgModule } from '@angular/core';
import { IaButtonComponent } from './components/button/button.component';
import { IaInputComponent } from './components/input/input.component';
import { IaTextareaComponent } from './components/textarea/textarea.component';
import { IaSelectComponent } from './components/select/select.component';
import { IaPhoneInputComponent } from './components/phone-input/phone-input.component';
import { IaAddressAutocompleteComponent } from './components/address-autocomplete/address-autocomplete.component';
import { IaDateWindowPickerComponent } from './components/date-window-picker/date-window-picker.component';
import { IaStatusBadgeComponent } from './components/status-badge/status-badge.component';
import { IaCardComponent } from './components/card/card.component';
import { IaListRowComponent } from './components/list-row/list-row.component';
import { IaDrawerComponent } from './components/drawer/drawer.component';
import { IaModalComponent } from './components/modal/modal.component';
import { IaToastContainerComponent } from './components/toast/toast-container.component';
import { IaEmptyStateComponent } from './components/empty-state/empty-state.component';
import { IaLoadingStateComponent } from './components/loading-state/loading-state.component';
import { IaErrorStateComponent } from './components/error-state/error-state.component';
import { IaAvatarComponent } from './components/avatar/avatar.component';
import { IaTimelineComponent } from './components/timeline/timeline.component';
import { IaTabsComponent } from './components/tabs/tabs.component';
import { IaTabComponent } from './components/tabs/tab.component';
import { IaTabPanelComponent } from './components/tabs/tab-panel.component';
import { IaTabGroupDirective } from './components/tabs/tab-group.directive';
import { IaMenuComponent } from './components/menu/menu.component';
import { IaMenuItemComponent } from './components/menu/menu-item.component';
import { IaFocusTrapDirective } from './shared/focus-trap.directive';

const COMPONENTS = [
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
  IaTabComponent,
  IaTabPanelComponent,
  IaTabGroupDirective,
  IaMenuComponent,
  IaMenuItemComponent,
  IaFocusTrapDirective,
];

@NgModule({
  imports: COMPONENTS,
  exports: COMPONENTS,
})
export class IaUIModule {}
