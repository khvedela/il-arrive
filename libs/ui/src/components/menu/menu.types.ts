export type MenuItemType = 'item' | 'divider' | 'danger';

export interface MenuItemDef {
  id: string;
  label?: string;
  type?: MenuItemType;
  icon?: string;
  disabled?: boolean;
}
