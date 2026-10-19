import { Route, Router, Switch, useSearch } from "wouter";
import type { PartyRole } from "../data";
import { AccountsPage } from "./pages/AccountsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { HomePage } from "./pages/HomePage";
import { ItemForm, ItemPage } from "./pages/ItemForm";
import { ItemsPage } from "./pages/ItemsPage";
import { NotFound } from "./pages/NotFound";
import { PartiesPage } from "./pages/PartiesPage";
import { PartyForm, PartyPage } from "./pages/PartyForm";
import { PLANNED, PlannedPage } from "./pages/PlannedPage";
import { useHashLocation } from "./router";
import { Shell } from "./shell/Shell";

function PartiesRoute() {
  const role = new URLSearchParams(useSearch()).get("role");
  const valid: PartyRole | undefined =
    role === "customer" || role === "supplier" ? role : undefined;
  return <PartiesPage role={valid} />;
}

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell>
        <Routes />
      </Shell>
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
      {PLANNED.map((module) => (
        <Route key={module.path} path={module.path}>
          {() => <PlannedPage module={module} />}
        </Route>
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}
