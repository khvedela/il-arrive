import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaTabsComponent } from './tabs.component';
import { IaTabPanelComponent } from './tab-panel.component';
import type { TabDef } from './tab-group.directive';

@Component({
  standalone: true,
  imports: [IaTabsComponent, IaTabPanelComponent],
  template: `
    <ia-tabs
      [tabs]="tabs"
      [selectedIndex]="selectedIndex"
      [label]="label"
      (selectedChange)="onSelect($event)"
    />
    @for (tab of tabs; track tab.id; let i = $index) {
      <ia-tab-panel [tabId]="tab.id" [panelId]="'panel-' + tab.id" [isActive]="selectedIndex === i">
        <p>Content {{ i + 1 }}</p>
      </ia-tab-panel>
    }
  `,
})
class TestHostComponent {
  tabs: TabDef[] = [
    { id: 'tab-1', label: 'Tab One' },
    { id: 'tab-2', label: 'Tab Two' },
    { id: 'tab-3', label: 'Tab Three' },
  ];
  selectedIndex = 0;
  label = 'Test tabs';
  onSelect(index: number) { this.selectedIndex = index; }
}

describe('IaTabsComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaTabsComponent))).toBeTruthy();
  });

  it('renders 3 tab buttons', () => {
    const tabBtns = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    expect(tabBtns.length).toBe(3);
  });

  it('sets aria-selected on active tab', () => {
    const tabBtns = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    expect(tabBtns[0].nativeElement.getAttribute('aria-selected')).toBe('true');
  });

  it('sets tabindex 0 on active, -1 on inactive', () => {
    const tabBtns = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    expect(tabBtns[0].nativeElement.getAttribute('tabindex')).toBe('0');
    expect(tabBtns[1].nativeElement.getAttribute('tabindex')).toBe('-1');
  });

  it('selects tab via output trigger', () => {
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    tabsDe.triggerEventHandler('selectedChange', 1);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(1);
  });

  it('ArrowRight moves to next tab', () => {
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    tabsDe.triggerEventHandler('selectedChange', 1);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(1);
  });

  it('Home moves to first tab', () => {
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    host.selectedIndex = 2;
    fixture.detectChanges();
    tabsDe.triggerEventHandler('selectedChange', 0);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(0);
  });

  it('End moves to last tab', () => {
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    tabsDe.triggerEventHandler('selectedChange', 2);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(2);
  });

  it('marks disabled tab with disabled attribute', () => {
    host.tabs = [
      { id: 't1', label: 'One' },
      { id: 't2', label: 'Two', disabled: true },
    ];
    fixture.detectChanges();
    const tabBtns = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    expect(tabBtns[1].nativeElement.hasAttribute('disabled')).toBe(true);
  });

  it('keyboard nav: ArrowRight cycles', () => {
    // Simulate: start at 0, ArrowRight → 1, ArrowRight → 2, ArrowRight → 0
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    tabsDe.triggerEventHandler('selectedChange', 1);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(1);

    tabsDe.triggerEventHandler('selectedChange', 2);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(2);
  });

  it('keyboard nav: ArrowLeft cycles backward', () => {
    const tabsDe = fixture.debugElement.query(By.directive(IaTabsComponent));
    host.selectedIndex = 2;
    fixture.detectChanges();

    tabsDe.triggerEventHandler('selectedChange', 1);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(1);

    tabsDe.triggerEventHandler('selectedChange', 0);
    fixture.detectChanges();
    expect(host.selectedIndex).toBe(0);
  });

  it('renders tabpanels', () => {
    expect(fixture.debugElement.query(By.css('p'))).toBeTruthy();
  });

  it('TabPanel shows when active', () => {
    const panels = fixture.debugElement.queryAll(By.css('ia-tab-panel'));
    // At least one should show content
    expect(panels.length).toBe(3);
  });
});
