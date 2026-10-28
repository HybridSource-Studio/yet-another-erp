import { useState, type FormEvent } from "react";
import type { Party } from "../../data";
import { Card } from "../components/Card";
import { ErrorMessage } from "../components/ErrorMessage";
import { errorMessage, formChecked, formText } from "../components/forms";
import { PageHeader } from "../components/PageHeader";
import { navigate } from "../router";
import { useLive, useStore } from "../store-context";
import { NotFound } from "./NotFound";

export function PartyPage({ id }: { id: string }) {
  const party = useLive(async (s) => (await s.parties.get(id)) ?? null, [id]);
  if (party === undefined) return null;
  if (party === null) return <NotFound />;
  return <PartyForm party={party} />;
}

export function PartyForm({ party }: { party?: Party }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const terms = formText(form, "paymentTermsDays");
    const input = {
      name: formText(form, "name"),
      isCustomer: formChecked(form, "isCustomer"),
      isSupplier: formChecked(form, "isSupplier"),
      email: formText(form, "email"),
      phone: formText(form, "phone"),
      address: formText(form, "address"),
      taxId: formText(form, "taxId"),
      paymentTermsDays: terms === "" ? null : Number(terms),
      notes: formText(form, "notes"),
    };
    try {
      if (party) await store.parties.update(party.id, input);
      else await store.parties.create(input);
      navigate("/parties");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!party || !confirm(`Delete ${party.name}?`)) return;
    try {
      await store.parties.remove(party.id);
      navigate("/parties");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title={party ? party.name : "New customer or supplier"}
        description={party ? undefined : "A business you sell to, buy from, or both."}
      />
      <Card className="form-card">
        <form onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Details</h2>
            <p className="subtle">How they appear on documents.</p>
            <div className="fields">
              <label className="field span-2">
                Name
                <input
                  name="name"
                  required
                  defaultValue={party?.name}
                  autoComplete="organization"
                />
              </label>
              <fieldset className="span-2">
                <legend>This is a</legend>
                <label className="field inline">
                  <input
                    type="checkbox"
                    name="isCustomer"
                    defaultChecked={party?.isCustomer ?? true}
                  />
                  Customer
                </label>
                <label className="field inline">
                  <input
                    type="checkbox"
                    name="isSupplier"
                    defaultChecked={party?.isSupplier ?? false}
                  />
                  Supplier
                </label>
              </fieldset>
              <label className="field span-2">
                Address
                <textarea name="address" rows={3} defaultValue={party?.address} />
              </label>
              <label className="field">
                Tax ID
                <input name="taxId" defaultValue={party?.taxId} />
              </label>
            </div>
          </div>
          <div className="form-section">
            <h2>Contact</h2>
            <div className="fields">
              <label className="field">
                Email
                <input name="email" type="email" defaultValue={party?.email} />
              </label>
              <label className="field">
                Phone
                <input name="phone" type="tel" defaultValue={party?.phone} />
              </label>
            </div>
          </div>
          <div className="form-section">
            <h2>Terms and notes</h2>
            <div className="fields">
              <label className="field">
                Payment terms (days)
                <input
                  name="paymentTermsDays"
                  type="number"
                  min={0}
                  max={365}
                  defaultValue={party?.paymentTermsDays ?? ""}
                />
                <span className="field-help">Sets the due date on new invoices and bills.</span>
              </label>
              <label className="field span-2">
                Notes
                <textarea name="notes" rows={3} defaultValue={party?.notes} />
              </label>
            </div>
          </div>
          <ErrorMessage message={error} />
          <div className="form-footer">
            <button type="submit" className="button button-primary">
              Save
            </button>
            <a href="#/parties" className="button button-ghost">
              Cancel
            </a>
            <span className="spacer" />
            {party && (
              <button type="button" className="button button-danger" onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
        </form>
      </Card>
    </>
  );
}
