import { Link } from "wouter";
import type { PartyRole } from "../../data";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { useLive } from "../store-context";

const TABS: { href: string; label: string; role?: PartyRole }[] = [
  { href: "/parties", label: "All" },
  { href: "/parties?role=customer", label: "Customers", role: "customer" },
  { href: "/parties?role=supplier", label: "Suppliers", role: "supplier" },
];

export function PartiesPage({ role }: { role?: PartyRole }) {
  const parties = useLive((s) => s.parties.list(role), [role]);
  const newButton = (
    <Link href="/parties/new" className="button button-primary">
      <Icon name="plus" size={16} />
      New customer or supplier
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Customers & suppliers"
        description="One record per business you deal with, whether you sell to them, buy from them, or both."
        actions={newButton}
      >
        <nav className="tabs" aria-label="Filter">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.role === role ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {parties === undefined ? null : parties.length === 0 ? (
        <EmptyState
          icon="users"
          title={role ? `No ${role}s yet` : "No one here yet"}
          description="Add the people and businesses you invoice and the ones who bill you. Every document starts from one of them."
          action={
            <Link href="/parties/new" className="button button-primary">
              Add your first contact
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col" className="num">
                  Terms
                </th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="cell-main">
                      <Avatar name={p.name} />
                      <Link href={`/parties/${p.id}`}>{p.name}</Link>
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", gap: "0.35rem" }}>
                      {p.isCustomer && <Badge tone="accent">Customer</Badge>}
                      {p.isSupplier && <Badge tone="info">Supplier</Badge>}
                    </span>
                  </td>
                  <td className="muted">{p.email}</td>
                  <td className="muted">{p.phone}</td>
                  <td className="num muted">
                    {p.paymentTermsDays === null ? "" : `${p.paymentTermsDays} days`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
