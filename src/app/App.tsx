import { Link, Route, Router, Switch, useSearch } from "wouter";
import { APP_NAME } from "../config";
import type { PartyRole } from "../data";
import { AccountsPage } from "./pages/AccountsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { HomePage } from "./pages/HomePage";
import { ItemForm, ItemPage } from "./pages/ItemForm";
import { ItemsPage } from "./pages/ItemsPage";
import { NotBuilt } from "./pages/NotBuilt";
import { NotFound } from "./pages/NotFound";
import { PartiesPage } from "./pages/PartiesPage";
import { PartyForm, PartyPage } from "./pages/PartyForm";
import { useHashLocation } from "./router";
import { APP_VERSION } from "./version";

/** The modules, in the order the navigation shows them. */
const NAV: { heading: string; links: [href: string, text: string][] }[] = [
  {
    heading: "Sales",
    links: [
      ["/sales/quotes", "Quotes"],
      ["/sales/orders", "Sales orders"],
      ["/sales/invoices", "Invoices"],
      ["/sales/credit-notes", "Credit notes"],
      ["/sales/payments", "Payments received"],
    ],
  },
  {
    heading: "Purchasing",
    links: [
      ["/purchasing/orders", "Purchase orders"],
      ["/purchasing/bills", "Bills"],
      ["/purchasing/payments", "Payments made"],
    ],
  },
  {
    heading: "Inventory",
    links: [
      ["/items", "Items"],
      ["/inventory/stock", "Stock"],
    ],
  },
  { heading: "Contacts", links: [["/parties", "Customers & suppliers"]] },
  {
    heading: "Accounting",
    links: [
      ["/accounting/accounts", "Chart of accounts"],
      ["/accounting/journal", "Journal"],
      ["/accounting/reports", "Reports"],
    ],
  },
  {
    heading: "Workspace",
    links: [
      ["/settings", "Settings"],
      ["/data", "Your data"],
    ],
  },
];

/** Modules with a place in the app but no screens yet. Each names its issue label. */
const PLACEHOLDERS: { path: string; title: string; summary: string; label: string }[] = [
  {
    path: "/sales/payments",
    title: "Payments received",
    summary: "Record money from customers and set it against their invoices.",
    label: "module:sales",
  },
  {
    path: "/purchasing/payments",
    title: "Payments made",
    summary: "Record money paid to suppliers and set it against their bills.",
    label: "module:purchasing",
  },
  {
    path: "/inventory/stock",
    title: "Stock",
    summary: "Stock on hand by item and location, adjustments, transfers and what to reorder.",
    label: "module:inventory",
  },
  {
    path: "/accounting/journal",
    title: "Journal",
    summary: "Every posting, newest first, and manual journal entries.",
    label: "module:accounting",
  },
  {
    path: "/accounting/reports",
    title: "Reports",
    summary: "Profit and loss, balance sheet, trial balance, and who owes what.",
    label: "module:accounting",
  },
  {
    path: "/settings",
    title: "Settings",
    summary: "Your business details, currency, tax rates and stock locations.",
    label: "module:core",
  },
  {
    path: "/data",
    title: "Your data",
    summary: "Back up to a file, restore, merge a backup from another device, and import CSV.",
    label: "module:data",
  },
];

function PartiesRoute() {
  const role = new URLSearchParams(useSearch()).get("role");
  const valid: PartyRole | undefined =
    role === "customer" || role === "supplier" ? role : undefined;
  return <PartiesPage role={valid} />;
}

export function App() {
  return (
    <Router hook={useHashLocation}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="layout">
        <nav className="sidebar" aria-label="Main">
          <Link href="/" className="brand">
            {APP_NAME}
          </Link>
          {NAV.map((section) => (
            <div key={section.heading}>
              <h2>{section.heading}</h2>
              <ul>
                {section.links.map(([href, text]) => (
                  <li key={href}>
                    <Link href={href}>{text}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main id="main">
          <Routes />
          <footer className="muted">Version {APP_VERSION}. Your data stays in this browser.</footer>
        </main>
      </div>
    </Router>
  );
}

function Routes() {
  const sales = "module:sales";
  const purchasing = "module:purchasing";
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/parties" component={PartiesRoute} />
      <Route path="/parties/new">{() => <PartyForm />}</Route>
      <Route path="/parties/:id">{(p) => <PartyPage id={p.id} />}</Route>
      <Route path="/items" component={ItemsPage} />
      <Route path="/items/new">{() => <ItemForm />}</Route>
      <Route path="/items/:id">{(p) => <ItemPage id={p.id} />}</Route>
      <Route path="/sales/quotes">{() => <DocumentsPage type="quote" label={sales} />}</Route>
      <Route path="/sales/orders">{() => <DocumentsPage type="salesOrder" label={sales} />}</Route>
      <Route path="/sales/invoices">{() => <DocumentsPage type="invoice" label={sales} />}</Route>
      <Route path="/sales/credit-notes">
        {() => <DocumentsPage type="creditNote" label={sales} />}
      </Route>
      <Route path="/purchasing/orders">
        {() => <DocumentsPage type="purchaseOrder" label={purchasing} />}
      </Route>
      <Route path="/purchasing/bills">
        {() => <DocumentsPage type="bill" label={purchasing} />}
      </Route>
      <Route path="/accounting/accounts" component={AccountsPage} />
      {PLACEHOLDERS.map(({ path, ...props }) => (
        <Route key={path} path={path}>
          {() => <NotBuilt {...props} />}
        </Route>
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}
