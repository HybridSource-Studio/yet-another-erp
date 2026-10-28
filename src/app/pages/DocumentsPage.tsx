import { DOCUMENT_LABEL, formatMoney, type DocumentType } from "../../data";
import { Badge, type Tone } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useLive } from "../store-context";

const PLURAL: Record<DocumentType, string> = {
  quote: "Quotes",
  salesOrder: "Sales orders",
  invoice: "Invoices",
  creditNote: "Credit notes",
  purchaseOrder: "Purchase orders",
  bill: "Bills",
};

const STATUS: Record<string, { text: string; tone: Tone }> = {
  draft: { text: "Draft", tone: "neutral" },
  confirmed: { text: "Confirmed", tone: "success" },
  cancelled: { text: "Cancelled", tone: "danger" },
};

const ABOUT: Record<DocumentType, string> = {
  quote: "What you offered a customer. Confirming numbers it; it posts nothing.",
  salesOrder: "What a customer agreed to buy. Confirming numbers it; it posts nothing.",
  invoice: "What a customer owes. Confirming posts sales, tax, stock and cost of sales.",
  creditNote: "Money back to a customer against an invoice.",
  purchaseOrder: "What you asked a supplier for. Confirming numbers it; it posts nothing.",
  bill: "What you owe a supplier. Confirming will post purchases, tax and stock.",
};

/** A read-only list for now. The document editor is issue #8. */
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
          total: s.documents.totals(d).total,
        })),
      };
    },
    [type],
  );
  const supplier = type === "bill" || type === "purchaseOrder";

  return (
    <>
      <PageHeader
        title={PLURAL[type]}
        description={ABOUT[type]}
        actions={<Badge tone="info">Editor in progress · {label}</Badge>}
      />
      {data === undefined ? null : data.rows.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={`No ${PLURAL[type].toLowerCase()} yet`}
          description={`Creating ${PLURAL[type].toLowerCase()} from a screen isn't built yet. The data layer already supports drafts, confirming and cancelling; the editor is tracked under ${label}.`}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">Date</th>
                <th scope="col">{supplier ? "Supplier" : "Customer"}</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((d) => (
                <tr key={d.id}>
                  <td className="mono">
                    {d.number ?? `Draft ${DOCUMENT_LABEL[type].toLowerCase()}`}
                  </td>
                  <td className="muted">{d.issueDate}</td>
                  <td>{d.party}</td>
                  <td>
                    <Badge tone={STATUS[d.status]?.tone}>{STATUS[d.status]?.text}</Badge>
                  </td>
                  <td className="num">{formatMoney(d.total, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
