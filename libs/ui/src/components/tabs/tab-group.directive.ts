import { Directive, input } from '@angular/core';

export interface TabDef {
  label: string;
  id: string;
  disabled?: boolean;
}

@Directive({
  selector: '[iaTabGroup]',
  standalone: true,
})
export class IaTabGroupDirective {
  selectedIndex = input(0);
  tabs = input<TabDef[]>([]);
}
