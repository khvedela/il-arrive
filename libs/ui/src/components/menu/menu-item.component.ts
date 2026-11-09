import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-menu-item',
  standalone: true,
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaMenuItemComponent {
  label = input('');
}
