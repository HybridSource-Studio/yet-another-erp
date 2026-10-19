// The app's map: every module, where it lives and its icon. One source for the sidebar, the
// top bar's breadcrumb and the command palette, so they can never disagree.

import type { IconName } from "../components/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  { heading: "Overview", items: [{ href: "/", label: "Dashboard", icon: "home" }] },
  {
    heading: "Sales",
    items: [
      { href: "/sales/quotes", label: "Quotes", icon: "file-text" },
      { href: "/sales/orders", label: "Sales orders", icon: "clipboard" },
      { href: "/sales/invoices", label: "Invoices", icon: "receipt" },
      { href: "/sales/credit-notes", label: "Credit notes", icon: "rotate-ccw" },
      { href: "/sales/payments", label: "Payments received", icon: "wallet" },
    ],
  },
  {
    heading: "Purchasing",
    items: [
      { href: "/purchasing/orders", label: "Purchase orders", icon: "cart" },
      { href: "/purchasing/bills", label: "Bills", icon: "file-minus" },
      { href: "/purchasing/payments", label: "Payments made", icon: "wallet" },
    ],
  },
  {
    heading: "Inventory",
    items: [
      { href: "/items", label: "Items", icon: "package" },
      { href: "/inventory/stock", label: "Stock", icon: "warehouse" },
    ],
  },
  {
    heading: "Contacts",
    items: [{ href: "/parties", label: "Customers & suppliers", icon: "users" }],
  },
  {
    heading: "Accounting",
    items: [
      { href: "/accounting/accounts", label: "Chart of accounts", icon: "book" },
      { href: "/accounting/journal", label: "Journal", icon: "list" },
      { href: "/accounting/reports", label: "Reports", icon: "chart" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/data", label: "Your data", icon: "database" },
    ],
  },
];

/** Things the command palette can do besides going somewhere. */
export const ACTIONS: NavItem[] = [
  { href: "/parties/new", label: "New customer or supplier", icon: "plus" },
  { href: "/items/new", label: "New item", icon: "plus" },
];

/** The nav entry a path belongs to: the longest href the path starts with. */
export function findNav(path: string): { section: NavSection; item: NavItem } | undefined {
  let best: { section: NavSection; item: NavItem } | undefined;
  for (const section of NAV) {
    for (const item of section.items) {
      const match = path === item.href || (item.href !== "/" && path.startsWith(`${item.href}/`));
      if (match && (!best || item.href.length > best.item.href.length)) best = { section, item };
    }
  }
  return best;
}
