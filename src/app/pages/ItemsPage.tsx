import { Link } from "wouter";
import { formatMoney } from "../../data";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { useLive } from "../store-context";

export function ItemsPage() {
  const data = useLive(async (s) => {
    const [items, workspace] = await Promise.all([s.items.list(), s.workspace()]);
    return { items, currency: workspace.currency };
  }, []);
  return (
    <>
      <PageHeader
        title="Items"
        description="The products you count and the services you don't. Stock on hand is always worked out from the stock ledger."
        actions={
          <Link href="/items/new" className="button button-primary">
            <Icon name="plus" size={16} />
            New item
          </Link>
        }
      />
      {data === undefined ? null : data.items.length === 0 ? (
        <EmptyState
          icon="package"
          title="No items yet"
          description="Add what you sell and what you buy. Each item carries its unit, prices and tax rate, so documents fill themselves in."
          action={
            <Link href="/items/new" className="button button-primary">
              Add your first item
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">SKU</th>
                <th scope="col">Kind</th>
                <th scope="col">Unit</th>
                <th scope="col" className="num">
                  Sale price
                </th>
                <th scope="col" className="num">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/items/${item.id}`}>{item.name}</Link>
                  </td>
                  <td className="mono muted">{item.sku}</td>
                  <td>
                    <Badge tone={item.kind === "stock" ? "accent" : "neutral"}>
                      {item.kind === "stock" ? "Stock" : "Service"}
                    </Badge>
                  </td>
                  <td className="muted">{item.unit}</td>
                  <td className="num">
                    {item.salePrice === null ? "" : formatMoney(item.salePrice, data.currency)}
                  </td>
                  <td className="num muted">
                    {item.costPrice === null ? "" : formatMoney(item.costPrice, data.currency)}
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
