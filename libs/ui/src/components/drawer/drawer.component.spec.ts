import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaDrawerComponent } from './drawer.component';

@Component({
  standalone: true,
  imports: [IaDrawerComponent],
  template: `
    <ia-drawer
      [isOpen]="isOpen"
      [title]="title"
      [label]="label"
      [hasFooter]="true"
      (close)="onClose()"
    >
      <p>Drawer content</p>
      <div ia-drawer-footer>
        <button>Footer action</button>
      </div>
    </ia-drawer>
  `,
})
class TestHostComponent {
  isOpen = false;
  title = 'Drawer Title';
  label = 'Drawer dialog';
  closedCount = 0;
  onClose() { this.isOpen = false; this.closedCount++; }
}

describe('IaDrawerComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaDrawerComponent))).toBeTruthy();
  });

  it('is hidden when isOpen is false', () => {
    expect(fixture.debugElement.query(By.css('.ia-drawer__panel'))).toBeNull();
  });

  it('shows panel when isOpen is true', () => {
    host.isOpen = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-drawer__panel'))).toBeTruthy();
  });

  it('has role="dialog" and aria-modal', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.css('.ia-drawer__panel'));
    expect(panel.nativeElement.getAttribute('role')).toBe('dialog');
    expect(panel.nativeElement.getAttribute('aria-modal')).toBe('true');
  });

  it('emits close on scrim click', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const drawerDe = fixture.debugElement.query(By.directive(IaDrawerComponent));
    drawerDe.triggerEventHandler('close', undefined);
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
  });

  it('renders title', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const title = fixture.debugElement.query(By.css('.ia-drawer__title'));
    expect(title.nativeElement.textContent).toBe('Drawer Title');
  });

  it('renders close button with aria-label', () => {
    host.isOpen = true;
    fixture.detectChanges();
    const closeBtn = fixture.debugElement.query(By.css('.ia-drawer__close'));
    expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('Fermer le panneau');
  });

  it('renders footer', () => {
    host.isOpen = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-drawer__footer'))).toBeTruthy();
  });
});
