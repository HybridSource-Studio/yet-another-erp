import { DOCUMENT_LABEL, formatMoney, type DocumentType } from "../../data";
import { useLive } from "../store-context";

const PLURAL: Record<DocumentType, string> = {
  quote: "Quotes",
  salesOrder: "Sales orders",
  invoice: "Invoices",
  creditNote: "Credit notes",
  purchaseOrder: "Purchase orders",
  bill: "Bills",
};

const STATUS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

/** A read-only list for now. The document editor is phase 2 work (docs/plan.md). */
export function DocumentsPage({ type, label }: { type: DocumentType; label: string }) {
  const data = useLive(
    async (s) => {
      const [documents, parties, workspace] = await Promise.all([
        s.documents.list(type),
        s.parties.list(),
        s.workspace(),
      ]);
      const names = new Map(parties.map((p) => [p.id, p.name]));
      return {
        currency: workspace.currency,
        rows: documents.map((d) => ({
          ...d,
          party: names.get(d.partyId) ?? "",
          totals: s.documents.totals(d),
        })),
      };
    },
    [type],
  );

  return (
    <section>
      <h1>{PLURAL[type]}</h1>
      <p className="muted">
        Creating and editing {PLURAL[type].toLowerCase()} isn&rsquo;t built yet: it is tracked in
        the issues labelled <code>{label}</code>. The data layer already supports drafts, confirming
        and cancelling.
      </p>
      {data && data.rows.length > 0 && (
        <table>
          <caption className="visually-hidden">{PLURAL[type]}</caption>
          <thead>
            <tr>
              <th scope="col">Number</th>
              <th scope="col">Date</th>
              <th scope="col">
                {type === "bill" || type === "purchaseOrder" ? "Supplier" : "Customer"}
              </th>
              <th scope="col">Status</th>
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((d) => (
              <tr key={d.id}>
                <td>{d.number ?? `Draft ${DOCUMENT_LABEL[type].toLowerCase()}`}</td>
                <td>{d.issueDate}</td>
                <td>{d.party}</td>
                <td>{STATUS[d.status]}</td>
                <td className="num">{formatMoney(d.totals.total, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
