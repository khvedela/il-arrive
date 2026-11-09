import { Directive, ElementRef, OnDestroy, OnInit, Renderer2, ChangeDetectionStrategy } from '@angular/core';

@Directive({
  selector: '[iaFocusTrap]',
  standalone: true,
})
export class IaFocusTrapDirective implements OnInit, OnDestroy {
  private previouslyFocused?: HTMLElement | null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement) this.previouslyFocused = active;
    this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;

      const current = document.activeElement;
      const currentIndex = focusable.indexOf(current as HTMLElement);

      if (event.shiftKey) {
        if (currentIndex <= 0) focusable[focusable.length - 1]?.focus();
        else focusable[currentIndex - 1]?.focus();
      } else {
        if (currentIndex >= focusable.length - 1) focusable[0]?.focus();
        else focusable[currentIndex + 1]?.focus();
      }
    });

    requestAnimationFrame(() => {
      const focusable = this.getFocusableElements();
      if (focusable.length) focusable[0]?.focus();
    });
  }

  ngOnDestroy(): void {
    if (this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
