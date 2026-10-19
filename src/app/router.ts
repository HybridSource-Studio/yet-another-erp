// Hash-based routing ("#/parties/123"). Hash URLs work on any static host with no rewrite
// rules, and the whole route, query included, stays inside the hash.

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  addEventListener("hashchange", onChange);
  return () => removeEventListener("hashchange", onChange);
}

function hashParts(): [string, string] {
  const hash = location.hash.replace(/^#/, "");
  const [path = "", search = ""] = hash.split("?");
  return [path.startsWith("/") ? path : `/${path}`, search];
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const url = `#${to}`;
  if (options.replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  dispatchEvent(new HashChangeEvent("hashchange"));
}

function usePath(): string {
  return useSyncExternalStore(subscribe, () => hashParts()[0]);
}

/** The query string inside the hash, without the "?". */
export function useHashSearch(): string {
  return useSyncExternalStore(subscribe, () => hashParts()[1]);
}

/** A location hook for wouter's <Router hook={...}>. */
export const useHashLocation = Object.assign(
  (): [string, typeof navigate] => [usePath(), navigate],
  { hrefs: (href: string) => `#${href}`, searchHook: useHashSearch },
);
