import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IaMenuComponent } from './menu.component';
import type { MenuItemDef } from './menu.types';

@Component({
  standalone: true,
  imports: [IaMenuComponent],
  template: `
    <ia-menu
      [items]="items"
      [label]="label"
      (selected)="onSelect($event)"
    />
  `,
})
class TestHostComponent {
  items: MenuItemDef[] = [
    { id: 'copy', label: 'Copy link', icon: 'C' },
    { id: 'resend', label: 'Resend SMS', icon: 'R' },
    { id: 'divider', type: 'divider' },
    { id: 'cancel', label: 'Cancel', type: 'danger' },
    { id: 'disabled', label: 'Disabled', disabled: true },
  ];
  label = 'Actions menu';
  selectedItem: MenuItemDef | null = null;
  onSelect(item: MenuItemDef) { this.selectedItem = item; }
}

describe('IaMenuComponent', () => {
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
    expect(fixture.debugElement.query(By.directive(IaMenuComponent))).toBeTruthy();
  });

  it('has aria-haspopup on trigger', () => {
    const trigger = fixture.debugElement.query(By.css('.ia-menu__trigger'));
    expect(trigger.nativeElement.getAttribute('aria-haspopup')).toBe('true');
  });

  it('opens on trigger click', () => {
    const trigger = fixture.debugElement.query(By.css('.ia-menu__trigger'));
    trigger.triggerEventHandler('click', {});
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.ia-menu__panel'))).toBeTruthy();
  });

  it('renders menuitems and divider', () => {
    const trigger = fixture.debugElement.query(By.css('.ia-menu__trigger'));
    trigger.triggerEventHandler('click', {});
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
    expect(items.length).toBe(4);
    const separators = fixture.debugElement.queryAll(By.css('[role="separator"]'));
    expect(separators.length).toBe(1);
  });

  it('emits selected on item selection', () => {
    const menuDe = fixture.debugElement.query(By.directive(IaMenuComponent));
    menuDe.triggerEventHandler('selected', host.items[0]);
    fixture.detectChanges();
    expect(host.selectedItem?.id).toBe('copy');
  });

  it('renders danger items with class', () => {
    const trigger = fixture.debugElement.query(By.css('.ia-menu__trigger'));
    trigger.triggerEventHandler('click', {});
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('.ia-menu__item--danger')).length).toBe(1);
  });
});
