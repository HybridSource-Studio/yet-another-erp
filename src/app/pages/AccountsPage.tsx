import { useLive } from "../store-context";

const TYPE: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

/** The chart of accounts, read-only for now (adding and archiving accounts is phase 5). */
export function AccountsPage() {
  const accounts = useLive((s) => s.settings.accounts(), []);
  return (
    <section>
      <h1>Chart of accounts</h1>
      <p className="muted">
        Confirmed documents post here automatically. You never have to make journal entries for
        everyday sales and purchases.
      </p>
      {accounts && (
        <table>
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td>
                <td>{a.name}</td>
                <td>{TYPE[a.type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
