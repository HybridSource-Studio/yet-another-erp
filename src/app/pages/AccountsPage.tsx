import { Badge, type Tone } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { useLive } from "../store-context";

const TYPE: Record<string, { text: string; tone: Tone }> = {
  asset: { text: "Asset", tone: "accent" },
  liability: { text: "Liability", tone: "warning" },
  equity: { text: "Equity", tone: "info" },
  income: { text: "Income", tone: "success" },
  expense: { text: "Expense", tone: "danger" },
};

/** The chart of accounts, read-only for now (adding and archiving accounts is issue #21). */
export function AccountsPage() {
  const accounts = useLive((s) => s.settings.accounts(), []);
  return (
    <>
      <PageHeader
        title="Chart of accounts"
        description="Confirmed documents post here on their own. You never make journal entries for everyday sales and purchases."
      />
      {accounts && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="mono muted">{a.code}</td>
                  <td>{a.name}</td>
                  <td>
                    <Badge tone={TYPE[a.type]?.tone}>{TYPE[a.type]?.text}</Badge>
                  </td>
                  <td className="subtle">{a.role ? "Automatic postings" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
