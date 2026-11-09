import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ia-tab',
  standalone: true,
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTabComponent {
  label = input('');
}
