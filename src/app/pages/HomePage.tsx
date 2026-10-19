import { APP_NAME } from "../../config";
import { useLive } from "../store-context";

export function HomePage() {
  const counts = useLive(async (s) => {
    const [parties, items, invoices] = await Promise.all([
      s.parties.list(),
      s.items.list(),
      s.documents.list("invoice"),
    ]);
    return { parties: parties.length, items: items.length, invoices: invoices.length };
  }, []);
  return (
    <section>
      <h1>{APP_NAME}</h1>
      <p>
        Everything here is stored in this browser, on this device. There is no account, no
        subscription and no server: your data never leaves your machine unless you export it.
      </p>
      {counts && (
        <ul className="stats" aria-label="At a glance">
          <li>
            <a href="#/parties">
              <strong>{counts.parties}</strong> customers and suppliers
            </a>
          </li>
          <li>
            <a href="#/items">
              <strong>{counts.items}</strong> items
            </a>
          </li>
          <li>
            <a href="#/sales/invoices">
              <strong>{counts.invoices}</strong> invoices
            </a>
          </li>
        </ul>
      )}
      <p className="muted">
        This is an early skeleton. Start by adding your customers, suppliers and items.
      </p>
    </section>
  );
}
