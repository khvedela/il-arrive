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

import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [IaInputComponent, ReactiveFormsModule],
  template: `<form [formGroup]="form"><ia-input label="Email" formControlName="email" /></form>`,
})
class FormHostComponent {
  form = new FormGroup({ email: new FormControl('', { nonNullable: true }) });
}

describe('IaInputComponent as ControlValueAccessor', () => {
  let fixture: ComponentFixture<FormHostComponent>;
  let form: FormGroup;
  const nativeInput = () => fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(FormHostComponent);
    form = fixture.componentInstance.form;
    fixture.detectChanges();
  });

  it('typing updates the control', () => {
    nativeInput().value = 'a@b.co';
    nativeInput().dispatchEvent(new Event('input'));
    expect(form.value.email).toBe('a@b.co');
  });

  it('setValue updates the DOM', () => {
    form.get('email')!.setValue('x@y.fr');
    fixture.detectChanges();
    expect(nativeInput().value).toBe('x@y.fr');
  });

  it('blur marks the control touched', () => {
    expect(form.get('email')!.touched).toBe(false);
    nativeInput().dispatchEvent(new Event('blur'));
    expect(form.get('email')!.touched).toBe(true);
  });

  it('disable/enable on the control toggles the input', () => {
    form.get('email')!.disable();
    fixture.detectChanges();
    expect(nativeInput().disabled).toBe(true);
    form.get('email')!.enable();
    fixture.detectChanges();
    expect(nativeInput().disabled).toBe(false);
  });
});
