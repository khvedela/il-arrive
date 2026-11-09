import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaStatusBadgeComponent } from './status-badge.component';

@Component({
  standalone: true,
  imports: [IaStatusBadgeComponent],
  template: `
    <ia-status-badge [status]="status" [size]="size" [label]="label" [meta]="meta" />
  `,
})
class TestHostComponent {
  status = 'EN_ROUTE';
  size: 'sm' | 'md' = 'md';
  label: string | null = null;
  meta: string | null = null;
}

describe('IaStatusBadgeComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  it('creates', () => {
    expect(IaStatusBadgeComponent).toBeTruthy();
  });

  it('renders with correct status class for EN_ROUTE', () => {
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge--enroute'));
    expect(badge).toBeTruthy();
  });

  it('renders with correct status class for SCHEDULED', () => {
    host.status = 'SCHEDULED';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge--neutral'));
    expect(badge).toBeTruthy();
  });

  it('renders with correct status class for COMPLETED', () => {
    host.status = 'COMPLETED';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge--success'));
    expect(badge).toBeTruthy();
  });

  it('renders with correct status class for CANCELLED', () => {
    host.status = 'CANCELLED';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge--error'));
    expect(badge).toBeTruthy();
  });

  it('shows default label from status map', () => {
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.ia-status-badge__label'));
    expect(label.nativeElement.textContent.trim()).toBe('En route');
  });

  it('shows custom label when provided', () => {
    host.label = 'Custom Label';
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.ia-status-badge__label'));
    expect(label.nativeElement.textContent.trim()).toBe('Custom Label');
  });

  it('renders meta when provided', () => {
    host.meta = '8:30';
    fixture.detectChanges();
    const meta = fixture.debugElement.query(By.css('.ia-status-badge__meta'));
    expect(meta.nativeElement.textContent).toBe('8:30');
  });

  it('hides meta when not provided', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-status-badge__meta'))).toBeNull();
  });

  it('applies sm size class', () => {
    host.size = 'sm';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge'));
    expect(badge.nativeElement.className).toContain('ia-status-badge__size--sm');
  });

  it('applies md size class', () => {
    host.size = 'md';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge'));
    expect(badge.nativeElement.className).toContain('ia-status-badge__size--md');
  });

  it('has status dot', () => {
    fixture.detectChanges();
    const dot = fixture.debugElement.query(By.css('.ia-status-badge__dot'));
    expect(dot).toBeTruthy();
  });

  it('accepts StatusType directly', () => {
    host.status = 'warning';
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.ia-status-badge--warning'));
    expect(badge).toBeTruthy();
  });
});
