import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaInputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [IaInputComponent],
  template: `
    <ia-input
      [label]="label"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [errorText]="errorText"
      [helperText]="helperText"
      [maxLength]="maxLength"
      [(value)]="value"
    />
  `,
})
class TestHostComponent {
  label = 'Name';
  placeholder = 'Enter name';
  disabled = false;
  errorText: string | null = null;
  helperText = '';
  maxLength: number | null = null;
  value = '';
}

describe('IaInputComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaInputComponent))).toBeTruthy();
  });

  it('renders label', () => {
    const label = fixture.debugElement.query(By.css('.ia-input__label'));
    expect(label.nativeElement.textContent).toBe('Name');
  });

  it('renders input with correct placeholder', () => {
    const nativeInput = fixture.debugElement.query(By.css('input'));
    expect(nativeInput.nativeElement.placeholder).toBe('Enter name');
  });

  it('shows error text when errorText is set', () => {
    host.errorText = 'Invalid input';
    fixture.detectChanges();
    const error = fixture.debugElement.query(By.css('.ia-input__error'));
    expect(error.nativeElement.textContent.trim()).toBe('Invalid input');
  });

  it('sets aria-invalid when error', () => {
    host.errorText = 'Invalid';
    fixture.detectChanges();
    const nativeInput = fixture.debugElement.query(By.css('input'));
    expect(nativeInput.nativeElement.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows helper text when no error', () => {
    host.helperText = 'Helper text';
    fixture.detectChanges();
    const helper = fixture.debugElement.query(By.css('.ia-input__helper'));
    expect(helper.nativeElement.textContent).toBe('Helper text');
  });

  it('hides helper when error present', () => {
    host.helperText = 'Helper';
    host.errorText = 'Error';
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-input__helper'))).toBeNull();
  });

  it('shows character counter when maxLength is set', () => {
    host.maxLength = 100;
    host.value = 'test';
    fixture.detectChanges();
    const counter = fixture.debugElement.query(By.css('.ia-input__counter'));
    expect(counter.nativeElement.textContent.trim()).toBe('4/100');
  });

  it('marks counter as error when over max', () => {
    host.maxLength = 3;
    host.value = 'test';
    fixture.detectChanges();
    const counter = fixture.debugElement.query(By.css('.ia-input__counter'));
    expect(counter.nativeElement.className).toContain('ia-input__counter--error');
  });

  it('sets aria-describedby with helper and counter', () => {
    host.helperText = 'Helper';
    host.maxLength = 100;
    fixture.detectChanges();
    const nativeInput = fixture.debugElement.query(By.css('input'));
    const desc = nativeInput.nativeElement.getAttribute('aria-describedby');
    expect(desc).toContain('helper-');
    expect(desc).toContain('counter-');
  });

  it('sets aria-describedby with error', () => {
    host.errorText = 'Error';
    fixture.detectChanges();
    const nativeInput = fixture.debugElement.query(By.css('input'));
    const desc = nativeInput.nativeElement.getAttribute('aria-describedby');
    expect(desc).toContain('error-');
  });

  it('disables input when disabled', () => {
    host.disabled = true;
    fixture.detectChanges();
    const nativeInput = fixture.debugElement.query(By.css('input'));
    expect(nativeInput.nativeElement.disabled).toBe(true);
  });
});
