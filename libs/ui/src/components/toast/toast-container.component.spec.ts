import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaToastContainerComponent } from './toast-container.component';
import { IaToastService } from './toast-service';

@Component({
  standalone: true,
  imports: [IaToastContainerComponent],
  template: `<ia-toast-container />`,
  providers: [IaToastService],
})
class TestHostComponent {}

describe('IaToastContainerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let service: IaToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [IaToastService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    service = fixture.debugElement.injector.get(IaToastService);
  });

  it('creates', () => {
    expect(IaToastContainerComponent).toBeTruthy();
  });

  it('renders container with role="status"', () => {
    fixture.detectChanges();
    const container = fixture.debugElement.query(By.css('.ia-toast-container'));
    expect(container.nativeElement.getAttribute('role')).toBe('status');
  });

  it('renders toasts from service', () => {
    service.info('Hello world');
    fixture.detectChanges();
    const toasts = fixture.debugElement.queryAll(By.css('.ia-toast'));
    expect(toasts.length).toBe(1);
    expect(toasts[0].nativeElement.textContent).toContain('Hello world');
  });

  it('error toast has role="alert"', () => {
    service.error('Error occurred');
    fixture.detectChanges();
    const toast = fixture.debugElement.query(By.css('[role="alert"]'));
    expect(toast).toBeTruthy();
  });

  it('info toast has role="status"', () => {
    service.info('Info message');
    fixture.detectChanges();
    const toast = fixture.debugElement.query(By.css('[role="status"]'));
    expect(toast).toBeTruthy();
  });

  it('removes toast on close click', () => {
    service.info('Dismiss me');
    fixture.detectChanges();
    const closeBtn = fixture.debugElement.query(By.css('.ia-toast__close'));
    closeBtn.triggerEventHandler('click', {});
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('.ia-toast')).length).toBe(0);
  });

  it('applies type class for success', () => {
    service.success('Success!');
    fixture.detectChanges();
    const toast = fixture.debugElement.query(By.css('.ia-toast--success'));
    expect(toast).toBeTruthy();
  });

  it('applies type class for error', () => {
    service.error('Error!');
    fixture.detectChanges();
    const toast = fixture.debugElement.query(By.css('.ia-toast--error'));
    expect(toast).toBeTruthy();
  });
});
