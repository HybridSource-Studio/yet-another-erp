// A module that has its place in the app but no screens yet. Says what it will do and which
// phase and issue label the work is under, so people can find it.

import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import type { IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";

export interface PlannedModule {
  path: string;
  title: string;
  summary: string;
  icon: IconName;
  phase: string;
  label: string;
  bullets: string[];
}

export const PLANNED: PlannedModule[] = [
  {
    path: "/sales/payments",
    title: "Payments received",
    summary: "Money from customers, set against their invoices.",
    icon: "wallet",
    phase: "Phase 2: Sales",
    label: "module:sales",
    bullets: [
      "Record a payment and allocate it to invoices",
      "See what each customer still owes",
      "Posts to cash and receivables",
    ],
  },
  {
    path: "/purchasing/payments",
    title: "Payments made",
    summary: "Money paid to suppliers, set against their bills.",
    icon: "wallet",
    phase: "Phase 3: Purchasing",
    label: "module:purchasing",
    bullets: [
      "Record a payment and allocate it to bills",
      "See what you still owe each supplier",
      "Posts to payables and cash",
    ],
  },
  {
    path: "/inventory/stock",
    title: "Stock",
    summary: "What's on hand, where, and what's running low.",
    icon: "warehouse",
    phase: "Phase 4: Inventory",
    label: "module:inventory",
    bullets: [
      "On hand by item and location, summed from the ledger",
      "Adjustments and stocktakes",
      "Transfers between locations",
      "Moving-average cost and valuation",
    ],
  },
  {
    path: "/accounting/journal",
    title: "Journal",
    summary: "Every posting, newest first, and manual entries.",
    icon: "list",
    phase: "Phase 5: Accounting",
    label: "module:accounting",
    bullets: [
      "Each entry linked to the document that caused it",
      "Manual entries that must balance",
      "Reverse an entry; never edit one",
    ],
  },
  {
    path: "/accounting/reports",
    title: "Reports",
    summary: "The numbers an accountant asks for.",
    icon: "chart",
    phase: "Phase 5: Accounting",
    label: "module:accounting",
    bullets: [
      "Trial balance, profit and loss, balance sheet",
      "Receivables and payables aging",
      "Print-friendly, and CSV export",
    ],
  },
  {
    path: "/settings",
    title: "Settings",
    summary: "Your business, your currency, your tax rates and locations.",
    icon: "settings",
    phase: "Phase 1: Foundations",
    label: "module:core",
    bullets: [
      "Business details that print on documents",
      "Currency and financial year",
      "Tax rates and stock locations",
    ],
  },
  {
    path: "/data",
    title: "Your data",
    summary: "Back up, restore, merge and import. Yours to take anywhere.",
    icon: "database",
    phase: "Phase 1: Foundations",
    label: "module:data",
    bullets: [
      "Back up everything to one documented file",
      "Restore, or merge a backup from another device",
      "Import customers, suppliers and items from CSV",
      "Honest status of persistent storage",
    ],
  },
];

export function PlannedPage({ module }: { module: PlannedModule }) {
  return (
    <>
      <PageHeader
        title={module.title}
        description={module.summary}
        actions={<Badge tone="neutral">{module.phase}</Badge>}
      />
      <div className="grid grid-2">
        <EmptyState
          icon={module.icon}
          title="Not built yet"
          description={
            <>
              This module is on the roadmap. The work is tracked under the issue label{" "}
              <code>{module.label}</code>.
            </>
          }
        />
        <Card title="What it will do">
          <div className="card-body">
            <ul className="planned-list">
              {module.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
