import { Directive, forwardRef } from '@angular/core';
import { CdkScrollable } from '@angular/cdk/scrolling';

export const IA_CDK_SCROLLABLE = {
  provide: CdkScrollable,
  useExisting: forwardRef(() => IaCdkScrollableDirective),
};

@Directive({
  selector: '[iaCdkScrollable]',
  standalone: true,
  providers: [IA_CDK_SCROLLABLE],
})
export class IaCdkScrollableDirective extends CdkScrollable {}
