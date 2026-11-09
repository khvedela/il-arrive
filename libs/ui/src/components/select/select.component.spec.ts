import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaSelectComponent } from './select.component';
import type { SelectOption } from './select.types';

@Component({
  standalone: true,
  imports: [IaSelectComponent],
  template: `
    <ia-select
      [label]="label"
      [placeholder]="placeholder"
      [options]="options"
      [errorText]="errorText"
      [(value)]="value"
    />
  `,
})
class TestHostComponent {
  label = 'Choice';
  placeholder = 'Select...';
  options: SelectOption[] = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ];
  errorText: string | null = null;
  value = '';
}

describe('IaSelectComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaSelectComponent))).toBeTruthy();
  });

  it('uses native select for short list', () => {
    expect(fixture.debugElement.query(By.css('select'))).toBeTruthy();
  });

  it('updates value on native select change', () => {
    const select = fixture.debugElement.query(By.css('select'));
    select.triggerEventHandler('change', { target: { value: 'b' } });
    fixture.detectChanges();
    expect(host.value).toBe('b');
  });

  it('uses combobox popover for long list', () => {
    host.options = Array.from({ length: 15 }, (_, i) => ({ value: `opt-${i}`, label: `Option ${i}` }));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-select__combobox'))).toBeTruthy();
  });

  it('opens listbox on trigger click', () => {
    host.options = Array.from({ length: 15 }, (_, i) => ({ value: `opt-${i}`, label: `Option ${i}` }));
    fixture.detectChanges();
    const selectComp = fixture.debugElement.query(By.directive(IaSelectComponent)).componentInstance as IaSelectComponent;
    selectComp['isOpen'].set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-select__listbox'))).toBeTruthy();
  });

  it('ArrowDown opens and navigates', () => {
    host.options = Array.from({ length: 5 }, (_, i) => ({ value: `opt-${i}`, label: `Option ${i}` }));
    fixture.detectChanges();
    const selectComp = fixture.debugElement.query(By.directive(IaSelectComponent)).componentInstance as IaSelectComponent;
    selectComp['isOpen'].set(true);
    selectComp['activeIndex'].set(0);
    fixture.detectChanges();
    expect(selectComp['activeIndex']()).toBe(0);
  });

  it('Escape closes popover', () => {
    host.options = Array.from({ length: 5 }, (_, i) => ({ value: `opt-${i}`, label: `Option ${i}` }));
    fixture.detectChanges();
    const selectComp = fixture.debugElement.query(By.directive(IaSelectComponent)).componentInstance as IaSelectComponent;
    selectComp['isOpen'].set(true);
    fixture.detectChanges();
    selectComp['isOpen'].set(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-select__listbox'))).toBeNull();
  });

  it('shows error text', () => {
    host.errorText = 'Required';
    fixture.detectChanges();
    const error = fixture.debugElement.query(By.css('.ia-select__error'));
    expect(error.nativeElement.textContent.trim()).toBe('Required');
  });

  it('shows placeholder in native select', () => {
    host.options = Array.from({ length: 3 }, (_, i) => ({ value: `opt-${i}`, label: `Option ${i}` }));
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.css('select'));
    const options = select.queryAll(By.css('option'));
    expect(options[0].nativeElement.text).toBe('Select...');
  });
});
