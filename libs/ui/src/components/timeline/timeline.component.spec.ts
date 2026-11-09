import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaTimelineComponent, TimelineStep } from './timeline.component';

@Component({
  standalone: true,
  imports: [IaTimelineComponent],
  template: `
    <ia-timeline [steps]="steps" />
  `,
})
class TestHostComponent {
  steps: TimelineStep[] = [
    { label: 'Step 1', meta: '8:00', status: 'done' },
    { label: 'Step 2', meta: '8:30', status: 'current' },
    { label: 'Step 3', meta: '9:00', status: 'upcoming' },
  ];
}

describe('IaTimelineComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('creates', () => {
    expect(IaTimelineComponent).toBeTruthy();
  });

  it('renders steps as ordered list', () => {
    fixture.detectChanges();
    const ol = fixture.debugElement.query(By.css('ol'));
    expect(ol).toBeTruthy();
  });

  it('renders 3 step items', () => {
    fixture.detectChanges();
    const steps = fixture.debugElement.queryAll(By.css('.ia-timeline__step'));
    expect(steps.length).toBe(3);
  });

  it('marks current step with aria-current="step"', () => {
    fixture.detectChanges();
    const steps = fixture.debugElement.queryAll(By.css('.ia-timeline__step'));
    expect(steps[1].nativeElement.getAttribute('aria-current')).toBe('step');
  });

  it('renders done step with check', () => {
    fixture.detectChanges();
    const doneStep = fixture.debugElement.query(By.css('.ia-timeline__step--done'));
    expect(doneStep).toBeTruthy();
  });

  it('renders current step with pulse dot', () => {
    fixture.detectChanges();
    const currentStep = fixture.debugElement.query(By.css('.ia-timeline__step--current'));
    expect(currentStep).toBeTruthy();
  });

  it('renders upcoming step with ring', () => {
    fixture.detectChanges();
    const upcomingStep = fixture.debugElement.query(By.css('.ia-timeline__step--upcoming'));
    expect(upcomingStep).toBeTruthy();
  });

  it('renders meta for steps that have it', () => {
    fixture.detectChanges();
    const metas = fixture.debugElement.queryAll(By.css('.ia-timeline__meta'));
    expect(metas.length).toBe(3);
  });

  it('renders connectors between steps', () => {
    fixture.detectChanges();
    const connectors = fixture.debugElement.queryAll(By.css('.ia-timeline__connector'));
    expect(connectors.length).toBe(2); // N-1 connectors
  });
});
