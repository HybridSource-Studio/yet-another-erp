import { useState, type FormEvent } from "react";
import type { Party } from "../../data";
import { ErrorMessage } from "../components/ErrorMessage";
import { errorMessage, formChecked, formText } from "../components/forms";
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
    <section>
      <h1>{party ? party.name : "New customer or supplier"}</h1>
      <form onSubmit={onSubmit} className="stacked">
        <label>
          Name
          <input name="name" required defaultValue={party?.name} autoComplete="organization" />
        </label>
        <fieldset>
          <legend>This is a</legend>
          <label className="inline">
            <input type="checkbox" name="isCustomer" defaultChecked={party?.isCustomer ?? true} />
            Customer
          </label>
          <label className="inline">
            <input type="checkbox" name="isSupplier" defaultChecked={party?.isSupplier ?? false} />
            Supplier
          </label>
        </fieldset>
        <label>
          Email
          <input name="email" type="email" defaultValue={party?.email} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={party?.phone} />
        </label>
        <label>
          Address
          <textarea name="address" rows={3} defaultValue={party?.address} />
        </label>
        <label>
          Tax ID
          <input name="taxId" defaultValue={party?.taxId} />
        </label>
        <label>
          Payment terms (days)
          <input
            name="paymentTermsDays"
            type="number"
            min={0}
            max={365}
            defaultValue={party?.paymentTermsDays ?? ""}
          />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} defaultValue={party?.notes} />
        </label>
        <ErrorMessage message={error} />
        <div className="actions">
          <button type="submit">Save</button>
          <a href="#/parties">Cancel</a>
          {party && (
            <button type="button" className="danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
