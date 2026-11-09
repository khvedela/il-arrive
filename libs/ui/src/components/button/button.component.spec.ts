import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaButtonComponent, ButtonVariant, ButtonSize } from './button.component';

@Component({
  standalone: true,
  imports: [IaButtonComponent],
  template: `
    <ia-button
      [variant]="variant"
      [size]="size"
      [label]="label"
      [disabled]="disabled"
      [loading]="loading"
      [icon]="icon"
      [iconPosition]="iconPos"
      (clicked)="onClick($event)"
    />
  `,
})
class TestHostComponent {
  variant: ButtonVariant = 'primary';
  size: ButtonSize = 'md';
  label = 'Click me';
  disabled = false;
  loading = false;
  icon = null as string | null;
  iconPos: 'before' | 'after' = 'before';
  clickedCount = 0;
  onClick() { this.clickedCount++; }
}

describe('IaButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(IaButtonComponent).toBeTruthy();
  });

  it('renders button with label', () => {
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.textContent).toContain('Click me');
  });

  it('emits clicked on click', () => {
    const buttonDe = fixture.debugElement.query(By.directive(IaButtonComponent));
    buttonDe.triggerEventHandler('clicked', new Event('click'));
    fixture.detectChanges();
    expect(host.clickedCount).toBe(1);
  });

  it('does not emit clicked when disabled', () => {
    host.disabled = true;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    nativeBtn.triggerEventHandler('click', new Event('click'));
    fixture.detectChanges();
    expect(host.clickedCount).toBe(0);
  });

  it('does not emit clicked when loading', () => {
    host.loading = true;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    nativeBtn.triggerEventHandler('click', new Event('click'));
    fixture.detectChanges();
    expect(host.clickedCount).toBe(0);
  });

  it('applies variant class', () => {
    host.variant = 'secondary';
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.className).toContain('ia-button--secondary');
  });

  it.each(['sm', 'md', 'lg', 'action'] as ButtonSize[])('applies size class for %s', (size) => {
    host.size = size;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.className).toContain(`ia-button__size--${size}`);
  });

  it('shows spinner when loading', () => {
    host.loading = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-button__spinner'))).toBeTruthy();
  });

  it('sets aria-busy when loading', () => {
    host.loading = true;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.getAttribute('aria-busy')).toBe('true');
  });

  it('has aria-live polite region for loading text', () => {
    host.loading = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[aria-live="polite"]'))).toBeTruthy();
  });

  it('disables native button when disabled', () => {
    host.disabled = true;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.disabled).toBe(true);
  });

  it('disables native button when loading', () => {
    host.loading = true;
    fixture.detectChanges();
    const nativeBtn = fixture.debugElement.query(By.css('button'));
    expect(nativeBtn.nativeElement.disabled).toBe(true);
  });
});
