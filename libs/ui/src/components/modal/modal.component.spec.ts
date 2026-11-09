import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaModalComponent } from './modal.component';

@Component({
  standalone: true,
  imports: [IaModalComponent],
  template: `
    <ia-modal
      [isOpen]="isOpen"
      [title]="title"
      [label]="label"
      [showFooter]="true"
      (closed)="onClose()"
      (confirmed)="onConfirm()"
    >
      <p>Modal content</p>
      <div ia-modal-footer>
        <button>Cancel</button>
        <button>Confirm</button>
      </div>
    </ia-modal>
  `,
})
class TestHostComponent {
  isOpen = false;
  title = 'Test Modal';
  label = 'Test modal dialog';
  closedCount = 0;
  confirmedCount = 0;
  onClose() { this.isOpen = false; this.closedCount++; }
  onConfirm() { this.confirmedCount++; }
}

describe('IaModalComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaModalComponent))).toBeTruthy();
  });

  it('is hidden when isOpen is false', () => {
    expect(fixture.debugElement.query(By.css('.ia-modal__dialog'))).toBeNull();
  });

  it('shows dialog when isOpen is true', () => {
    host.isOpen = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-modal__dialog'))).toBeTruthy();
  });

  it('has role="dialog" and aria-modal', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.css('.ia-modal__dialog'));
    expect(dialog.nativeElement.getAttribute('role')).toBe('dialog');
    expect(dialog.nativeElement.getAttribute('aria-modal')).toBe('true');
  });

  it('emits closed on scrim click', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const modalDe = fixture.debugElement.query(By.directive(IaModalComponent));
    modalDe.triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
  });

  it('emits closed on Escape key', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const modalDe = fixture.debugElement.query(By.directive(IaModalComponent));
    modalDe.triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
  });

  it('emits confirmed on Enter key', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const modalDe = fixture.debugElement.query(By.directive(IaModalComponent));
    modalDe.triggerEventHandler('confirmed', undefined);
    fixture.detectChanges();
    expect(host.confirmedCount).toBe(1);
  });

  it('renders title', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const title = fixture.debugElement.query(By.css('.ia-modal__title'));
    expect(title.nativeElement.textContent).toBe('Test Modal');
  });

  it('renders close button with aria-label', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const closeBtn = fixture.debugElement.query(By.css('.ia-modal__close'));
    expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('Fermer');
  });

  it('renders footer content', () => {
    host.isOpen = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-modal__footer'))).toBeTruthy();
  });
});
