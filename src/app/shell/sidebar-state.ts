// Whether the sidebar is collapsed to icons. A per-device preference, like the theme.

import { useSyncExternalStore } from "react";

const KEY = "sidebar";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function setCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(KEY, "collapsed");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage may be blocked; the change still applies for this page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCollapsed(): [boolean, (collapsed: boolean) => void] {
  return [useSyncExternalStore(subscribe, read), setCollapsed];
}
