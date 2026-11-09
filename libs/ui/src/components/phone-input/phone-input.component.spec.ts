import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaPhoneInputComponent } from './phone-input.component';

@Component({
  standalone: true,
  imports: [IaPhoneInputComponent],
  template: `
    <ia-phone-input
      [label]="label"
      [errorText]="errorText"
      [(value)]="value"
    />
  `,
})
class TestHostComponent {
  label = 'Phone';
  errorText: string | null = null;
  value = '';
}

describe('IaPhoneInputComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaPhoneInputComponent))).toBeTruthy();
  });

  it('formats French number via formatNational', () => {
    const comp = fixture.debugElement.query(By.directive(IaPhoneInputComponent)).componentInstance;
    expect(comp['formatNational']('+33612345678')).toBe('61 23 45 67 8');
  });

  it('converts national number to E.164', () => {
    const comp = fixture.debugElement.query(By.directive(IaPhoneInputComponent)).componentInstance;
    expect(comp['toE164']('0612345678')).toBe('+33612345678');
  });

  it('handles 9-digit number', () => {
    const comp = fixture.debugElement.query(By.directive(IaPhoneInputComponent)).componentInstance;
    expect(comp['toE164']('612345678')).toBe('+33612345678');
  });

  it('handles empty value', () => {
    const comp = fixture.debugElement.query(By.directive(IaPhoneInputComponent)).componentInstance;
    expect(comp['toE164']('')).toBe('');
  });

  it('has +33 prefix', () => {
    const prefix = fixture.debugElement.query(By.css('.ia-input__prefix'));
    expect(prefix.nativeElement.textContent).toContain('+33');
  });

  it('displays formatted number via computed', () => {
    host.value = '+33612345678';
    fixture.detectChanges();
    const comp = fixture.debugElement.query(By.directive(IaPhoneInputComponent)).componentInstance;
    expect(comp['displayValue']()).toBe('61 23 45 67 8');
  });
});
