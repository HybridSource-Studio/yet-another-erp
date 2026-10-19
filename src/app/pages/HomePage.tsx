import { Link } from "wouter";
import { formatMoney } from "../../data";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { useLive } from "../store-context";

const MODULES: { name: string; status: "built" | "partial" | "planned"; note: string }[] = [
  { name: "Contacts", status: "built", note: "Customers and suppliers" },
  { name: "Items", status: "built", note: "Products and services" },
  { name: "Sales", status: "partial", note: "Invoices post to the books; the editor is next" },
  { name: "Purchasing", status: "planned", note: "Purchase orders, bills, payments made" },
  { name: "Inventory", status: "planned", note: "Stock on hand, adjustments, transfers" },
  { name: "Accounting", status: "partial", note: "Chart of accounts seeded; reports next" },
  { name: "Your data", status: "planned", note: "Backup, restore, CSV import" },
];

const STATUS = {
  built: { tone: "success", text: "Built" },
  partial: { tone: "info", text: "In progress" },
  planned: { tone: "neutral", text: "Planned" },
} as const;

export function HomePage() {
  const data = useLive(async (s) => {
    const [workspace, parties, items, invoices] = await Promise.all([
      s.workspace(),
      s.parties.list(),
      s.items.list(),
      s.documents.list("invoice"),
    ]);
    const confirmed = invoices.filter((d) => d.status === "confirmed");
    const invoiced = confirmed.reduce((sum, d) => sum + s.documents.totals(d).total, 0);
    return {
      name: workspace.name,
      currency: workspace.currency,
      parties: parties.length,
      items: items.length,
      drafts: invoices.length - confirmed.length,
      confirmed: confirmed.length,
      invoiced,
    };
  }, []);
  if (!data) return null;

  const steps = [
    { text: "Add your first customer or supplier", href: "/parties/new", done: data.parties > 0 },
    { text: "Add the items you sell or buy", href: "/items/new", done: data.items > 0 },
    { text: "Set up your business details", href: "/settings", done: false },
    { text: "Send your first invoice", href: "/sales/invoices", done: data.confirmed > 0 },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        title={data.name}
        description="Everything on this page is kept in this browser, on this device. No account, no server, nothing sent anywhere."
      />
      <div className="grid grid-stats">
        <StatCard
          label="Contacts"
          value={String(data.parties)}
          hint="customers and suppliers"
          icon="users"
          href="/parties"
        />
        <StatCard
          label="Items"
          value={String(data.items)}
          hint="products and services"
          icon="package"
          href="/items"
        />
        <StatCard
          label="Invoiced"
          value={formatMoney(data.invoiced, data.currency)}
          hint={`${data.confirmed} confirmed, ${data.drafts} draft`}
          icon="receipt"
          href="/sales/invoices"
        />
        <StatCard
          label="Stock on hand"
          value="—"
          hint="stock page is planned"
          icon="warehouse"
          href="/inventory/stock"
        />
      </div>
      <div className="grid grid-2" style={{ marginTop: "var(--space-4)" }}>
        <Card title="Getting started" description={remaining ? `${remaining} to go` : "All set"}>
          <ol className="checklist">
            {steps.map((step) => (
              <li key={step.href} data-done={step.done || undefined}>
                <span className="check" data-done={step.done || undefined}>
                  <Icon name="check" size={14} />
                </span>
                <Link href={step.href} className="check-text">
                  {step.text}
                </Link>
                <Icon name="chevron-right" size={16} />
              </li>
            ))}
          </ol>
        </Card>
        <Card
          title="What's built"
          description="This is an early version. Here is where each part stands."
        >
          <ul className="checklist">
            {MODULES.map((m) => (
              <li key={m.name}>
                <span className="check-text">
                  <strong>{m.name}</strong>
                  <span className="subtle"> · {m.note}</span>
                </span>
                <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].text}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
