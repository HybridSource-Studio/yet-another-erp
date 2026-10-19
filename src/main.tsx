import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { StoreContext } from "./app/store-context";
import { NewerDataError, openStore } from "./data";
import "./app/styles.css";

const root = createRoot(document.getElementById("root")!);
// During development, a hot reload of this module starts over with a fresh root.
import.meta.hot?.dispose(() => root.unmount());

openStore()
  .then((store) => {
    root.render(
      <StrictMode>
        <StoreContext value={store}>
          <App />
        </StoreContext>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    root.render(<StartupError error={error} />);
  });

function StartupError({ error }: { error: unknown }) {
  const newer = error instanceof NewerDataError;
  return (
    <main className="startup-error">
      <h1>{newer ? "Please reload" : "Can’t open your data"}</h1>
      <p>
        {newer
          ? error.message
          : "This browser blocked access to its local storage. Private browsing windows and some privacy settings do this. Try a normal window."}
      </p>
      {!newer && <pre>{String(error)}</pre>}
    </main>
  );
}
