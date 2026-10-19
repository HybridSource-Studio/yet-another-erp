import { Link } from "wouter";
import { formatMoney } from "../../data";
import { useLive } from "../store-context";

export function ItemsPage() {
  const data = useLive(async (s) => {
    const [items, workspace] = await Promise.all([s.items.list(), s.workspace()]);
    return { items, currency: workspace.currency };
  }, []);
  return (
    <section>
      <header className="page-header">
        <h1>Items</h1>
        <Link href="/items/new" className="button">
          New item
        </Link>
      </header>
      {data === undefined ? null : data.items.length === 0 ? (
        <p className="muted">No items yet. Add the products and services you sell or buy.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">SKU</th>
              <th scope="col">Kind</th>
              <th scope="col" className="num">
                Sale price
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/items/${item.id}`}>{item.name}</Link>
                </td>
                <td>{item.sku}</td>
                <td>{item.kind === "stock" ? "Stock" : "Service"}</td>
                <td className="num">
                  {item.salePrice === null ? "" : formatMoney(item.salePrice, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
