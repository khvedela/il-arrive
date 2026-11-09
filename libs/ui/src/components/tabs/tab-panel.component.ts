import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-tab-panel',
  standalone: true,
  template: `
    <div class="ia-tab-panel"
         role="tabpanel"
         [attr.id]="panelId()"
         [attr.aria-labelledby]="tabId()"
         [hidden]="!isActive()">
      <ng-content />
    </div>
  `,
  styles: [`
    .ia-tab-panel {
      padding: var(--space-4) 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTabPanelComponent {
  tabId = input('');
  panelId = input('');
  isActive = input(false);
}
