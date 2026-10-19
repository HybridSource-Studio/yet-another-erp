import { Link } from "wouter";
import type { PartyRole } from "../../data";
import { useLive } from "../store-context";

export function PartiesPage({ role }: { role?: PartyRole }) {
  const parties = useLive((s) => s.parties.list(role), [role]);
  const title = role === "customer" ? "Customers" : role === "supplier" ? "Suppliers" : "Parties";
  return (
    <section>
      <header className="page-header">
        <h1>{title}</h1>
        <Link href="/parties/new" className="button">
          New customer or supplier
        </Link>
      </header>
      <nav aria-label="Filter" className="filters">
        <Link href="/parties">All</Link> <Link href="/parties?role=customer">Customers</Link>{" "}
        <Link href="/parties?role=supplier">Suppliers</Link>
      </nav>
      {parties === undefined ? null : parties.length === 0 ? (
        <p className="muted">No one here yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/parties/${p.id}`}>{p.name}</Link>
                </td>
                <td>
                  {[p.isCustomer && "Customer", p.isSupplier && "Supplier"]
                    .filter(Boolean)
                    .join(", ")}
                </td>
                <td>{p.email}</td>
                <td>{p.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
