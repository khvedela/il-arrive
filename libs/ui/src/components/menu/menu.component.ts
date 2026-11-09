import {
  Component,
  input,
  signal,
  computed,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgFor } from '@angular/common';
import { MenuItemDef } from './menu.types';

@Component({
  selector: 'ia-menu',
  standalone: true,
  template: `
    <div class="ia-menu-wrapper">
      <button #trigger class="ia-menu__trigger"
              aria-haspopup="true"
              [attr.aria-expanded]="isOpen()"
              (click)="toggle()"
              (keydown)="onTriggerKeydown($event)">
        @if (triggerIcon()) {
          <span aria-hidden="true">&#x22EE;</span>
        } @else {
          {{ triggerLabel() || 'Options' }}
        }
      </button>

      @if (isOpen()) {
        <ul #menuPanel class="ia-menu__panel" role="menu" [attr.aria-label]="label()">
          @for (item of items(); track item.id) {
            @if (item.type === 'divider') {
              <li class="ia-menu__divider" role="separator"></li>
            } @else {
              <li class="ia-menu__item"
                  [class.ia-menu__item--danger]="item.type === 'danger'"
                  [class.ia-menu__item--disabled]="item.disabled"
                  [class.ia-menu__item--active]="isMenuActive(item)"
                  role="menuitem"
                  [attr.tabindex]="isMenuActive(item) ? 0 : -1"
                  (click)="selectItem(item)"
                  (keydown)="onItemKeydown($event, item)">
                @if (item.icon) {
                  <span class="ia-menu__item-icon" aria-hidden="true">{{ item.icon }}</span>
                }
                <span class="ia-menu__item-label">{{ item.label }}</span>
              </li>
            }
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; position: relative; }
    .ia-menu-wrapper { position: relative; display: inline-block; }

    .ia-menu__trigger {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border: none; background: transparent;
      color: var(--color-text-muted); cursor: pointer; border-radius: var(--radius-md);
    }
    .ia-menu__trigger:hover { background: var(--color-surface-hover); }
    .ia-menu__trigger:focus-visible { outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }

    @media (max-width: 640px) { .ia-menu__trigger { width: var(--touch-target-min); height: var(--touch-target-min); } }

    .ia-menu__panel {
      position: absolute; right: 0; top: calc(100% + var(--space-1));
      min-width: 180px; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      box-shadow: var(--shadow-md); padding: var(--space-1) 0;
      z-index: var(--z-dropdown); list-style: none; margin: 0;
    }

    .ia-menu__item {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-1) var(--space-4); cursor: pointer;
      font-size: var(--text-sm); color: var(--color-text-primary); height: 36px;
    }
    @media (max-width: 640px) { .ia-menu__item { height: 44px; } }
    .ia-menu__item:hover, .ia-menu__item--active { background: var(--color-surface-hover); }
    .ia-menu__item--disabled { color: var(--color-text-muted); cursor: default; opacity: 0.6; }
    .ia-menu__item--danger { color: var(--color-danger-text); }
    .ia-menu__item-icon { width: 16px; text-align: center; flex-shrink: 0; }
    .ia-menu__item-label { flex: 1; }
    .ia-menu__divider { height: 1px; background: var(--color-border); margin: var(--space-1) 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaMenuComponent implements AfterViewInit, OnDestroy {
  items = input<MenuItemDef[]>([]);
  label = input('Actions');
  triggerLabel = input<string>('');
  triggerIcon = input(true);
  selected = new EventEmitter<MenuItemDef>();

  isOpen = signal(false);
  activeIndex = signal(-1);

  protected isMenuActive = (item: MenuItemDef): boolean => {
    const menuItems = this.items().filter(i => i.type !== 'divider');
    return this.activeIndex() === menuItems.indexOf(item);
  };

  protected toggle = (): void => {
    this.isOpen.set(!this.isOpen());
    if (!this.isOpen()) this.activeIndex.set(-1);
  };

  protected selectItem = (item: MenuItemDef): void => {
    if (item.disabled) return;
    this.selected.emit(item);
    this.isOpen.set(false);
  };

  protected onTriggerKeydown = (event: KeyboardEvent): void => {
    const menuItems = this.items().filter(i => i.type !== 'divider');
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!this.isOpen()) this.toggle(); else this.activeIndex.set(0); }
    if (event.key === 'Escape') { event.preventDefault(); if (this.isOpen()) this.toggle(); }
  };

  protected onItemKeydown = (event: KeyboardEvent, item: MenuItemDef): void => {
    const menuItems = this.items().filter(i => i.type !== 'divider');
    const idx = this.activeIndex();
    if (event.key === 'ArrowDown') { event.preventDefault(); this.activeIndex.set(Math.min(idx + 1, menuItems.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); this.activeIndex.set(Math.max(idx - 1, 0)); }
    if (event.key === 'Escape') { event.preventDefault(); this.isOpen.set(false); }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (menuItems[idx]) this.selectItem(menuItems[idx]); }
  };

  private outsideClick = (e: MouseEvent): void => {
    if (this.isOpen() && !(e.target as HTMLElement).closest('.ia-menu-wrapper')) this.isOpen.set(false);
  };
  private onScroll = (): void => { if (this.isOpen()) this.isOpen.set(false); };

  ngAfterViewInit(): void {
    document.addEventListener('click', this.outsideClick);
    document.addEventListener('scroll', this.onScroll, { capture: true });
  }
  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideClick);
    document.removeEventListener('scroll', this.onScroll, { capture: true });
  }
}
