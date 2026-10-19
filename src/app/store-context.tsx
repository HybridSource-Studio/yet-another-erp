import { createContext, useContext, useEffect, useState, type DependencyList } from "react";
import type { Store } from "../data";

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreContext>");
  return store;
}

/**
 * Runs a data-layer read and re-runs it whenever the data it read changes. Returns undefined
 * while loading. Make the query return null, not undefined, for "not found".
 */
export function useLive<T>(
  query: (store: Store) => Promise<T>,
  deps: DependencyList,
): T | undefined {
  const store = useStore();
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; value: T }>();

  useEffect(() => {
    const subscription = store
      .observe(() => query(store))
      .subscribe({
        next: (value) => setState({ key, value }),
        error: (error) => console.error(error),
      });
    return () => subscription.unsubscribe();
    // The query closes over `deps`; `key` changes exactly when they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key]);

  return state && state.key === key ? state.value : undefined;
}
