// "Jump to": a keyboard-first way to reach any page or start a new record. Opens with Ctrl+K
// (Cmd+K on a Mac) or the search button in the top bar. Entirely local: it searches the nav.

import { useId, useState } from "react";
import { Icon } from "../components/Icon";
import { navigate } from "../router";
import { ACTIONS, NAV, type NavItem } from "./nav";

interface Entry extends NavItem {
  group: string;
}

const ENTRIES: Entry[] = [
  ...ACTIONS.map((a) => ({ ...a, group: "Create" })),
  ...NAV.flatMap((s) => s.items.map((i) => ({ ...i, group: s.heading }))),
];

function matches(entry: Entry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${entry.group} ${entry.label}`.toLowerCase().includes(q);
}

/** Mounted only while open (Shell.tsx), so each opening starts with an empty query. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();
  const results = ENTRIES.filter((e) => matches(e, query));
  const selected = results[Math.min(cursor, results.length - 1)];

  function go(entry: Entry | undefined) {
    if (!entry) return;
    onClose();
    navigate(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(selected);
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Jump to"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            autoFocus
            type="search"
            aria-label="Jump to a page or action"
            placeholder="Where to? Try “invoices” or “new item”"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={selected ? `${listId}-${selected.href}` : undefined}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <ul id={listId} role="listbox" className="palette-list">
          {results.length === 0 && <li className="palette-empty">Nothing matches.</li>}
          {results.map((entry) => (
            <li
              key={entry.href + entry.label}
              id={`${listId}-${entry.href}`}
              role="option"
              aria-selected={entry === selected}
              className="palette-item"
              onMouseEnter={() => setCursor(results.indexOf(entry))}
              onClick={() => go(entry)}
            >
              <Icon name={entry.icon} size={16} />
              <span className="palette-label">{entry.label}</span>
              <span className="palette-group">{entry.group}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
